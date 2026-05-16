import { v4 as uuid } from 'uuid';
import db from '../models/db.js';
import { generateProductDescription } from '../services/anthropic.js';
import { uploadImage } from '../services/cloudflare.js';
import fs from 'fs';

function ownsListing(userId, listingId) {
  const listing = db.prepare(`
    SELECT l.* FROM listings l
    JOIN sellers s ON s.id = l.seller_id
    WHERE l.id = ? AND s.user_id = ?
  `).get(listingId, userId);
  return listing;
}

export function getListing(req, res) {
  const listing = db.prepare(`
    SELECT l.*, GROUP_CONCAT(li.url ORDER BY li.sort_order) AS image_urls
    FROM listings l
    LEFT JOIN listing_images li ON li.listing_id = l.id
    WHERE l.id = ?
    GROUP BY l.id
  `).get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  listing.image_urls = listing.image_urls ? listing.image_urls.split(',') : [];
  res.json({ data: listing });
}

export function createListing(req, res) {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  if (!seller) return res.status(403).json({ error: 'Seller account required' });

  const { eventId, title, description, category, condition, startingPrice, buyNowPrice, quantity, sortOrder } = req.body;

  const event = db.prepare('SELECT * FROM events WHERE id = ? AND seller_id = ?').get(eventId, seller.id);
  if (!event) return res.status(404).json({ error: 'Event not found or not yours' });
  if (['ended', 'cancelled'].includes(event.status)) {
    return res.status(400).json({ error: 'Cannot add listings to this event' });
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO listings (id, event_id, seller_id, title, description, category, condition,
                          starting_price, buy_now_price, quantity, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, eventId, seller.id, title, description || null, category || null,
    condition || 'new', Math.round(startingPrice * 100), buyNowPrice ? Math.round(buyNowPrice * 100) : null,
    quantity || 1, sortOrder || 0);

  res.status(201).json({ data: db.prepare('SELECT * FROM listings WHERE id = ?').get(id) });
}

export function updateListing(req, res) {
  const listing = ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (['claimed', 'sold'].includes(listing.status)) {
    return res.status(400).json({ error: 'Cannot edit a claimed or sold listing' });
  }

  const { title, description, category, condition, startingPrice, buyNowPrice, quantity, sortOrder } = req.body;

  db.prepare(`
    UPDATE listings SET
      title = ?, description = ?, category = ?, condition = ?,
      starting_price = ?, buy_now_price = ?, quantity = ?, sort_order = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? listing.title,
    description ?? listing.description,
    category ?? listing.category,
    condition ?? listing.condition,
    startingPrice ? Math.round(startingPrice * 100) : listing.starting_price,
    buyNowPrice != null ? Math.round(buyNowPrice * 100) : listing.buy_now_price,
    quantity ?? listing.quantity,
    sortOrder ?? listing.sort_order,
    listing.id
  );

  res.json({ data: db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id) });
}

export function deleteListing(req, res) {
  const listing = ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!['pending', 'unsold'].includes(listing.status)) {
    return res.status(400).json({ error: 'Cannot delete this listing' });
  }
  db.prepare('DELETE FROM listings WHERE id = ?').run(listing.id);
  res.json({ data: { message: 'Listing deleted' } });
}

export function activateListing(req, res) {
  const listing = ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(listing.event_id);
  if (event.status !== 'live') return res.status(400).json({ error: 'Event must be live to activate a listing' });

  // Only one listing can be active at a time per event
  db.prepare(`
    UPDATE listings SET status = 'pending', updated_at = datetime('now')
    WHERE event_id = ? AND status = 'active'
  `).run(listing.event_id);

  db.prepare(`
    UPDATE listings SET status = 'active', updated_at = datetime('now') WHERE id = ?
  `).run(listing.id);

  res.json({ data: db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id) });
}

export function deactivateListing(req, res) {
  const listing = ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is not active' });

  db.prepare(`
    UPDATE listings SET status = 'pending', updated_at = datetime('now') WHERE id = ?
  `).run(listing.id);

  res.json({ data: db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id) });
}

export async function uploadImages(req, res) {
  const listing = ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!req.files?.length) return res.status(400).json({ error: 'No images uploaded' });

  const images = [];
  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    try {
      const url = await uploadImage(file.path);
      const id = uuid();
      const currentMax = db.prepare(
        'SELECT COALESCE(MAX(sort_order), -1) AS m FROM listing_images WHERE listing_id = ?'
      ).get(listing.id).m;
      db.prepare('INSERT INTO listing_images (id, listing_id, url, sort_order) VALUES (?, ?, ?, ?)').run(
        id, listing.id, url, currentMax + 1 + i
      );
      images.push({ id, url });
    } finally {
      fs.unlink(file.path, () => {});
    }
  }

  res.status(201).json({ data: images });
}

export async function generateDescription(req, res) {
  const listing = ownsListing(req.user.sub, req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const description = await generateProductDescription(listing.title, {
    category: listing.category,
    condition: listing.condition,
    price: (listing.starting_price / 100).toFixed(2),
  });

  res.json({ data: { description } });
}

export function deleteImage(req, res) {
  const { id, imageId } = req.params;
  const listing = ownsListing(req.user.sub, id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const image = db.prepare('SELECT * FROM listing_images WHERE id = ? AND listing_id = ?').get(imageId, id);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  db.prepare('DELETE FROM listing_images WHERE id = ?').run(imageId);
  res.json({ data: { message: 'Image deleted' } });
}
