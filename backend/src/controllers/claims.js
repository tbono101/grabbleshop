import { v4 as uuid } from 'uuid';
import { query, queryOne, withTransaction } from '../models/db.js';

export async function createClaim(req, res) {
  const { listingId, price } = req.body;

  const listing = await queryOne('SELECT * FROM listings WHERE id = $1', [listingId]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'active') {
    return res.status(400).json({ error: 'Listing is not available to claim' });
  }

  const event = await queryOne('SELECT * FROM events WHERE id = $1', [listing.event_id]);
  if (event.status !== 'live') return res.status(400).json({ error: 'Event is not live' });

  // Expire stale pending claims
  await query(
    "UPDATE claims SET status = 'expired', updated_at = NOW() WHERE listing_id = $1 AND status = 'pending' AND expires_at < NOW()",
    [listingId]
  );

  const existingClaim = await queryOne(
    "SELECT id FROM claims WHERE listing_id = $1 AND status = 'pending'",
    [listingId]
  );
  if (existingClaim) return res.status(409).json({ error: 'Item already claimed — wait for it to be released' });

  const claimPrice = price ? Math.round(price * 100) : listing.starting_price;
  if (claimPrice < listing.starting_price) {
    return res.status(400).json({ error: 'Price below starting price' });
  }

  const id = uuid();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const claim = await queryOne(
    `INSERT INTO claims (id, listing_id, buyer_id, event_id, price, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, listingId, req.user.sub, listing.event_id, claimPrice, expiresAt]
  );

  await query(
    "UPDATE listings SET status = 'claimed', updated_at = NOW() WHERE id = $1",
    [listingId]
  );

  res.status(201).json({ data: claim });
}

export async function getMyClaims(req, res) {
  const claims = await query(
    `SELECT c.*, l.title AS listing_title, l.starting_price, e.title AS event_title, s.shop_name
     FROM claims c
     JOIN listings l ON l.id = c.listing_id
     JOIN events e ON e.id = c.event_id
     JOIN sellers s ON s.id = l.seller_id
     WHERE c.buyer_id = $1 AND c.status IN ('pending', 'confirmed')
     ORDER BY c.created_at DESC`,
    [req.user.sub]
  );
  res.json({ data: claims });
}

export async function releaseClaim(req, res) {
  const claim = await queryOne('SELECT * FROM claims WHERE id = $1', [req.params.id]);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const isBuyer = claim.buyer_id === req.user.sub;

  let isSeller = false;
  if (!isBuyer) {
    const seller = await queryOne('SELECT id FROM sellers WHERE user_id = $1', [req.user.sub]);
    if (seller) {
      const owns = await queryOne(
        'SELECT 1 FROM listings WHERE id = $1 AND seller_id = $2',
        [claim.listing_id, seller.id]
      );
      isSeller = !!owns;
    }
  }

  if (!isBuyer && !isSeller && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (claim.status !== 'pending') {
    return res.status(400).json({ error: 'Claim cannot be released' });
  }

  await query("UPDATE claims SET status = 'released', updated_at = NOW() WHERE id = $1", [claim.id]);
  await query("UPDATE listings SET status = 'active', updated_at = NOW() WHERE id = $1", [claim.listing_id]);

  res.json({ data: { message: 'Claim released' } });
}

// Turn a pending claim into a confirmed sale: creates the order, order item
// and payment, marks the claim confirmed and the listing sold. Must run inside
// a transaction (the caller provides the client). Returns the created order.
export async function settleClaim(client, claim, shippingAddressId = null) {
  const { rows: [listing] } = await client.query('SELECT * FROM listings WHERE id = $1', [claim.listing_id]);

  const orderId   = uuid();
  const itemId    = uuid();
  const paymentId = uuid();

  const { rows: [ord] } = await client.query(
    `INSERT INTO orders (id, buyer_id, seller_id, event_id, status, subtotal, total, shipping_address_id)
     VALUES ($1, $2, $3, $4, 'pending_payment', $5, $6, $7) RETURNING *`,
    [orderId, claim.buyer_id, listing.seller_id, claim.event_id, claim.price, claim.price, shippingAddressId || null]
  );

  await client.query(
    `INSERT INTO order_items (id, order_id, listing_id, title, price, quantity)
     VALUES ($1, $2, $3, $4, $5, 1)`,
    [itemId, orderId, listing.id, listing.title, claim.price]
  );

  await client.query(
    'INSERT INTO payments (id, order_id, buyer_id, amount) VALUES ($1, $2, $3, $4)',
    [paymentId, orderId, claim.buyer_id, claim.price]
  );

  await client.query(
    "UPDATE claims SET status = 'confirmed', updated_at = NOW() WHERE id = $1",
    [claim.id]
  );
  await client.query(
    "UPDATE listings SET status = 'sold', updated_at = NOW() WHERE id = $1",
    [listing.id]
  );

  return ord;
}

export async function confirmClaim(req, res) {
  const { shippingAddressId } = req.body;
  const claim = await queryOne('SELECT * FROM claims WHERE id = $1', [req.params.id]);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  const listing = await queryOne('SELECT * FROM listings WHERE id = $1', [claim.listing_id]);

  if (!seller || listing.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (claim.status !== 'pending') return res.status(400).json({ error: 'Claim is not pending' });
  if (new Date(claim.expires_at) < new Date()) return res.status(400).json({ error: 'Claim has expired' });

  const order = await withTransaction((client) => settleClaim(client, claim, shippingAddressId));
  res.status(201).json({ data: order });
}

export async function getEventClaims(req, res) {
  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (!seller) return res.status(403).json({ error: 'Seller account required' });

  const event = await queryOne(
    'SELECT * FROM events WHERE id = $1 AND seller_id = $2',
    [req.params.eventId, seller.id]
  );
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const claims = await query(
    `SELECT c.*, u.first_name, u.last_name, u.email, l.title AS listing_title, l.size AS listing_size
     FROM claims c
     JOIN users u ON u.id = c.buyer_id
     JOIN listings l ON l.id = c.listing_id
     WHERE c.event_id = $1 ORDER BY c.created_at DESC`,
    [req.params.eventId]
  );
  res.json({ data: claims });
}

// Per-shopper invoice summary for an event: groups confirmed (sold) claims
// by buyer with their line items and a per-shopper total.
export async function getEventInvoices(req, res) {
  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (!seller) return res.status(403).json({ error: 'Seller account required' });

  const event = await queryOne(
    'SELECT id, title, status, ended_at FROM events WHERE id = $1 AND seller_id = $2',
    [req.params.eventId, seller.id]
  );
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const rows = await query(
    `SELECT c.buyer_id, c.price, c.created_at,
            u.first_name, u.last_name, u.email,
            l.id AS listing_id, l.title AS listing_title, l.size AS listing_size
     FROM claims c
     JOIN users u ON u.id = c.buyer_id
     JOIN listings l ON l.id = c.listing_id
     WHERE c.event_id = $1 AND c.status = 'confirmed'
     ORDER BY u.first_name, u.last_name, c.created_at`,
    [req.params.eventId]
  );

  const byBuyer = new Map();
  for (const r of rows) {
    if (!byBuyer.has(r.buyer_id)) {
      byBuyer.set(r.buyer_id, {
        buyer_id: r.buyer_id,
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: r.email,
        items: [],
        total: 0,
      });
    }
    const inv = byBuyer.get(r.buyer_id);
    inv.items.push({
      listing_id: r.listing_id,
      title: r.listing_title,
      size: r.listing_size,
      price: r.price,
    });
    inv.total += r.price;
  }

  const invoices = [...byBuyer.values()].sort((a, b) => b.total - a.total);
  const grandTotal = invoices.reduce((sum, i) => sum + i.total, 0);
  const itemCount  = invoices.reduce((sum, i) => sum + i.items.length, 0);

  res.json({ data: { event, invoices, grandTotal, itemCount, buyerCount: invoices.length } });
}
