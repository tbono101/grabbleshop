import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../models/db.js';
import stripe from '../services/stripe.js';
import { getPlatformFeeRate } from './admin.js';

export async function createCheckoutSession(req, res) {
  const { orderId } = req.body;

  const order = await queryOne(
    `SELECT o.*, s.stripe_account_id, s.commission_rate, s.fee_override, s.shop_name
     FROM orders o JOIN sellers s ON s.id = o.seller_id
     WHERE o.id = $1 AND o.buyer_id = $2`,
    [orderId, req.user.sub]
  );

  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending_payment') {
    return res.status(400).json({ error: 'Order is not awaiting payment' });
  }
  if (!order.stripe_account_id) {
    return res.status(400).json({ error: 'Seller has not connected Stripe' });
  }

  const items = await query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);

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

  const platformFeeRate = order.fee_override !== null && order.fee_override !== undefined
    ? order.fee_override
    : await getPlatformFeeRate();

  const applicationFee = Math.round(order.total * (order.commission_rate + platformFeeRate));

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
    cancel_url:  `${process.env.CLIENT_ORIGIN}/orders/${orderId}?payment=cancelled`,
  });

  await query(
    "UPDATE payments SET stripe_session_id = $1, updated_at = NOW() WHERE order_id = $2",
    [session.id, orderId]
  );

  res.json({ data: { url: session.url, sessionId: session.id } });
}

export async function getPaymentStatus(req, res) {
  const payment = await queryOne(
    `SELECT p.*, o.status AS order_status FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.order_id = $1 AND o.buyer_id = $2`,
    [req.params.orderId, req.user.sub]
  );
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (payment.stripe_session_id && payment.status === 'pending') {
    const session = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
    if (session.payment_status === 'paid') {
      await query(
        "UPDATE payments SET status = 'succeeded', updated_at = NOW() WHERE order_id = $1",
        [payment.order_id]
      );
      await query(
        "UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1",
        [payment.order_id]
      );
    }
  }

  const updated = await queryOne('SELECT * FROM payments WHERE order_id = $1', [req.params.orderId]);
  res.json({ data: updated });
}

export async function createSellerDashboardLink(req, res) {
  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (!seller?.stripe_account_id) return res.status(400).json({ error: 'Stripe account not connected' });

  const link = await stripe.accounts.createLoginLink(seller.stripe_account_id);
  res.json({ data: { url: link.url } });
}
