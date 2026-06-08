import { v4 as uuid } from 'uuid';
import { query, queryOne, withTransaction } from '../models/db.js';
import { settleClaim } from './claims.js';

async function getSellerByUser(userId) {
  return queryOne('SELECT * FROM sellers WHERE user_id = $1', [userId]);
}

export async function listEvents(req, res) {
  const { status, sellerId, limit = 20, offset = 0 } = req.query;

  const params = [];
  let pIdx = 1;
  let extraWhere = '';

  if (status)   { extraWhere += ` AND e.status = $${pIdx++}`;     params.push(status); }
  if (sellerId) { extraWhere += ` AND e.seller_id = $${pIdx++}`;  params.push(sellerId); }

  params.push(Number(limit), Number(offset));

  const events = await query(
    `SELECT e.*, s.shop_name, s.avatar_url AS seller_avatar,
            COUNT(l.id)::int AS listing_count
     FROM events e
     JOIN sellers s ON s.id = e.seller_id
     LEFT JOIN listings l ON l.event_id = e.id
     WHERE 1=1 ${extraWhere}
     GROUP BY e.id, s.shop_name, s.avatar_url
     ORDER BY e.scheduled_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
    params
  );
  res.json({ data: events });
}

export async function getEvent(req, res) {
  const event = await queryOne(
    `SELECT e.*, s.shop_name, s.avatar_url AS seller_avatar, s.user_id AS seller_user_id
     FROM events e JOIN sellers s ON s.id = e.seller_id WHERE e.id = $1`,
    [req.params.id]
  );
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({ data: event });
}

export async function createEvent(req, res) {
  const seller = await getSellerByUser(req.user.sub);
  if (!seller) return res.status(403).json({ error: 'Seller account required' });

  const { title, description, scheduledAt, streamUrl, coverImageUrl, shippingPolicy, paymentDeadlineHours } = req.body;
  const id = uuid();

  const event = await queryOne(
    `INSERT INTO events (id, seller_id, title, description, scheduled_at, stream_url,
                         cover_image_url, shipping_policy, payment_deadline_hours)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [id, seller.id, title, description || null, scheduledAt || null,
     streamUrl || null, coverImageUrl || null, shippingPolicy || null,
     paymentDeadlineHours || 24]
  );
  res.status(201).json({ data: event });
}

export async function updateEvent(req, res) {
  const seller = await getSellerByUser(req.user.sub);
  const event = await queryOne('SELECT * FROM events WHERE id = $1', [req.params.id]);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (['live', 'ended', 'cancelled'].includes(event.status)) {
    return res.status(400).json({ error: `Cannot edit a ${event.status} event` });
  }

  const { title, description, scheduledAt, streamUrl, coverImageUrl, shippingPolicy, paymentDeadlineHours } = req.body;

  const updated = await queryOne(
    `UPDATE events SET
       title = $1, description = $2, scheduled_at = $3, stream_url = $4,
       cover_image_url = $5, shipping_policy = $6, payment_deadline_hours = $7,
       updated_at = NOW()
     WHERE id = $8 RETURNING *`,
    [
      title ?? event.title,
      description ?? event.description,
      scheduledAt ?? event.scheduled_at,
      streamUrl ?? event.stream_url,
      coverImageUrl ?? event.cover_image_url,
      shippingPolicy ?? event.shipping_policy,
      paymentDeadlineHours ?? event.payment_deadline_hours,
      event.id,
    ]
  );
  res.json({ data: updated });
}

export async function deleteEvent(req, res) {
  const seller = await getSellerByUser(req.user.sub);
  const event = await queryOne('SELECT * FROM events WHERE id = $1', [req.params.id]);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (event.status !== 'draft') return res.status(400).json({ error: 'Only draft events can be deleted' });

  await query('DELETE FROM events WHERE id = $1', [event.id]);
  res.json({ data: { message: 'Event deleted' } });
}

export async function startEvent(req, res) {
  const seller = await getSellerByUser(req.user.sub);
  const event = await queryOne('SELECT * FROM events WHERE id = $1', [req.params.id]);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (!['draft', 'scheduled'].includes(event.status)) {
    return res.status(400).json({ error: 'Event cannot be started' });
  }

  const updated = await queryOne(
    "UPDATE events SET status = 'live', started_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
    [event.id]
  );
  res.json({ data: updated });
}

export async function endEvent(req, res) {
  const seller = await getSellerByUser(req.user.sub);
  const event = await queryOne('SELECT * FROM events WHERE id = $1', [req.params.id]);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (event.status !== 'live') return res.status(400).json({ error: 'Event is not live' });

  const updated = await withTransaction(async (client) => {
    // Auto-confirm every outstanding grab into a sale before closing, so each
    // claimed item lands on the buyer's invoice.
    const { rows: pending } = await client.query(
      "SELECT * FROM claims WHERE event_id = $1 AND status = 'pending' ORDER BY created_at ASC",
      [event.id]
    );
    for (const claim of pending) {
      await settleClaim(client, claim);
    }

    const { rows: [ev] } = await client.query(
      "UPDATE events SET status = 'ended', ended_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
      [event.id]
    );
    return ev;
  });

  res.json({ data: updated });
}

export async function cancelEvent(req, res) {
  const seller = await getSellerByUser(req.user.sub);
  const event = await queryOne('SELECT * FROM events WHERE id = $1', [req.params.id]);

  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (!seller || event.seller_id !== seller.id) return res.status(403).json({ error: 'Forbidden' });
  if (event.status === 'ended') return res.status(400).json({ error: 'Cannot cancel ended event' });

  const updated = await queryOne(
    "UPDATE events SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *",
    [event.id]
  );
  res.json({ data: updated });
}

export async function getEventListings(req, res) {
  const listings = await query(
    `SELECT l.*,
            STRING_AGG(li.url, ',' ORDER BY li.sort_order) AS image_urls,
            COALESCE(
              json_agg(json_build_object('id', li.id, 'url', li.url) ORDER BY li.sort_order)
                FILTER (WHERE li.id IS NOT NULL),
              '[]'
            ) AS images
     FROM listings l
     LEFT JOIN listing_images li ON li.listing_id = l.id
     WHERE l.event_id = $1
     GROUP BY l.id
     ORDER BY l.sort_order ASC, l.created_at ASC`,
    [req.params.id]
  );

  const withImages = listings.map(l => ({
    ...l,
    image_urls: l.image_urls ? l.image_urls.split(',') : [],
    images: l.images ?? [],
  }));

  res.json({ data: withImages });
}
