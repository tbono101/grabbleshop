import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../models/db.js';

export async function getProfile(req, res) {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user.sub]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password_hash, ...safe } = user;
  res.json({ data: safe });
}

export async function updateProfile(req, res) {
  const { firstName, lastName, phone, avatarUrl, currentPassword, newPassword } = req.body;
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user.sub]);

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
  }

  const passwordHash = newPassword ? await bcrypt.hash(newPassword, 12) : user.password_hash;

  const updated = await queryOne(
    `UPDATE users SET
       first_name = $1, last_name = $2, phone = $3,
       avatar_url = $4, password_hash = $5, updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [
      firstName ?? user.first_name,
      lastName ?? user.last_name,
      phone ?? user.phone,
      avatarUrl ?? user.avatar_url,
      passwordHash,
      user.id,
    ]
  );
  const { password_hash, ...safe } = updated;
  res.json({ data: safe });
}

export async function listAddresses(req, res) {
  const addresses = await query(
    'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC',
    [req.user.sub]
  );
  res.json({ data: addresses });
}

export async function createAddress(req, res) {
  const { label, line1, line2, city, state, zip, country, isDefault } = req.body;
  const id = uuid();

  if (isDefault) {
    await query('UPDATE addresses SET is_default = 0 WHERE user_id = $1', [req.user.sub]);
  }

  const address = await queryOne(
    `INSERT INTO addresses (id, user_id, label, line1, line2, city, state, zip, country, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [id, req.user.sub, label || null, line1, line2 || null, city, state, zip, country || 'US', isDefault ? 1 : 0]
  );
  res.status(201).json({ data: address });
}

export async function updateAddress(req, res) {
  const { id } = req.params;
  const address = await queryOne(
    'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
    [id, req.user.sub]
  );
  if (!address) return res.status(404).json({ error: 'Address not found' });

  const { label, line1, line2, city, state, zip, country, isDefault } = req.body;

  if (isDefault) {
    await query('UPDATE addresses SET is_default = 0 WHERE user_id = $1', [req.user.sub]);
  }

  const updated = await queryOne(
    `UPDATE addresses SET
       label = $1, line1 = $2, line2 = $3, city = $4, state = $5,
       zip = $6, country = $7, is_default = $8
     WHERE id = $9 RETURNING *`,
    [
      label ?? address.label,
      line1 ?? address.line1,
      line2 ?? address.line2,
      city ?? address.city,
      state ?? address.state,
      zip ?? address.zip,
      country ?? address.country,
      isDefault ? 1 : address.is_default,
      id,
    ]
  );
  res.json({ data: updated });
}

export async function deleteAddress(req, res) {
  const { id } = req.params;
  const address = await queryOne(
    'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
    [id, req.user.sub]
  );
  if (!address) return res.status(404).json({ error: 'Address not found' });
  await query('DELETE FROM addresses WHERE id = $1', [id]);
  res.json({ data: { message: 'Address deleted' } });
}

export async function setDefaultAddress(req, res) {
  const { id } = req.params;
  const address = await queryOne(
    'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
    [id, req.user.sub]
  );
  if (!address) return res.status(404).json({ error: 'Address not found' });

  await query('UPDATE addresses SET is_default = 0 WHERE user_id = $1', [req.user.sub]);
  const updated = await queryOne(
    'UPDATE addresses SET is_default = 1 WHERE id = $1 RETURNING *',
    [id]
  );
  res.json({ data: updated });
}

export async function getMyOrders(req, res) {
  const orders = await query(
    `SELECT o.*, s.shop_name AS seller_shop_name
     FROM orders o JOIN sellers s ON s.id = o.seller_id
     WHERE o.buyer_id = $1 ORDER BY o.created_at DESC`,
    [req.user.sub]
  );
  res.json({ data: orders });
}

export async function getMyFollows(req, res) {
  const sellers = await query(
    `SELECT s.* FROM sellers s
     JOIN follows f ON f.seller_id = s.id
     WHERE f.buyer_id = $1 ORDER BY f.created_at DESC`,
    [req.user.sub]
  );
  res.json({ data: sellers });
}
