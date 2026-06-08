#!/usr/bin/env node
/**
 * Creates (or promotes) the super admin account.
 *
 * Usage:
 *   node scripts/create-super-admin.js
 *
 * Set SUPER_ADMIN_PASSWORD env var to choose the password, otherwise
 * a secure random password is generated and printed once.
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

// Import DB after dotenv so DATABASE_URL is set
import('../src/models/db.js').then(async ({ default: db }) => {
  const { runMigrations } = await import('../src/models/schema.js');
  runMigrations();

  const EMAIL = 'tbono101@gmail.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || randomBytes(16).toString('base64url');
  const hash = await bcrypt.hash(password, 12);

  const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(EMAIL);

  if (existing) {
    db.prepare(
      "UPDATE users SET role = 'super_admin', password_hash = ?, is_active = 1, updated_at = datetime('now') WHERE id = ?"
    ).run(hash, existing.id);
    console.log(`\n✓ Updated existing account ${EMAIL} → role: super_admin`);
  } else {
    const id = uuid();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, first_name, last_name, email_verified)
      VALUES (?, ?, ?, 'super_admin', 'Admin', 'GrabbleShop', 1)
    `).run(id, EMAIL, hash);
    console.log(`\n✓ Created super admin account: ${EMAIL}`);
  }

  if (!process.env.SUPER_ADMIN_PASSWORD) {
    console.log(`\n  Password (save this — it won't be shown again):\n  ${password}\n`);
  } else {
    console.log('  Password set from SUPER_ADMIN_PASSWORD env var.\n');
  }

  process.exit(0);
}).catch(err => {
  console.error('Failed to create super admin:', err);
  process.exit(1);
});
