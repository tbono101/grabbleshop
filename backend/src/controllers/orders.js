import { v4 as uuid } from 'uuid';
import db from '../models/db.js';
import { calculateTax } from '../services/taxjar.js';

function getOrderWithItems(orderId) {
  const order = db.prepare(`
    SELECT o.*, s.shop_name, u.first_name AS buyer_first_name, u.last_name AS buyer_last_name,
           u.email AS buyer_email, a.line1, a.line2, a.city, a.state, a.zip, a.country
    FROM orders o
    JOIN sellers s ON s.id = o.seller_id
    JOIN users u ON u.id = o.buyer_id
    LEFT JOIN addresses a ON a.id = o.shipping_address_id
    WHERE o.id = ?
  `).get(orderId);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  return order;
}

export function getOrder(req, res) {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isBuyer = order.buyer_id === req.user.sub;
  const isSeller = (() => {
    const s = db.prepare('SELECT id FROM sellers WHERE user_id = ?').get(req.user.sub);
    return s && order.seller_id === s.id;
  })();

  if (!isBuyer && !isSeller && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({ data: order });
}

export function listMyOrders(req, res) {
  const { status, limit = 20, offset = 0 } = req.query;
  let q = `
    SELECT o.*, s.shop_name,
      (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
    FROM orders o JOIN sellers s ON s.id = o.seller_id
    WHERE o.buyer_id = ?
  `;
  const params = [req.user.sub];
  if (status) { q += ' AND o.status = ?'; params.push(status); }
  q += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  res.json({ data: db.prepare(q).all(...params) });
}

export function listSellerOrders(req, res) {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  if (!seller) return res.status(403).json({ error: 'Seller account required' });

  const { status, limit = 20, offset = 0 } = req.query;
  let q = `
    SELECT o.*, u.first_name, u.last_name, u.email,
      (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
    FROM orders o JOIN users u ON u.id = o.buyer_id
    WHERE o.seller_id = ?
  `;
  const params = [seller.id];
  if (status) { q += ' AND o.status = ?'; params.push(status); }
  q += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  res.json({ data: db.prepare(q).all(...params) });
}

export function cancelOrder(req, res) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isBuyer = order.buyer_id === req.user.sub;
  const isSeller = (() => {
    const s = db.prepare('SELECT id FROM sellers WHERE user_id = ?').get(req.user.sub);
    return s && order.seller_id === s.id;
  })();

  if (!isBuyer && !isSeller && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!['pending_payment', 'paid'].includes(order.status)) {
    return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
  }

  db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(order.id);

  // Restore listing to unsold
  const items = db.prepare('SELECT listing_id FROM order_items WHERE order_id = ?').all(order.id);
  items.forEach(({ listing_id }) => {
    db.prepare("UPDATE listings SET status = 'unsold', updated_at = datetime('now') WHERE id = ?").run(listing_id);
  });

  res.json({ data: db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) });
}

export function updateOrderStatus(req, res) {
  const { status } = req.body;
  const VALID = ['processing', 'shipped', 'delivered', 'refunded'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  if ((!seller || order.seller_id !== seller.id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, order.id);
  res.json({ data: db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) });
}

export async function applyTax(req, res) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyer_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });

  const { shippingAddressId } = req.body;
  const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(shippingAddressId, req.user.sub);
  if (!address) return res.status(404).json({ error: 'Address not found' });

  const seller = db.prepare('SELECT * FROM sellers WHERE id = ?').get(order.seller_id);
  const sellerUser = db.prepare('SELECT * FROM users WHERE id = ?').get(seller.user_id);

  // Fall back to a platform default origin ZIP if seller has no address
  const fromZip = process.env.PLATFORM_ZIP || '32830'; // Walt Disney World zip
  const fromState = process.env.PLATFORM_STATE || 'FL';

  const tax = await calculateTax({
    fromZip,
    fromState,
    toZip: address.zip,
    toState: address.state,
    amount: order.subtotal / 100,
    shipping: order.shipping_amount / 100,
  });

  const taxAmount = Math.round((tax.amount_to_collect || 0) * 100);
  const newTotal = order.subtotal + taxAmount + order.shipping_amount;

  db.prepare(`
    UPDATE orders SET
      tax_amount = ?, total = ?, shipping_address_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(taxAmount, newTotal, shippingAddressId, order.id);

  res.json({ data: db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) });
}

export function addReview(req, res) {
  const { rating, body } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyer_id !== req.user.sub) return res.status(403).json({ error: 'Forbidden' });
  if (order.status !== 'delivered') return res.status(400).json({ error: 'Can only review delivered orders' });

  const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(order.id);
  if (existing) return res.status(409).json({ error: 'Order already reviewed' });

  const id = uuid();
  db.prepare(`
    INSERT INTO reviews (id, seller_id, buyer_id, order_id, rating, body)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, order.seller_id, req.user.sub, order.id, rating, body || null);

  res.status(201).json({ data: db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) });
}
