import { v4 as uuid } from 'uuid';
import db from '../models/db.js';
import stripe from '../services/stripe.js';

export function listSellers(req, res) {
  const { q, limit = 20, offset = 0 } = req.query;
  const sellers = q
    ? db.prepare(`
        SELECT s.*, u.first_name, u.last_name
        FROM sellers s JOIN users u ON u.id = s.user_id
        WHERE s.is_active = 1 AND (s.shop_name LIKE ? OR s.bio LIKE ?)
        ORDER BY s.total_sales DESC LIMIT ? OFFSET ?
      `).all(`%${q}%`, `%${q}%`, Number(limit), Number(offset))
    : db.prepare(`
        SELECT s.*, u.first_name, u.last_name
        FROM sellers s JOIN users u ON u.id = s.user_id
        WHERE s.is_active = 1
        ORDER BY s.total_sales DESC LIMIT ? OFFSET ?
      `).all(Number(limit), Number(offset));

  res.json({ data: sellers });
}

export function getSeller(req, res) {
  const seller = db.prepare(`
    SELECT s.*, u.first_name, u.last_name, u.avatar_url AS user_avatar
    FROM sellers s JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!seller) return res.status(404).json({ error: 'Seller not found' });

  const reviewStats = db.prepare(`
    SELECT COUNT(*) AS count, AVG(rating) AS avg_rating FROM reviews WHERE seller_id = ?
  `).get(req.params.id);

  const followerCount = db.prepare(
    'SELECT COUNT(*) AS count FROM follows WHERE seller_id = ?'
  ).get(req.params.id);

  res.json({ data: { ...seller, ...reviewStats, follower_count: followerCount.count } });
}

export function getMyStore(req, res) {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  if (!seller) return res.status(404).json({ error: 'No seller account found' });
  res.json({ data: seller });
}

export function createSeller(req, res) {
  const { shopName, bio, instagramHandle, tiktokHandle } = req.body;

  const existing = db.prepare('SELECT id FROM sellers WHERE user_id = ?').get(req.user.sub);
  if (existing) return res.status(409).json({ error: 'Seller account already exists' });

  const nameConflict = db.prepare('SELECT id FROM sellers WHERE shop_name = ?').get(shopName);
  if (nameConflict) return res.status(409).json({ error: 'Shop name already taken' });

  const id = uuid();
  db.prepare(`
    INSERT INTO sellers (id, user_id, shop_name, bio, instagram_handle, tiktok_handle)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user.sub, shopName, bio || null, instagramHandle || null, tiktokHandle || null);

  db.prepare("UPDATE users SET role = 'seller', updated_at = datetime('now') WHERE id = ?")
    .run(req.user.sub);

  res.status(201).json({ data: db.prepare('SELECT * FROM sellers WHERE id = ?').get(id) });
}

export function updateSeller(req, res) {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  if (!seller) return res.status(404).json({ error: 'Seller account not found' });

  const { shopName, bio, instagramHandle, tiktokHandle, avatarUrl, bannerUrl, shippingPolicy } = req.body;

  if (shopName && shopName !== seller.shop_name) {
    const conflict = db.prepare('SELECT id FROM sellers WHERE shop_name = ? AND id != ?').get(shopName, seller.id);
    if (conflict) return res.status(409).json({ error: 'Shop name already taken' });
  }

  db.prepare(`
    UPDATE sellers SET
      shop_name = ?, bio = ?, instagram_handle = ?, tiktok_handle = ?,
      avatar_url = ?, banner_url = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    shopName ?? seller.shop_name,
    bio ?? seller.bio,
    instagramHandle ?? seller.instagram_handle,
    tiktokHandle ?? seller.tiktok_handle,
    avatarUrl ?? seller.avatar_url,
    bannerUrl ?? seller.banner_url,
    seller.id
  );

  res.json({ data: db.prepare('SELECT * FROM sellers WHERE id = ?').get(seller.id) });
}

export async function createStripeOnboardingLink(req, res) {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  if (!seller) return res.status(404).json({ error: 'Seller account not found' });

  let accountId = seller.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      metadata: { seller_id: seller.id, user_id: req.user.sub },
    });
    accountId = account.id;
    db.prepare('UPDATE sellers SET stripe_account_id = ? WHERE id = ?').run(accountId, seller.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.CLIENT_ORIGIN}/dashboard/onboarding?refresh=true`,
    return_url: `${process.env.CLIENT_ORIGIN}/dashboard/onboarding?success=true`,
    type: 'account_onboarding',
  });

  res.json({ data: { url: link.url } });
}

export async function checkStripeStatus(req, res) {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.user.sub);
  if (!seller) return res.status(404).json({ error: 'Seller account not found' });
  if (!seller.stripe_account_id) return res.json({ data: { onboarded: false } });

  const account = await stripe.accounts.retrieve(seller.stripe_account_id);
  const onboarded = account.details_submitted && account.charges_enabled;

  if (onboarded && !seller.stripe_onboarded) {
    db.prepare("UPDATE sellers SET stripe_onboarded = 1, updated_at = datetime('now') WHERE id = ?")
      .run(seller.id);
  }

  res.json({ data: { onboarded, charges_enabled: account.charges_enabled, details_submitted: account.details_submitted } });
}

export function followSeller(req, res) {
  const seller = db.prepare('SELECT id FROM sellers WHERE id = ?').get(req.params.id);
  if (!seller) return res.status(404).json({ error: 'Seller not found' });

  db.prepare('INSERT OR IGNORE INTO follows (buyer_id, seller_id) VALUES (?, ?)').run(req.user.sub, req.params.id);
  res.json({ data: { following: true } });
}

export function unfollowSeller(req, res) {
  db.prepare('DELETE FROM follows WHERE buyer_id = ? AND seller_id = ?').run(req.user.sub, req.params.id);
  res.json({ data: { following: false } });
}

export function getSellerReviews(req, res) {
  const reviews = db.prepare(`
    SELECT r.*, u.first_name, u.last_name, u.avatar_url
    FROM reviews r JOIN users u ON u.id = r.buyer_id
    WHERE r.seller_id = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.params.id, Number(req.query.limit || 20), Number(req.query.offset || 0));
  res.json({ data: reviews });
}
