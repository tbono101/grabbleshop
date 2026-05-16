import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from '../models/db.js';

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function createRefreshToken(userId) {
  const token = uuid();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(uuid(), userId, token, expiresAt);
  return token;
}

export async function register(req, res) {
  const { email, password, firstName, lastName, phone } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuid();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase(), passwordHash, firstName, lastName, phone || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const accessToken = signAccess(user);
  const refreshToken = createRefreshToken(id);

  res.status(201).json({
    data: {
      user: safeUser(user),
      accessToken,
      refreshToken,
    },
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const accessToken = signAccess(user);
  const refreshToken = createRefreshToken(user.id);

  res.json({ data: { user: safeUser(user), accessToken, refreshToken } });
}

export function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  const stored = db.prepare(
    "SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime('now')"
  ).get(refreshToken);

  if (!stored) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(stored.user_id);
  if (!user || !user.is_active) return res.status(401).json({ error: 'User not found' });

  // Rotate the refresh token
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  const newRefreshToken = createRefreshToken(user.id);
  const accessToken = signAccess(user);

  res.json({ data: { accessToken, refreshToken: newRefreshToken } });
}

export function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }
  res.json({ data: { message: 'Logged out' } });
}

export function me(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(user.id);
  res.json({ data: { user: safeUser(user), seller: seller || null } });
}

function safeUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}
