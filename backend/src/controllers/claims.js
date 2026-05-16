import { v4 as uuid } from 'uuid';
import db from '../models/db.js';

export function createClaim(req, res) {
  const { listingId, price } = req.body;

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'active') {
    return res.status(400).json({ error: 'Listing is not available to claim' });
  }

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(listing.event_id);
  if (event.status !== 'live') return res.status(400).json({ error: 'Event is not live' });

  // Expire stale pending claims first
  db.prepare(`
    UPDATE claims SET status = 'expired', updated_at = datetime('now')
    WHERE listing_id = ? AND status = 'pending' AND expires_at < datetime('now')
  `).run(listingId);

  const existingClaim = db.prepare(
    "SELECT id FROM claims WHERE listing_id = ? AND status = 'pending'"
  ).get(listingId);
  if (existingClaim) return res.status(409).json({ error: 'Item already claimed — wait for it to be released' });

  const claimPrice = price ? Math.round(price * 100) : listing.starting_price;
  if (claimPrice < listing.starting_price) {
    return res.status(400).json({ error: 'Price below starting price' });
  }

  const id = uuid();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO claims (id, listing_id, buyer_id, event_id, price, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, listingId, req.user.sub, listing.event_id, claimPrice, expiresAt);

  db.prepare("UPDATE listings SET status = 'claimed', updated_at = datetime('now') WHERE id = ?")
    .run(listingId);

  res.status(201).json({ data: db.prepare('SELECT * FROM claims WHERE id = ?').get(id) });
}

export function getMyClaims(req, res) {
  const claims = db.prepare(`
    SELECT c.*, l.title AS listing_title, l.starting_price, e.title AS event_title, s.shop_name
    FROM claims c
    JOIN listings l ON l.id = c.listing_id
    JOIN events e ON e.id = c.event_id
    JOIN sellers s ON s.id = l.seller_id
    WHERE c.buyer_id = ? AND c.status IN ('pending', 'confirmed')
    ORDER BY c.created_at DESC
  `).all(req.user.sub);
  res.json({ data: claims });
}

export function releaseClaim(req, res) {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const isBuyer = claim.buyer_id === req.user.sub;
  const isSeller = (() => {
    const seller = db.prepare('SELECT id FROM sellers WHERE user_id = ?').get(req.user.sub);
    return seller && db.prepare('SELECT 1 FROM listings WHERE id = ? AND seller_id = ?').get(claim.listing_id, seller.id);
  })();

  if (!isBuyer && !isSeller && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (claim.status !== 'pending') {
    return res.status(400).json({ error: 'Claim cannot be released' });
  }

  db.prepare("UPDATE claims SET status = 'released', updated_at = datetime('now') WHERE id = ?").run(claim.id);
  db.prepare("UPDATE listings SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(claim.listing_id);

  res.json({ data: { message: 'Claim released' } });
}

export function confirmClaim(req, res) {
  const { shippingAddressId } = req.body;
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(claim.listing_id);

  if (!seller || listing.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (claim.status !== 'pending') return res.status(400).json({ error: 'Claim is not pending' });
  if (new Date(claim.expires_at) < new Date()) return res.status(400).json({ error: 'Claim has expired' });

  const createOrder = db.transaction(() => {
    const orderId = uuid();
    const itemId = uuid();
    const paymentId = uuid();

    db.prepare(`
      INSERT INTO orders (id, buyer_id, seller_id, event_id, status, subtotal, total, shipping_address_id)
      VALUES (?, ?, ?, ?, 'pending_payment', ?, ?, ?)
    `).run(orderId, claim.buyer_id, seller.id, claim.event_id, claim.price, claim.price,
      shippingAddressId || null);

    db.prepare(`
      INSERT INTO order_items (id, order_id, listing_id, title, price, quantity)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(itemId, orderId, listing.id, listing.title, claim.price);

    db.prepare(`
      INSERT INTO payments (id, order_id, buyer_id, amount) VALUES (?, ?, ?, ?)
    `).run(paymentId, orderId, claim.buyer_id, claim.price);

    db.prepare("UPDATE claims SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?").run(claim.id);
    db.prepare("UPDATE listings SET status = 'sold', updated_at = datetime('now') WHERE id = ?").run(listing.id);

    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  });

  const order = createOrder();
  res.status(201).json({ data: order });
}

export function getEventClaims(req, res) {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  if (!seller) return res.status(403).json({ error: 'Seller account required' });

  const event = db.prepare('SELECT * FROM events WHERE id = ? AND seller_id = ?').get(req.params.eventId, seller.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const claims = db.prepare(`
    SELECT c.*, u.first_name, u.last_name, u.email, l.title AS listing_title
    FROM claims c
    JOIN users u ON u.id = c.buyer_id
    JOIN listings l ON l.id = c.listing_id
    WHERE c.event_id = ?
    ORDER BY c.created_at DESC
  `).all(req.params.eventId);

  res.json({ data: claims });
}
