import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../models/db.js';
import { calculateTax } from '../services/taxjar.js';

async function getOrderWithItems(orderId) {
  const order = await queryOne(
    `SELECT o.*, s.shop_name, u.first_name AS buyer_first_name, u.last_name AS buyer_last_name,
            u.email AS buyer_email, a.line1, a.line2, a.city, a.state, a.zip, a.country
     FROM orders o
     JOIN sellers s ON s.id = o.seller_id
     JOIN users u ON u.id = o.buyer_id
     LEFT JOIN addresses a ON a.id = o.shipping_address_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (!order) return null;
  order.items = await query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
  return order;
}

export async function getOrder(req, res) {
  const order = await getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isBuyer = order.buyer_id === req.user.sub;
  let isSeller = false;
  if (!isBuyer) {
    const s = await queryOne('SELECT id FROM sellers WHERE user_id = $1', [req.user.sub]);
    isSeller = s && order.seller_id === s.id;
  }

  if (!isBuyer && !isSeller && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({ data: order });
}

export async function listMyOrders(req, res) {
  const { status, limit = 20, offset = 0 } = req.query;

  const params = [req.user.sub];
  let pIdx = 2;
  let extraWhere = '';
  if (status) { extraWhere += ` AND o.status = $${pIdx++}`; params.push(status); }
  params.push(Number(limit), Number(offset));

  const orders = await query(
    `SELECT o.*, s.shop_name,
            (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o JOIN sellers s ON s.id = o.seller_id
     WHERE o.buyer_id = $1 ${extraWhere}
     ORDER BY o.created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
    params
  );
  res.json({ data: orders });
}

export async function listSellerOrders(req, res) {
  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (!seller) return res.status(403).json({ error: 'Seller account required' });

  const { status, limit = 20, offset = 0 } = req.query;

  const params = [seller.id];
  let pIdx = 2;
  let extraWhere = '';
  if (status) { extraWhere += ` AND o.status = $${pIdx++}`; params.push(status); }
  params.push(Number(limit), Number(offset));

  const orders = await query(
    `SELECT o.*, u.first_name, u.last_name, u.email,
            (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o JOIN users u ON u.id = o.buyer_id
     WHERE o.seller_id = $1 ${extraWhere}
     ORDER BY o.created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
    params
  );
  res.json({ data: orders });
}

export async function cancelOrder(req, res) {
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isBuyer = order.buyer_id === req.user.sub;
  let isSeller = false;
  if (!isBuyer) {
    const s = await queryOne('SELECT id FROM sellers WHERE user_id = $1', [req.user.sub]);
    isSeller = s && order.seller_id === s.id;
  }

  if (!isBuyer && !isSeller && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!['pending_payment', 'paid'].includes(order.status)) {
    return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
  }

  await query(
    "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
    [order.id]
  );

  const items = await query('SELECT listing_id FROM order_items WHERE order_id = $1', [order.id]);
  for (const { listing_id } of items) {
    await query(
      "UPDATE listings SET status = 'unsold', updated_at = NOW() WHERE id = $1",
      [listing_id]
    );
  }

  const updated = await queryOne('SELECT * FROM orders WHERE id = $1', [order.id]);
  res.json({ data: updated });
}

export async function updateOrderStatus(req, res) {
  const { status } = req.body;
  const VALID = ['processing', 'shipped', 'delivered', 'refunded'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if ((!seller || order.seller_id !== seller.id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await queryOne(
    "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [status, order.id]
  );
  res.json({ data: updated });
}

export async function applyTax(req, res) {
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyer_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

  const { shippingAddressId } = req.body;
  const address = await queryOne(
    'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
    [shippingAddressId, req.user.sub]
  );
  if (!address) return res.status(404).json({ error: 'Address not found' });

  const fromZip   = process.env.PLATFORM_ZIP   || '32830';
  const fromState = process.env.PLATFORM_STATE  || 'FL';

  const tax = await calculateTax({
    fromZip,
    fromState,
    toZip: address.zip,
    toState: address.state,
    amount: order.subtotal / 100,
    shipping: order.shipping_amount / 100,
  });

  const taxAmount = Math.round((tax.amount_to_collect || 0) * 100);
  const newTotal  = order.subtotal + taxAmount + order.shipping_amount;

  const updated = await queryOne(
    `UPDATE orders SET tax_amount = $1, total = $2, shipping_address_id = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [taxAmount, newTotal, shippingAddressId, order.id]
  );
  res.json({ data: updated });
}

export async function addReview(req, res) {
  const { rating, body } = req.body;
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyer_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
  if (order.status !== 'delivered') return res.status(400).json({ error: 'Can only review delivered orders' });

  const existing = await queryOne('SELECT id FROM reviews WHERE order_id = $1', [order.id]);
  if (existing) return res.status(409).json({ error: 'Order already reviewed' });

  const id = uuid();
  const review = await queryOne(
    `INSERT INTO reviews (id, seller_id, buyer_id, order_id, rating, body)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, order.seller_id, req.user.sub, order.id, rating, body || null]
  );
  res.status(201).json({ data: review });
}
