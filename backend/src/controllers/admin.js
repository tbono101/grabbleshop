import db from '../models/db.js';

export function getPlatformFeeRate() {
  const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'platform_fee_rate'").get();
  return row ? parseFloat(row.value) : 0.01;
}

export function listUsers(req, res) {
  const { page = 1, limit = 50, role, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = '1=1';
  const params = [];

  if (role) {
    where += ' AND role = ?';
    params.push(role);
  }
  if (search) {
    where += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM users WHERE ${where}`).get(...params).n;
  const users = db.prepare(
    `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone,
            u.is_active, u.email_verified, u.created_at,
            s.id AS seller_id, s.fee_override
     FROM users u
     LEFT JOIN sellers s ON s.user_id = u.id
     WHERE ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, Number(limit), offset);

  res.json({ data: { users, total, page: Number(page), limit: Number(limit) } });
}

export function getUser(req, res) {
  const user = db.prepare(
    'SELECT id, email, role, first_name, last_name, phone, is_active, email_verified, created_at FROM users WHERE id = ?'
  ).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(user.id);
  res.json({ data: { user, seller: seller || null } });
}

export function updateUser(req, res) {
  const { role, is_active } = req.body;
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Prevent demoting another super_admin
  if (user.role === 'super_admin' && role && role !== 'super_admin') {
    return res.status(403).json({ error: 'Cannot change role of a super admin' });
  }

  const fields = [];
  const params = [];
  if (role !== undefined) { fields.push('role = ?'); params.push(role); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare(
    'SELECT id, email, role, first_name, last_name, is_active, email_verified, created_at FROM users WHERE id = ?'
  ).get(req.params.id);

  res.json({ data: { user: updated } });
}

export function updateSellerFee(req, res) {
  const seller = db.prepare('SELECT id FROM sellers WHERE id = ?').get(req.params.id);
  if (!seller) return res.status(404).json({ error: 'Seller not found' });

  const { fee_override } = req.body;

  if (fee_override === null || fee_override === undefined) {
    // Clear override — revert to platform default
    db.prepare("UPDATE sellers SET fee_override = NULL, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  } else {
    const rate = parseFloat(fee_override);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return res.status(400).json({ error: 'fee_override must be between 0 and 1' });
    }
    db.prepare("UPDATE sellers SET fee_override = ?, updated_at = datetime('now') WHERE id = ?").run(rate, req.params.id);
  }

  res.json({ data: db.prepare('SELECT id, fee_override FROM sellers WHERE id = ?').get(req.params.id) });
}

export function listSellers(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const total = db.prepare('SELECT COUNT(*) as n FROM sellers').get().n;
  const sellers = db.prepare(
    `SELECT s.*, u.email, u.first_name, u.last_name
     FROM sellers s JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC LIMIT ? OFFSET ?`
  ).all(Number(limit), offset);

  res.json({ data: { sellers, total, page: Number(page), limit: Number(limit) } });
}

export function getSettings(req, res) {
  const rows = db.prepare('SELECT key, value FROM platform_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ data: { settings } });
}

export function updateSettings(req, res) {
  const { platform_fee_rate } = req.body;

  if (platform_fee_rate !== undefined) {
    const rate = parseFloat(platform_fee_rate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return res.status(400).json({ error: 'platform_fee_rate must be between 0 and 1' });
    }
    db.prepare(
      "INSERT INTO platform_settings (key, value, updated_at) VALUES ('platform_fee_rate', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).run(String(rate));
  }

  const rows = db.prepare('SELECT key, value FROM platform_settings').all();
  res.json({ data: { settings: Object.fromEntries(rows.map(r => [r.key, r.value])) } });
}

export function getStats(req, res) {
  const totalUsers    = db.prepare("SELECT COUNT(*) as n FROM users").get().n;
  const totalSellers  = db.prepare("SELECT COUNT(*) as n FROM sellers").get().n;
  const totalEvents   = db.prepare("SELECT COUNT(*) as n FROM events").get().n;
  const totalOrders   = db.prepare("SELECT COUNT(*) as n FROM orders").get().n;
  const pendingOrders = db.prepare("SELECT COUNT(*) as n FROM orders WHERE status = 'pending_payment'").get().n;
  const totalRevenue  = db.prepare("SELECT COALESCE(SUM(total),0) as n FROM orders WHERE status NOT IN ('cancelled','refunded')").get().n;

  res.json({ data: { totalUsers, totalSellers, totalEvents, totalOrders, pendingOrders, totalRevenue } });
}
