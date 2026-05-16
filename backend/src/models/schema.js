import db from './db.js';

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer',
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      stripe_customer_id TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT,
      line1 TEXT NOT NULL,
      line2 TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'US',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sellers (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_name TEXT UNIQUE NOT NULL,
      bio TEXT,
      avatar_url TEXT,
      banner_url TEXT,
      instagram_handle TEXT,
      tiktok_handle TEXT,
      commission_rate REAL NOT NULL DEFAULT 0.10,
      stripe_account_id TEXT,
      stripe_onboarded INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      total_sales INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      started_at TEXT,
      ended_at TEXT,
      stream_url TEXT,
      cover_image_url TEXT,
      shipping_policy TEXT,
      payment_deadline_hours INTEGER NOT NULL DEFAULT 24,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL REFERENCES sellers(id),
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      condition TEXT NOT NULL DEFAULT 'new',
      starting_price INTEGER NOT NULL,
      buy_now_price INTEGER,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listing_images (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      buyer_id TEXT NOT NULL REFERENCES users(id),
      event_id TEXT NOT NULL REFERENCES events(id),
      price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES users(id),
      seller_id TEXT NOT NULL REFERENCES sellers(id),
      event_id TEXT REFERENCES events(id),
      status TEXT NOT NULL DEFAULT 'pending_payment',
      subtotal INTEGER NOT NULL,
      tax_amount INTEGER NOT NULL DEFAULT 0,
      shipping_amount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      shipping_address_id TEXT REFERENCES addresses(id),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      buyer_id TEXT NOT NULL REFERENCES users(id),
      stripe_payment_intent_id TEXT UNIQUE,
      stripe_session_id TEXT UNIQUE,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES sellers(id),
      order_id TEXT NOT NULL REFERENCES orders(id),
      stripe_transfer_id TEXT UNIQUE,
      gross_amount INTEGER NOT NULL,
      commission_amount INTEGER NOT NULL,
      net_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL REFERENCES orders(id),
      easypost_shipment_id TEXT,
      easypost_tracker_id TEXT,
      carrier TEXT,
      tracking_number TEXT,
      label_url TEXT,
      estimated_delivery TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      template TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follows (
      buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (buyer_id, seller_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES sellers(id),
      buyer_id TEXT NOT NULL REFERENCES users(id),
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      body TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_addresses_user      ON addresses(user_id);
    CREATE INDEX IF NOT EXISTS idx_sellers_user        ON sellers(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_seller       ON events(seller_id);
    CREATE INDEX IF NOT EXISTS idx_events_status       ON events(status);
    CREATE INDEX IF NOT EXISTS idx_listings_event      ON listings(event_id);
    CREATE INDEX IF NOT EXISTS idx_listings_status     ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_claims_buyer        ON claims(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_claims_listing      ON claims(listing_id);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer        ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller       ON orders(seller_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_payments_order      ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_shipments_order     ON shipments(order_id);
    CREATE INDEX IF NOT EXISTS idx_follows_seller      ON follows(seller_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_seller      ON reviews(seller_id);
  `);

  console.log('Database migrations complete.');
}
