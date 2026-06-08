import { query, queryOne } from '../models/db.js';

export async function getPlatformFeeRate() {
  const row = await queryOne(
    "SELECT value FROM platform_settings WHERE key = 'platform_fee_rate'"
  );
  return row ? parseFloat(row.value) : 0.01;
}

export async function listUsers(req, res) {
  const { page = 1, limit = 50, role, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const params = [];
  let pIdx = 1;
  let where = '1=1';

  if (role) {
    where += ` AND u.role = $${pIdx++}`;
    params.push(role);
  }
  if (search) {
    where += ` AND (u.email ILIKE $${pIdx} OR u.first_name ILIKE $${pIdx + 1} OR u.last_name ILIKE $${pIdx + 2})`;
    pIdx += 3;
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const countRow = await queryOne(
    `SELECT COUNT(*)::int AS n FROM users u WHERE ${where}`,
    params
  );
  const total = countRow.n;

  const users = await query(
    `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone,
            u.is_active, u.email_verified, u.created_at,
            s.id AS seller_id, s.fee_override
     FROM users u
     LEFT JOIN sellers s ON s.user_id = u.id
     WHERE ${where} ORDER BY u.created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
    [...params, Number(limit), offset]
  );

  res.json({ data: { users, total, page: Number(page), limit: Number(limit) } });
}

export async function getUser(req, res) {
  const user = await queryOne(
    'SELECT id, email, role, first_name, last_name, phone, is_active, email_verified, created_at FROM users WHERE id = $1',
    [req.params.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [user.id]);
  res.json({ data: { user, seller: seller || null } });
}

export async function updateUser(req, res) {
  const { role, is_active } = req.body;
  const user = await queryOne('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'super_admin' && role && role !== 'super_admin') {
    return res.status(403).json({ error: 'Cannot change role of a super admin' });
  }

  const fields = [];
  const params = [];
  let idx = 1;

  if (role !== undefined)      { fields.push(`role = $${idx++}`);      params.push(role); }
  if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); params.push(is_active ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  fields.push('updated_at = NOW()');
  params.push(req.params.id);

  const updated = await queryOne(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, role, first_name, last_name, is_active, email_verified, created_at`,
    params
  );
  res.json({ data: { user: updated } });
}

export async function updateSellerFee(req, res) {
  const seller = await queryOne('SELECT id FROM sellers WHERE id = $1', [req.params.id]);
  if (!seller) return res.status(404).json({ error: 'Seller not found' });

  const { fee_override } = req.body;

  if (fee_override === null || fee_override === undefined) {
    await query(
      "UPDATE sellers SET fee_override = NULL, updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );
  } else {
    const rate = parseFloat(fee_override);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return res.status(400).json({ error: 'fee_override must be between 0 and 1' });
    }
    await query(
      "UPDATE sellers SET fee_override = $1, updated_at = NOW() WHERE id = $2",
      [rate, req.params.id]
    );
  }

  const updated = await queryOne(
    'SELECT id, fee_override FROM sellers WHERE id = $1',
    [req.params.id]
  );
  res.json({ data: updated });
}

export async function listSellers(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const countRow = await queryOne('SELECT COUNT(*)::int AS n FROM sellers');
  const sellers  = await query(
    `SELECT s.*, u.email, u.first_name, u.last_name
     FROM sellers s JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  );

  res.json({ data: { sellers, total: countRow.n, page: Number(page), limit: Number(limit) } });
}

export async function getSettings(req, res) {
  const rows = await query('SELECT key, value FROM platform_settings');
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ data: { settings } });
}

export async function updateSettings(req, res) {
  const { platform_fee_rate } = req.body;

  if (platform_fee_rate !== undefined) {
    const rate = parseFloat(platform_fee_rate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return res.status(400).json({ error: 'platform_fee_rate must be between 0 and 1' });
    }
    await query(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ('platform_fee_rate', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [String(rate)]
    );
  }

  const rows = await query('SELECT key, value FROM platform_settings');
  res.json({ data: { settings: Object.fromEntries(rows.map(r => [r.key, r.value])) } });
}

export async function getStats(req, res) {
  const [totalUsers, totalSellers, totalEvents, totalOrders, pendingOrders, revenueRow] =
    await Promise.all([
      queryOne('SELECT COUNT(*)::int AS n FROM users'),
      queryOne('SELECT COUNT(*)::int AS n FROM sellers'),
      queryOne('SELECT COUNT(*)::int AS n FROM events'),
      queryOne('SELECT COUNT(*)::int AS n FROM orders'),
      queryOne("SELECT COUNT(*)::int AS n FROM orders WHERE status = 'pending_payment'"),
      queryOne("SELECT COALESCE(SUM(total), 0)::bigint AS n FROM orders WHERE status NOT IN ('cancelled','refunded')"),
    ]);

  res.json({
    data: {
      totalUsers:    totalUsers.n,
      totalSellers:  totalSellers.n,
      totalEvents:   totalEvents.n,
      totalOrders:   totalOrders.n,
      pendingOrders: pendingOrders.n,
      totalRevenue:  parseInt(revenueRow.n, 10),
    },
  });
}
