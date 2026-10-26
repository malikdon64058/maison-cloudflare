-- Maison schema for Cloudflare D1 (SQLite). Money is integer cents only.
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, description TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE, category_id INTEGER REFERENCES categories(id),
  description TEXT DEFAULT '', specs TEXT DEFAULT '{}', price_cents INTEGER NOT NULL,
  sale_price_cents INTEGER, stock INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0,
  image_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  rating_avg REAL NOT NULL DEFAULT 0, rating_count INTEGER NOT NULL DEFAULT 0, sales_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS variants (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id), name TEXT NOT NULL, sku TEXT NOT NULL UNIQUE, price_delta_cents INTEGER NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, type TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 0, min_subtotal_cents INTEGER NOT NULL DEFAULT 0, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, expires_at TEXT);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS password_resets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), label TEXT DEFAULT '', line1 TEXT NOT NULL, city TEXT NOT NULL, state TEXT DEFAULT '', zip TEXT NOT NULL, country TEXT NOT NULL DEFAULT 'US');
CREATE TABLE IF NOT EXISTS carts (token TEXT PRIMARY KEY, user_id INTEGER, coupon_code TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS cart_items (id INTEGER PRIMARY KEY AUTOINCREMENT, cart_token TEXT REFERENCES carts(token), product_id INTEGER REFERENCES products(id), variant_id INTEGER REFERENCES variants(id), qty INTEGER NOT NULL DEFAULT 1, UNIQUE(cart_token, product_id, variant_id));
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL UNIQUE, user_id INTEGER, email TEXT NOT NULL, customer_name TEXT NOT NULL,
  ship_line1 TEXT NOT NULL, ship_city TEXT NOT NULL, ship_state TEXT DEFAULT '', ship_zip TEXT NOT NULL, ship_country TEXT NOT NULL DEFAULT 'US',
  shipping_method TEXT NOT NULL, shipping_cents INTEGER NOT NULL, subtotal_cents INTEGER NOT NULL, discount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL, coupon_code TEXT, status TEXT NOT NULL DEFAULT 'confirmed',
  payment_status TEXT NOT NULL DEFAULT 'paid_test', fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled',
  carrier TEXT, tracking_number TEXT, admin_notes TEXT DEFAULT '', refund_reason TEXT DEFAULT '',
  idempotency_key TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER REFERENCES orders(id), product_id INTEGER, product_name TEXT NOT NULL, sku TEXT NOT NULL, variant_name TEXT, qty INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id), user_id INTEGER REFERENCES users(id), author_name TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), title TEXT DEFAULT '', body TEXT NOT NULL, verified_purchase INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'approved', created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(product_id, user_id));
CREATE TABLE IF NOT EXISTS wishlist (user_id INTEGER REFERENCES users(id), product_id INTEGER REFERENCES products(id), PRIMARY KEY(user_id, product_id));
CREATE TABLE IF NOT EXISTS newsletter (email TEXT PRIMARY KEY, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS contact_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT DEFAULT '', body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS content_pages (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, body TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, email TEXT, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS inventory_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id), variant_id INTEGER, delta INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS product_media (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id), kind TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, url TEXT NOT NULL, data_url TEXT, sort INTEGER NOT NULL DEFAULT 0, is_main INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(number);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
INSERT OR IGNORE INTO settings(key, value) VALUES
  ('tax_rate_percent','8'),('free_shipping_threshold_cents','15000'),
  ('store_name','Maison'),('payments_mode','TEST_MODE'),
  ('email_provider','not_connected'),
  ('email_note','Transactional email is not connected. Order updates are stored as in-app notifications. Connect a provider in settings before real launch.'),
  ('payments_note','TEST MODE: no live payment provider is connected. Do not treat paid_test as real money.');
INSERT OR IGNORE INTO content_pages(slug, title, body) VALUES
  ('about','About Maison','Maison is a home-goods store: ceramics, textiles, lighting, furniture and kitchen & dining, made to be lived with.'),
  ('shipping','Shipping & Returns','Standard $6.95, express $18.99, pickup free. Standard shipping is free on orders of $150 or more (before tax).'),
  ('privacy','Privacy','We store only what an order needs. No card numbers or CVV are ever stored.');
