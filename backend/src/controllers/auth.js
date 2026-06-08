import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../models/db.js';

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

async function createRefreshToken(userId) {
  const token = uuid();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
    [uuid(), userId, token, expiresAt]
  );
  return token;
}

export async function register(req, res) {
  const { email, password, firstName, lastName, phone } = req.body;

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuid();

  const user = await queryOne(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, phone)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, email.toLowerCase(), passwordHash, firstName, lastName, phone || null]
  );

  const accessToken = signAccess(user);
  const refreshToken = await createRefreshToken(id);

  res.status(201).json({ data: { user: safeUser(user), accessToken, refreshToken } });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await queryOne('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const accessToken = signAccess(user);
  const refreshToken = await createRefreshToken(user.id);

  res.json({ data: { user: safeUser(user), accessToken, refreshToken } });
}

export async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  const stored = await queryOne(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [refreshToken]
  );
  if (!stored) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  const user = await queryOne('SELECT * FROM users WHERE id = $1', [stored.user_id]);
  if (!user || !user.is_active) return res.status(401).json({ error: 'User not found' });

  await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  const newRefreshToken = await createRefreshToken(user.id);
  const accessToken = signAccess(user);

  res.json({ data: { accessToken, refreshToken: newRefreshToken } });
}

export async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  }
  res.json({ data: { message: 'Logged out' } });
}

export async function me(req, res) {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user.sub]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [user.id]);
  res.json({ data: { user: safeUser(user), seller: seller || null } });
}

function safeUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}
