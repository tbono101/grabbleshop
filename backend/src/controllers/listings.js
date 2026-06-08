import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../models/db.js';
import { generateProductDescription } from '../services/anthropic.js';
import { uploadImage } from '../services/cloudflare.js';
import fs from 'fs';

async function ownsListing(userId, listingId) {
  return queryOne(
    `SELECT l.* FROM listings l
     JOIN sellers s ON s.id = l.seller_id
     WHERE l.id = $1 AND s.user_id = $2`,
    [listingId, userId]
  );
}

export async function getListing(req, res) {
  const listing = await queryOne(
    `SELECT l.*,
            STRING_AGG(li.url, ',' ORDER BY li.sort_order) AS image_urls,
            COALESCE(
              json_agg(json_build_object('id', li.id, 'url', li.url) ORDER BY li.sort_order)
                FILTER (WHERE li.id IS NOT NULL),
              '[]'
            ) AS images
     FROM listings l
     LEFT JOIN listing_images li ON li.listing_id = l.id
     WHERE l.id = $1
     GROUP BY l.id`,
    [req.params.id]
  );
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  listing.image_urls = listing.image_urls ? listing.image_urls.split(',') : [];
  listing.images = listing.images ?? [];
  res.json({ data: listing });
}

export async function createListing(req, res) {
  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (!seller) return res.status(403).json({ error: 'Seller account required' });

  const { eventId, title, description, category, condition, startingPrice, buyNowPrice, quantity, size, sortOrder } = req.body;

  const event = await queryOne(
    'SELECT * FROM events WHERE id = $1 AND seller_id = $2',
    [eventId, seller.id]
  );
  if (!event) return res.status(404).json({ error: 'Event not found or not yours' });
  if (['ended', 'cancelled'].includes(event.status)) {
    return res.status(400).json({ error: 'Cannot add listings to this event' });
  }

  const id = uuid();
  const listing = await queryOne(
    `INSERT INTO listings (id, event_id, seller_id, title, description, category, condition,
                           starting_price, buy_now_price, quantity, size, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [id, eventId, seller.id, title, description || null, category || null,
     condition || 'new', Math.round(startingPrice * 100),
     buyNowPrice ? Math.round(buyNowPrice * 100) : null,
     quantity || 1, size || null, sortOrder || 0]
  );
  res.status(201).json({ data: listing });
}

export async function updateListing(req, res) {
  const listing = await ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (['claimed', 'sold'].includes(listing.status)) {
    return res.status(400).json({ error: 'Cannot edit a claimed or sold listing' });
  }

  const { title, description, category, condition, startingPrice, buyNowPrice, quantity, size, sortOrder } = req.body;

  const updated = await queryOne(
    `UPDATE listings SET
       title = $1, description = $2, category = $3, condition = $4,
       starting_price = $5, buy_now_price = $6, quantity = $7, size = $8, sort_order = $9,
       updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [
      title ?? listing.title,
      description ?? listing.description,
      category ?? listing.category,
      condition ?? listing.condition,
      startingPrice ? Math.round(startingPrice * 100) : listing.starting_price,
      buyNowPrice != null ? Math.round(buyNowPrice * 100) : listing.buy_now_price,
      quantity ?? listing.quantity,
      size !== undefined ? (size || null) : listing.size,
      sortOrder ?? listing.sort_order,
      listing.id,
    ]
  );
  res.json({ data: updated });
}

export async function deleteListing(req, res) {
  const listing = await ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!['pending', 'unsold'].includes(listing.status)) {
    return res.status(400).json({ error: 'Cannot delete this listing' });
  }
  await query('DELETE FROM listings WHERE id = $1', [listing.id]);
  res.json({ data: { message: 'Listing deleted' } });
}

export async function activateListing(req, res) {
  const listing = await ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const event = await queryOne('SELECT * FROM events WHERE id = $1', [listing.event_id]);
  if (event.status !== 'live') return res.status(400).json({ error: 'Event must be live to activate a listing' });

  await query(
    "UPDATE listings SET status = 'pending', updated_at = NOW() WHERE event_id = $1 AND status = 'active'",
    [listing.event_id]
  );
  const updated = await queryOne(
    "UPDATE listings SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *",
    [listing.id]
  );
  res.json({ data: updated });
}

export async function deactivateListing(req, res) {
  const listing = await ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is not active' });

  const updated = await queryOne(
    "UPDATE listings SET status = 'pending', updated_at = NOW() WHERE id = $1 RETURNING *",
    [listing.id]
  );
  res.json({ data: updated });
}

export async function uploadImages(req, res) {
  const listing = await ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!req.files?.length) return res.status(400).json({ error: 'No images uploaded' });

  const images = [];
  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    try {
      const url = await uploadImage(file.path);
      const id = uuid();
      const maxRow = await queryOne(
        'SELECT COALESCE(MAX(sort_order), -1) AS m FROM listing_images WHERE listing_id = $1',
        [listing.id]
      );
      await query(
        'INSERT INTO listing_images (id, listing_id, url, sort_order) VALUES ($1, $2, $3, $4)',
        [id, listing.id, url, maxRow.m + 1 + i]
      );
      images.push({ id, url });
    } finally {
      fs.unlink(file.path, () => {});
    }
  }
  res.status(201).json({ data: images });
}

export async function generateDescription(req, res) {
  const listing = await ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const description = await generateProductDescription(listing.title, {
    category: listing.category,
    condition: listing.condition,
    price: (listing.starting_price / 100).toFixed(2),
  });
  res.json({ data: { description } });
}

export async function deleteImage(req, res) {
  const { id, imageId } = req.params;
  const listing = await ownsListing(req.user.sub, id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const image = await queryOne(
    'SELECT id FROM listing_images WHERE id = $1 AND listing_id = $2',
    [imageId, id]
  );
  if (!image) return res.status(404).json({ error: 'Image not found' });

  await query('DELETE FROM listing_images WHERE id = $1', [imageId]);
  res.json({ data: { message: 'Image deleted' } });
}
