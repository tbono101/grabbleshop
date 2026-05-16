import { v4 as uuid } from 'uuid';
import db from '../models/db.js';
import stripe from '../services/stripe.js';

export async function createCheckoutSession(req, res) {
  const { orderId } = req.body;

  const order = db.prepare(`
    SELECT o.*, s.stripe_account_id, s.commission_rate, s.shop_name
    FROM orders o JOIN sellers s ON s.id = o.seller_id
    WHERE o.id = ? AND o.buyer_id = ?
  `).get(orderId, req.user.sub);

  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending_payment') {
    return res.status(400).json({ error: 'Order is not awaiting payment' });
  }
  if (!order.stripe_account_id) {
    return res.status(400).json({ error: 'Seller has not connected Stripe' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

  const lineItems = items.map(item => ({
    price_data: {
      currency: 'usd',
      unit_amount: item.price,
      product_data: { name: item.title },
    },
    quantity: item.quantity,
  }));

  if (order.shipping_amount > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        unit_amount: order.shipping_amount,
        product_data: { name: 'Shipping' },
      },
      quantity: 1,
    });
  }

  if (order.tax_amount > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        unit_amount: order.tax_amount,
        product_data: { name: 'Sales Tax' },
      },
      quantity: 1,
    });
  }

  const applicationFee = Math.round(order.total * order.commission_rate);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    payment_intent_data: {
      application_fee_amount: applicationFee,
      transfer_data: { destination: order.stripe_account_id },
      metadata: { order_id: orderId, seller_id: order.seller_id },
    },
    metadata: { order_id: orderId },
    customer_email: req.user.email,
    success_url: `${process.env.CLIENT_ORIGIN}/orders/${orderId}?payment=success`,
    cancel_url: `${process.env.CLIENT_ORIGIN}/orders/${orderId}?payment=cancelled`,
  }, { stripeAccount: undefined }); // charge on platform account

  // Store session ID on payment record
  db.prepare(`
    UPDATE payments SET stripe_session_id = ?, updated_at = datetime('now')
    WHERE order_id = ?
  `).run(session.id, orderId);

  res.json({ data: { url: session.url, sessionId: session.id } });
}

export async function getPaymentStatus(req, res) {
  const payment = db.prepare(`
    SELECT p.*, o.status AS order_status
    FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE p.order_id = ? AND o.buyer_id = ?
  `).get(req.params.orderId, req.user.sub);

  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (payment.stripe_session_id && payment.status === 'pending') {
    const session = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
    if (session.payment_status === 'paid') {
      db.prepare("UPDATE payments SET status = 'succeeded', updated_at = datetime('now') WHERE order_id = ?")
        .run(payment.order_id);
      db.prepare("UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?")
        .run(payment.order_id);
    }
  }

  res.json({ data: db.prepare('SELECT * FROM payments WHERE order_id = ?').get(req.params.orderId) });
}

export async function createSellerDashboardLink(req, res) {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  if (!seller?.stripe_account_id) return res.status(400).json({ error: 'Stripe account not connected' });

  const link = await stripe.accounts.createLoginLink(seller.stripe_account_id);
  res.json({ data: { url: link.url } });
}
