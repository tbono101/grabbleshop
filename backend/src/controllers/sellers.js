import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../models/db.js';
import stripe from '../services/stripe.js';

export async function listSellers(req, res) {
  const { q, limit = 20, offset = 0 } = req.query;
  const sellers = q
    ? await query(
        `SELECT s.*, u.first_name, u.last_name FROM sellers s
         JOIN users u ON u.id = s.user_id
         WHERE s.is_active = 1 AND (s.shop_name ILIKE $1 OR s.bio ILIKE $2)
         ORDER BY s.total_sales DESC LIMIT $3 OFFSET $4`,
        [`%${q}%`, `%${q}%`, Number(limit), Number(offset)]
      )
    : await query(
        `SELECT s.*, u.first_name, u.last_name FROM sellers s
         JOIN users u ON u.id = s.user_id
         WHERE s.is_active = 1
         ORDER BY s.total_sales DESC LIMIT $1 OFFSET $2`,
        [Number(limit), Number(offset)]
      );
  res.json({ data: sellers });
}

export async function getSeller(req, res) {
  const seller = await queryOne(
    `SELECT s.*, u.first_name, u.last_name, u.avatar_url AS user_avatar
     FROM sellers s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [req.params.id]
  );
  if (!seller) return res.status(404).json({ error: 'Seller not found' });

  const reviewStats = await queryOne(
    'SELECT COUNT(*)::int AS count, AVG(rating) AS avg_rating FROM reviews WHERE seller_id = $1',
    [req.params.id]
  );
  const followerCount = await queryOne(
    'SELECT COUNT(*)::int AS count FROM follows WHERE seller_id = $1',
    [req.params.id]
  );

  res.json({ data: { ...seller, ...reviewStats, follower_count: followerCount.count } });
}

export async function getMyStore(req, res) {
  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (!seller) return res.status(404).json({ error: 'No seller account found' });
  res.json({ data: seller });
}

export async function createSeller(req, res) {
  const { shopName, bio, instagramHandle, tiktokHandle } = req.body;

  const existing = await queryOne('SELECT id FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (existing) return res.status(409).json({ error: 'Seller account already exists' });

  const nameConflict = await queryOne('SELECT id FROM sellers WHERE shop_name = $1', [shopName]);
  if (nameConflict) return res.status(409).json({ error: 'Shop name already taken' });

  const id = uuid();
  const seller = await queryOne(
    `INSERT INTO sellers (id, user_id, shop_name, bio, instagram_handle, tiktok_handle)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, req.user.sub, shopName, bio || null, instagramHandle || null, tiktokHandle || null]
  );

  await query(
    "UPDATE users SET role = 'seller', updated_at = NOW() WHERE id = $1",
    [req.user.sub]
  );

  res.status(201).json({ data: seller });
}

export async function updateSeller(req, res) {
  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (!seller) return res.status(404).json({ error: 'Seller account not found' });

  const { shopName, bio, instagramHandle, tiktokHandle, avatarUrl, bannerUrl } = req.body;

  if (shopName && shopName !== seller.shop_name) {
    const conflict = await queryOne(
      'SELECT id FROM sellers WHERE shop_name = $1 AND id != $2',
      [shopName, seller.id]
    );
    if (conflict) return res.status(409).json({ error: 'Shop name already taken' });
  }

  const updated = await queryOne(
    `UPDATE sellers SET
       shop_name = $1, bio = $2, instagram_handle = $3, tiktok_handle = $4,
       avatar_url = $5, banner_url = $6, updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [
      shopName ?? seller.shop_name,
      bio ?? seller.bio,
      instagramHandle ?? seller.instagram_handle,
      tiktokHandle ?? seller.tiktok_handle,
      avatarUrl ?? seller.avatar_url,
      bannerUrl ?? seller.banner_url,
      seller.id,
    ]
  );
  res.json({ data: updated });
}

export async function createStripeOnboardingLink(req, res) {
  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (!seller) return res.status(404).json({ error: 'Seller account not found' });

  const origin = (process.env.CLIENT_ORIGIN || '').split(',')[0].trim()
    || `${req.protocol}://${req.get('host')}`;

  let accountId = seller.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      metadata: { seller_id: seller.id, user_id: req.user.sub },
    });
    accountId = account.id;
    await query(
      'UPDATE sellers SET stripe_account_id = $1 WHERE id = $2',
      [accountId, seller.id]
    );
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/onboarding?refresh=true`,
    return_url:  `${origin}/dashboard/onboarding?success=true`,
    type: 'account_onboarding',
  });

  res.json({ data: { url: link.url } });
}

export async function checkStripeStatus(req, res) {
  const seller = await queryOne('SELECT * FROM sellers WHERE user_id = $1', [req.user.sub]);
  if (!seller) return res.status(404).json({ error: 'Seller account not found' });
  if (!seller.stripe_account_id) return res.json({ data: { onboarded: false } });

  const account = await stripe.accounts.retrieve(seller.stripe_account_id);
  const onboarded = account.details_submitted && account.charges_enabled;

  if (onboarded && !seller.stripe_onboarded) {
    await query(
      "UPDATE sellers SET stripe_onboarded = 1, updated_at = NOW() WHERE id = $1",
      [seller.id]
    );
  }

  res.json({ data: { onboarded, charges_enabled: account.charges_enabled, details_submitted: account.details_submitted } });
}

export async function followSeller(req, res) {
  const seller = await queryOne('SELECT id FROM sellers WHERE id = $1', [req.params.id]);
  if (!seller) return res.status(404).json({ error: 'Seller not found' });

  await query(
    'INSERT INTO follows (buyer_id, seller_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.user.sub, req.params.id]
  );
  res.json({ data: { following: true } });
}

export async function unfollowSeller(req, res) {
  await query(
    'DELETE FROM follows WHERE buyer_id = $1 AND seller_id = $2',
    [req.user.sub, req.params.id]
  );
  res.json({ data: { following: false } });
}

export async function getSellerReviews(req, res) {
  const reviews = await query(
    `SELECT r.*, u.first_name, u.last_name, u.avatar_url
     FROM reviews r JOIN users u ON u.id = r.buyer_id
     WHERE r.seller_id = $1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
    [req.params.id, Number(req.query.limit || 20), Number(req.query.offset || 0)]
  );
  res.json({ data: reviews });
}
