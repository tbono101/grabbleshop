import { query, queryOne } from '../models/db.js';
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

      await query(
        `UPDATE payments SET
           status = 'succeeded', stripe_payment_intent_id = $1, stripe_session_id = $2, updated_at = NOW()
         WHERE order_id = $3`,
        [session.payment_intent, session.id, orderId]
      );
      await query(
        "UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1",
        [orderId]
      );
      console.log(`Order ${orderId} marked as paid via Stripe webhook`);
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const payment = await queryOne(
        'SELECT id FROM payments WHERE stripe_payment_intent_id = $1',
        [pi.id]
      );
      if (payment) {
        await query(
          "UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1",
          [payment.id]
        );
      }
      break;
    }

    case 'transfer.created': {
      const transfer = event.data.object;
      const orderId = transfer.metadata?.order_id;
      if (!orderId) break;

      const order = await queryOne('SELECT * FROM orders WHERE id = $1', [orderId]);
      if (!order) break;

      const seller = await queryOne('SELECT * FROM sellers WHERE id = $1', [order.seller_id]);
      const commissionAmount = Math.round(order.total * seller.commission_rate);
      const netAmount = order.total - commissionAmount;

      await query(
        `INSERT INTO payouts (id, seller_id, order_id, stripe_transfer_id, gross_amount, commission_amount, net_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid')
         ON CONFLICT (stripe_transfer_id) DO NOTHING`,
        [uuid(), seller.id, orderId, transfer.id, order.total, commissionAmount, netAmount]
      );
      await query(
        'UPDATE sellers SET total_sales = total_sales + 1 WHERE id = $1',
        [seller.id]
      );
      break;
    }

    case 'account.updated': {
      const account = event.data.object;
      const seller = await queryOne(
        'SELECT id FROM sellers WHERE stripe_account_id = $1',
        [account.id]
      );
      if (seller && account.details_submitted && account.charges_enabled) {
        await query(
          "UPDATE sellers SET stripe_onboarded = 1, updated_at = NOW() WHERE id = $1",
          [seller.id]
        );
      }
      break;
    }

    default:
      break;
  }

  res.json({ received: true });
}

export async function handleEasyPost(req, res) {
  const { result } = req.body;
  if (!result?.tracking_code) return res.json({ received: true });

  const shipment = await queryOne(
    'SELECT * FROM shipments WHERE tracking_number = $1',
    [result.tracking_code]
  );
  if (!shipment) return res.json({ received: true });

  const status = mapStatus(result.status);
  await query(
    "UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2",
    [status, shipment.id]
  );

  if (status === 'delivered') {
    await query(
      "UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = $1",
      [shipment.order_id]
    );
  }

  res.json({ received: true });
}

function mapStatus(epStatus) {
  const map = {
    pre_transit:      'label_created',
    in_transit:       'in_transit',
    out_for_delivery: 'in_transit',
    delivered:        'delivered',
    return_to_sender: 'exception',
    failure:          'exception',
  };
  return map[epStatus] || 'in_transit';
}
