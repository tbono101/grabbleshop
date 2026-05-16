import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../models/db.js';

export function getProfile(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password_hash, ...safe } = user;
  res.json({ data: safe });
}

export async function updateProfile(req, res) {
  const { firstName, lastName, phone, avatarUrl, currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
  }

  const passwordHash = newPassword ? await bcrypt.hash(newPassword, 12) : user.password_hash;

  db.prepare(`
    UPDATE users SET
      first_name = ?,
      last_name = ?,
      phone = ?,
      avatar_url = ?,
      password_hash = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    firstName ?? user.first_name,
    lastName ?? user.last_name,
    phone ?? user.phone,
    avatarUrl ?? user.avatar_url,
    passwordHash,
    user.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const { password_hash, ...safe } = updated;
  res.json({ data: safe });
}

export function listAddresses(req, res) {
  const addresses = db
    .prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at ASC')
    .all(req.user.sub);
  res.json({ data: addresses });
}

export function createAddress(req, res) {
  const { label, line1, line2, city, state, zip, country, isDefault } = req.body;
  const id = uuid();

  if (isDefault) {
    db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.sub);
  }

  db.prepare(`
    INSERT INTO addresses (id, user_id, label, line1, line2, city, state, zip, country, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.sub, label || null, line1, line2 || null, city, state, zip, country || 'US', isDefault ? 1 : 0);

  const address = db.prepare('SELECT * FROM addresses WHERE id = ?').get(id);
  res.status(201).json({ data: address });
}

export function updateAddress(req, res) {
  const { id } = req.params;
  const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(id, req.user.sub);
  if (!address) return res.status(404).json({ error: 'Address not found' });

  const { label, line1, line2, city, state, zip, country, isDefault } = req.body;

  if (isDefault) {
    db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.sub);
  }

  db.prepare(`
    UPDATE addresses SET
      label = ?, line1 = ?, line2 = ?, city = ?, state = ?, zip = ?,
      country = ?, is_default = ?
    WHERE id = ?
  `).run(
    label ?? address.label,
    line1 ?? address.line1,
    line2 ?? address.line2,
    city ?? address.city,
    state ?? address.state,
    zip ?? address.zip,
    country ?? address.country,
    isDefault ? 1 : address.is_default,
    id
  );

  res.json({ data: db.prepare('SELECT * FROM addresses WHERE id = ?').get(id) });
}

export function deleteAddress(req, res) {
  const { id } = req.params;
  const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(id, req.user.sub);
  if (!address) return res.status(404).json({ error: 'Address not found' });
  db.prepare('DELETE FROM addresses WHERE id = ?').run(id);
  res.json({ data: { message: 'Address deleted' } });
}

export function setDefaultAddress(req, res) {
  const { id } = req.params;
  const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(id, req.user.sub);
  if (!address) return res.status(404).json({ error: 'Address not found' });

  db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.sub);
  db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(id);

  res.json({ data: db.prepare('SELECT * FROM addresses WHERE id = ?').get(id) });
}

export function getMyOrders(req, res) {
  const orders = db.prepare(`
    SELECT o.*, s.shop_name AS seller_shop_name
    FROM orders o
    JOIN sellers s ON s.id = o.seller_id
    WHERE o.buyer_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user.sub);
  res.json({ data: orders });
}

export function getMyFollows(req, res) {
  const sellers = db.prepare(`
    SELECT s.* FROM sellers s
    JOIN follows f ON f.seller_id = s.id
    WHERE f.buyer_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.sub);
  res.json({ data: sellers });
}
