import { v4 as uuid } from 'uuid';
import db from '../models/db.js';

function getSeller(userId) {
  return db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(userId);
}

export function listEvents(req, res) {
  const { status, sellerId, limit = 20, offset = 0 } = req.query;
  let query = `
    SELECT e.*, s.shop_name, s.avatar_url AS seller_avatar,
           COUNT(l.id) AS listing_count
    FROM events e
    JOIN sellers s ON s.id = e.seller_id
    LEFT JOIN listings l ON l.event_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (status) { query += ' AND e.status = ?'; params.push(status); }
  if (sellerId) { query += ' AND e.seller_id = ?'; params.push(sellerId); }

  query += ' GROUP BY e.id ORDER BY e.scheduled_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  res.json({ data: db.prepare(query).all(...params) });
}

export function getEvent(req, res) {
  const event = db.prepare(`
    SELECT e.*, s.shop_name, s.avatar_url AS seller_avatar, s.user_id AS seller_user_id
    FROM events e JOIN sellers s ON s.id = e.seller_id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({ data: event });
}

export function createEvent(req, res) {
  const seller = getSeller(req.user.sub);
  if (!seller) return res.status(403).json({ error: 'Seller account required' });

  const { title, description, scheduledAt, streamUrl, coverImageUrl, shippingPolicy, paymentDeadlineHours } = req.body;
  const id = uuid();

  db.prepare(`
    INSERT INTO events (id, seller_id, title, description, scheduled_at, stream_url,
                        cover_image_url, shipping_policy, payment_deadline_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, seller.id, title, description || null, scheduledAt || null,
    streamUrl || null, coverImageUrl || null, shippingPolicy || null,
    paymentDeadlineHours || 24);

  res.status(201).json({ data: db.prepare('SELECT * FROM events WHERE id = ?').get(id) });
}

export function updateEvent(req, res) {
  const seller = getSeller(req.user.sub);
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (['live', 'ended', 'cancelled'].includes(event.status)) {
    return res.status(400).json({ error: `Cannot edit a ${event.status} event` });
  }

  const { title, description, scheduledAt, streamUrl, coverImageUrl, shippingPolicy, paymentDeadlineHours } = req.body;

  db.prepare(`
    UPDATE events SET
      title = ?, description = ?, scheduled_at = ?, stream_url = ?,
      cover_image_url = ?, shipping_policy = ?, payment_deadline_hours = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? event.title,
    description ?? event.description,
    scheduledAt ?? event.scheduled_at,
    streamUrl ?? event.stream_url,
    coverImageUrl ?? event.cover_image_url,
    shippingPolicy ?? event.shipping_policy,
    paymentDeadlineHours ?? event.payment_deadline_hours,
    event.id
  );

  res.json({ data: db.prepare('SELECT * FROM events WHERE id = ?').get(event.id) });
}

export function deleteEvent(req, res) {
  const seller = getSeller(req.user.sub);
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (event.status !== 'draft') return res.status(400).json({ error: 'Only draft events can be deleted' });

  db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
  res.json({ data: { message: 'Event deleted' } });
}

export function startEvent(req, res) {
  const seller = getSeller(req.user.sub);
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (!['draft', 'scheduled'].includes(event.status)) {
    return res.status(400).json({ error: 'Event cannot be started' });
  }

  db.prepare(`
    UPDATE events SET status = 'live', started_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(event.id);

  res.json({ data: db.prepare('SELECT * FROM events WHERE id = ?').get(event.id) });
}

export function endEvent(req, res) {
  const seller = getSeller(req.user.sub);
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (event.status !== 'live') return res.status(400).json({ error: 'Event is not live' });

  db.prepare(`
    UPDATE events SET status = 'ended', ended_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(event.id);

  // Release any still-pending claims
  db.prepare(`
    UPDATE claims SET status = 'released', updated_at = datetime('now')
    WHERE event_id = ? AND status = 'pending'
  `).run(event.id);

  res.json({ data: db.prepare('SELECT * FROM events WHERE id = ?').get(event.id) });
}

export function cancelEvent(req, res) {
  const seller = getSeller(req.user.sub);
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (event.status === 'ended') return res.status(400).json({ error: 'Cannot cancel ended event' });

  db.prepare(`
    UPDATE events SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?
  `).run(event.id);

  res.json({ data: db.prepare('SELECT * FROM events WHERE id = ?').get(event.id) });
}

export function getEventListings(req, res) {
  const listings = db.prepare(`
    SELECT l.*, GROUP_CONCAT(li.url ORDER BY li.sort_order) AS image_urls
    FROM listings l
    LEFT JOIN listing_images li ON li.listing_id = l.id
    WHERE l.event_id = ?
    GROUP BY l.id
    ORDER BY l.sort_order ASC, l.created_at ASC
  `).all(req.params.id);

  const withImages = listings.map(l => ({
    ...l,
    image_urls: l.image_urls ? l.image_urls.split(',') : [],
  }));

  res.json({ data: withImages });
}
