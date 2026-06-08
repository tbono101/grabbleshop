#!/usr/bin/env node
/**
 * Creates (or promotes) the super admin account.
 *
 * Usage:
 *   node scripts/create-super-admin.js
 *
 * Set SUPER_ADMIN_PASSWORD env var to choose the password; otherwise
 * a secure random password is generated and printed once.
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import pg from 'pg';

const { Pool } = pg;

const isLocal =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const EMAIL = 'tbono101@gmail.com';
const password = process.env.SUPER_ADMIN_PASSWORD || randomBytes(16).toString('base64url');
const hash = await bcrypt.hash(password, 12);

const { rows: [existing] } = await pool.query(
  'SELECT id, role FROM users WHERE email = $1',
  [EMAIL]
);

if (existing) {
  await pool.query(
    "UPDATE users SET role = 'super_admin', password_hash = $1, is_active = 1, updated_at = NOW() WHERE id = $2",
    [hash, existing.id]
  );
  console.log(`\n✓ Updated existing account ${EMAIL} → role: super_admin`);
} else {
  const id = uuid();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name, email_verified)
     VALUES ($1, $2, $3, 'super_admin', 'Admin', 'GrabbleShop', 1)`,
    [id, EMAIL, hash]
  );
  console.log(`\n✓ Created super admin account: ${EMAIL}`);
}

if (!process.env.SUPER_ADMIN_PASSWORD) {
  console.log(`\n  Password (save this — it won't be shown again):\n  ${password}\n`);
} else {
  console.log('  Password set from SUPER_ADMIN_PASSWORD env var.\n');
}

await pool.end();
process.exit(0);
