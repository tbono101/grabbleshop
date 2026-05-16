import db from '../models/db.js';
import stripe from '../services/stripe.js';
import { v4 as uuid } from 'uuid';

export async function handleStripe(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      if (!orderId) break;

      db.prepare(`
        UPDATE payments SET
          status = 'succeeded',
          stripe_payment_intent_id = ?,
          stripe_session_id = ?,
          updated_at = datetime('now')
        WHERE order_id = ?
      `).run(session.payment_intent, session.id, orderId);

      db.prepare("UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?")
        .run(orderId);

      console.log(`Order ${orderId} marked as paid via Stripe webhook`);
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const payment = db.prepare('SELECT * FROM payments WHERE stripe_payment_intent_id = ?').get(pi.id);
      if (payment) {
        db.prepare("UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE id = ?")
          .run(payment.id);
      }
      break;
    }

    case 'transfer.created': {
      const transfer = event.data.object;
      const orderId = transfer.metadata?.order_id;
      if (!orderId) break;

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order) break;

      const seller = db.prepare('SELECT * FROM sellers WHERE id = ?').get(order.seller_id);
      const commissionAmount = Math.round(order.total * seller.commission_rate);
      const netAmount = order.total - commissionAmount;

      db.prepare(`
        INSERT OR IGNORE INTO payouts (id, seller_id, order_id, stripe_transfer_id, gross_amount, commission_amount, net_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
      `).run(uuid(), seller.id, orderId, transfer.id, order.total, commissionAmount, netAmount);

      db.prepare("UPDATE sellers SET total_sales = total_sales + 1 WHERE id = ?").run(seller.id);
      break;
    }

    case 'account.updated': {
      const account = event.data.object;
      const seller = db.prepare('SELECT * FROM sellers WHERE stripe_account_id = ?').get(account.id);
      if (seller && account.details_submitted && account.charges_enabled) {
        db.prepare("UPDATE sellers SET stripe_onboarded = 1, updated_at = datetime('now') WHERE id = ?")
          .run(seller.id);
      }
      break;
    }

    default:
      break;
  }

  res.json({ received: true });
}

export function handleEasyPost(req, res) {
  const { result } = req.body;
  if (!result?.tracking_code) return res.json({ received: true });

  const shipment = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(result.tracking_code);
  if (!shipment) return res.json({ received: true });

  const status = mapStatus(result.status);
  db.prepare("UPDATE shipments SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, shipment.id);

  if (status === 'delivered') {
    db.prepare("UPDATE orders SET status = 'delivered', updated_at = datetime('now') WHERE id = ?")
      .run(shipment.order_id);
  }

  res.json({ received: true });
}

function mapStatus(epStatus) {
  const map = {
    pre_transit: 'label_created',
    in_transit: 'in_transit',
    out_for_delivery: 'in_transit',
    delivered: 'delivered',
    return_to_sender: 'exception',
    failure: 'exception',
  };
  return map[epStatus] || 'in_transit';
}
