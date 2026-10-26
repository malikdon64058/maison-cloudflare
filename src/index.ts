import { Hono } from 'hono';
import { Env, json, err, uid, b64, unb64, sha256Hex, hashPassword, newSalt, getSetting, audit, gallery, placeholderSvg, quoteTotals, recomputeRating, authUser, requireAdmin, isValidEmail } from './util';

type C = { Bindings: Env };
const app = new Hono<C>();
const ok = (data: any) => json({ ok: true, ...data });

// ---------- helpers ----------
async function productView(env: Env, p: any) {
  const variants = await env.DB.prepare('SELECT id,name,sku,price_delta_cents AS priceDeltaCents,stock FROM variants WHERE product_id=?').bind(p.id).all();
  const media = await env.DB.prepare('SELECT id,kind,filename,mime_type AS mimeType,size_bytes AS sizeBytes,url,sort,is_main AS isMain FROM product_media WHERE product_id=? ORDER BY sort ASC, id ASC').bind(p.id).all();
  const reviews = await env.DB.prepare("SELECT id,author_name AS authorName,rating,title,body,verified_purchase AS verifiedPurchase,created_at AS createdAt FROM reviews WHERE product_id=? AND status='approved' ORDER BY created_at DESC").bind(p.id).all();
  return { ...p, priceCents: p.price_cents, salePriceCents: p.sale_price_cents, categoryId: p.category_id, categoryName: p.category_name, imageKey: p.image_key, ratingAvg: p.rating_avg, ratingCount: p.rating_count, salesCount: p.sales_count, images: gallery(p.image_key), media: media.results, variants: variants.results, reviews: reviews.results };
}
async function getCart(env: Env, token: string) {
  await env.DB.prepare('INSERT OR IGNORE INTO carts(token) VALUES(?)').bind(token).run();
  const items = await env.DB.prepare(`SELECT ci.id AS itemId, ci.product_id AS productId, ci.variant_id AS variantId, ci.qty, p.name AS productName, p.slug, p.image_key AS imageKey, p.price_cents AS basePrice, p.sale_price_cents AS salePrice, v.name AS variantName, v.price_delta_cents AS priceDelta, v.sku AS variantSku, p.sku AS productSku, COALESCE(v.stock, p.stock) AS stock FROM cart_items ci JOIN products p ON p.id=ci.product_id LEFT JOIN variants v ON v.id=ci.variant_id WHERE ci.cart_token=?`).bind(token).all();
  const cart = await env.DB.prepare('SELECT coupon_code AS couponCode FROM carts WHERE token=?').bind(token).first<any>();
  let subtotal = 0;
  const lines = items.results.map((i: any) => {
    const unit = (i.salePrice ?? i.basePrice) + (i.priceDelta || 0);
    subtotal += unit * i.qty;
    return { ...i, unitPriceCents: unit, sku: i.variantSku || i.productSku };
  });
  return { cartToken: token, couponCode: cart?.couponCode || null, lines, subtotalCents: subtotal };
}

// ---------- public: catalogue ----------
app.get('/api/categories', async (c) => {
  const r = await c.env.DB.prepare('SELECT id,name,slug FROM categories ORDER BY id').all();
  return ok({ categories: r.results });
});
app.get('/api/products', async (c) => {
  const q = c.req.query();
  const page = Math.max(1, parseInt(q.page || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(q.pageSize || '12', 10)));
  const where: string[] = ["p.status='active'"]; const binds: any[] = [];
  if (q.category) { const cat = await c.env.DB.prepare('SELECT id FROM categories WHERE slug=?').bind(q.category).first<any>(); if (cat) { where.push('p.category_id=?'); binds.push(cat.id); } }
  if (q.search) { where.push('(p.name LIKE ? OR p.description LIKE ?)'); binds.push(`%${q.search}%`, `%${q.search}%`); }
  if (q.featured === '1') where.push('p.featured=1');
  const sort = q.sort === 'price_asc' ? 'COALESCE(p.sale_price_cents,p.price_cents) ASC' : q.sort === 'price_desc' ? 'COALESCE(p.sale_price_cents,p.price_cents) DESC' : q.sort === 'rating' ? 'p.rating_avg DESC' : q.sort === 'name' ? 'p.name ASC' : 'p.id ASC';
  const total = await c.env.DB.prepare(`SELECT COUNT(*) n FROM products p WHERE ${where.join(' AND ')}`).bind(...binds).first<any>();
  const rows = await c.env.DB.prepare(`SELECT p.*, cat.name AS category_name FROM products p LEFT JOIN categories cat ON cat.id=p.category_id WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT ? OFFSET ?`).bind(...binds, pageSize, (page - 1) * pageSize).all();
  const products = [] as any[]; for (const p of rows.results) products.push(await productView(c.env, p));
  return ok({ products, total: total.n, page, pageSize });
});
app.get('/api/products/:slug', async (c) => {
  const p = await c.env.DB.prepare('SELECT p.*, cat.name AS category_name FROM products p LEFT JOIN categories cat ON cat.id=p.category_id WHERE p.slug=?').bind(c.req.param('slug')).first<any>();
  if (!p) return err('Product not found', 404);
  return ok({ product: await productView(c.env, p) });
});
app.get('/api/search', async (c) => {
  const q = c.req.query('q') || '';
  const rows = await c.env.DB.prepare('SELECT id,name,slug,price_cents AS priceCents,sale_price_cents AS salePriceCents FROM products WHERE status="active" AND name LIKE ? LIMIT 8').bind(`%${q}%`).all();
  return ok({ suggestions: rows.results });
});
app.get('/api/placeholder', async (c) => {
  const key = c.req.query('key') || 'maison'; const view = c.req.query('view') || 'main';
  return new Response(placeholderSvg(key, view), { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
});
app.get('/api/pages/:slug', async (c) => {
  const p = await c.env.DB.prepare('SELECT slug,title,body FROM content_pages WHERE slug=?').bind(c.req.param('slug')).first<any>();
  return p ? ok({ page: p }) : err('Page not found', 404);
});
app.get('/api/settings-public', async (c) => {
  const tax = await getSetting(c.env, 'tax_rate_percent', '8');
  return ok({ taxRatePercent: parseInt(tax, 10), paymentsMode: 'TEST_MODE' });
});

// ---------- cart ----------
app.post('/api/cart/add', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const token = b.cartToken || uid('cart_');
  const p = await c.env.DB.prepare('SELECT * FROM products WHERE id=? AND status="active"').bind(b.productId).first<any>();
  if (!p) return err('Product not found', 404);
  let stock = p.stock, delta = 0;
  if (b.variantId) { const v = await c.env.DB.prepare('SELECT * FROM variants WHERE id=? AND product_id=?').bind(b.variantId, p.id).first<any>(); if (!v) return err('Variant not found', 404); stock = v.stock; delta = v.price_delta_cents; }
  if (stock <= 0) return err('This item is out of stock.', 400);
  const qty = Math.min(Math.max(1, parseInt(b.qty || '1', 10)), stock);
  await c.env.DB.prepare('INSERT OR IGNORE INTO carts(token) VALUES(?)').bind(token).run();
  await c.env.DB.prepare('INSERT INTO cart_items(cart_token,product_id,variant_id,qty) VALUES(?,?,?,?) ON CONFLICT(cart_token,product_id,variant_id) DO UPDATE SET qty=MIN(qty+excluded.qty, ?)').bind(token, p.id, b.variantId || null, qty, stock).run();
  void delta; return ok({ cart: await getCart(c.env, token), message: 'Added to bag.' });
});
app.get('/api/cart', async (c) => ok({ cart: await getCart(c.env, c.req.query('cartToken') || '') }));
app.post('/api/cart/update', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  if (b.qty <= 0) await c.env.DB.prepare('DELETE FROM cart_items WHERE id=? AND cart_token=?').bind(b.itemId, b.cartToken).run();
  else await c.env.DB.prepare('UPDATE cart_items SET qty=? WHERE id=? AND cart_token=?').bind(b.qty, b.itemId, b.cartToken).run();
  return ok({ cart: await getCart(c.env, b.cartToken) });
});
app.post('/api/cart/coupon', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const cp = await c.env.DB.prepare('SELECT * FROM coupons WHERE code=? AND active=1').bind(b.code).first<any>();
  if (!cp) return err('Coupon not found.', 400);
  await c.env.DB.prepare('INSERT OR IGNORE INTO carts(token) VALUES(?)').bind(b.cartToken).run();
  await c.env.DB.prepare('UPDATE carts SET coupon_code=? WHERE token=?').bind(b.code, b.cartToken).run();
  return ok({ message: `Coupon ${b.code} applied.` });
});
app.post('/api/cart/clear', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('DELETE FROM cart_items WHERE cart_token=?').bind(b.cartToken).run();
  await c.env.DB.prepare('UPDATE carts SET coupon_code=NULL WHERE token=?').bind(b.cartToken).run();
  return ok({ cart: await getCart(c.env, b.cartToken) });
});

// ---------- checkout ----------
app.post('/api/checkout/quote', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const cart = await getCart(c.env, b.cartToken || '');
  const t = await quoteTotals(c.env, cart.subtotalCents, cart.couponCode, b.shippingMethod || 'standard');
  return ok({ subtotalCents: cart.subtotalCents, ...t });
});
app.post('/api/checkout/place', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  if (!b.idempotencyKey || b.idempotencyKey.length < 8) return err('idempotencyKey required', 400);
  const existing = await c.env.DB.prepare('SELECT * FROM orders WHERE idempotency_key=?').bind(b.idempotencyKey).first<any>();
  if (existing) return ok({ order: existing, message: 'Order placed.' });
  if (!isValidEmail(b.email || '')) return err('Valid email required', 400);
  if (!b.cardNumber || b.cardNumber.replace(/\D/g, '').length < 12) return err('Test card number required (never stored)', 400);
  // TEST MODE: card number / CVV are validated for format only and never stored.
  const cart = await getCart(c.env, b.cartToken || '');
  if (!cart.lines.length) return err('Cart is empty', 400);
  const t = await quoteTotals(c.env, cart.subtotalCents, cart.couponCode, b.shippingMethod);
  const count = await c.env.DB.prepare('SELECT COUNT(*) n FROM orders').bind().first<any>();
  const number = `MSN-${1001 + count.n}`;
  const user = b.sessionToken ? (await c.env.DB.prepare('SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime("now")').bind(b.sessionToken).first<any>()) || (await authUser(c.env, c.req.raw)) : (await authUser(c.env, c.req.raw));
  const res = await c.env.DB.prepare(`INSERT INTO orders(number,user_id,email,customer_name,ship_line1,ship_city,ship_state,ship_zip,ship_country,shipping_method,shipping_cents,subtotal_cents,discount_cents,tax_cents,total_cents,coupon_code,status,payment_status,fulfillment_status,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(number, user?.id || null, b.email, b.name, b.shipLine1, b.shipCity, b.shipState || '', b.shipZip, b.shipCountry || 'US', b.shippingMethod, t.shippingCents, cart.subtotalCents, t.discountCents, t.taxCents, t.totalCents, cart.couponCode, 'confirmed', 'paid_test', 'unfulfilled', b.idempotencyKey).run();
  const orderId = res.meta.last_row_id;
  for (const line of cart.lines) {
    await c.env.DB.prepare('INSERT INTO order_items(order_id,product_id,product_name,sku,variant_name,qty,unit_price_cents) VALUES(?,?,?,?,?,?,?)').bind(orderId, line.productId, line.productName, line.sku, line.variantName || null, line.qty, line.unitPriceCents).run();
    const prod = await c.env.DB.prepare('SELECT stock FROM products WHERE id=?').bind(line.productId).first<any>();
    if (line.variantId) await c.env.DB.prepare('UPDATE variants SET stock=MAX(0,stock-?) WHERE id=?').bind(line.qty, line.variantId).run();
    await c.env.DB.prepare('UPDATE products SET stock=MAX(0,stock-?), sales_count=sales_count+? WHERE id=?').bind(line.qty, line.qty, line.productId).run();
    await c.env.DB.prepare('INSERT INTO inventory_movements(product_id,variant_id,delta,reason) VALUES(?,?,?,?)').bind(line.productId, line.variantId || null, -line.qty, `order ${number}`).run();
    void prod;
  }
  if (cart.couponCode) await c.env.DB.prepare('UPDATE coupons SET used_count=used_count+1 WHERE code=?').bind(cart.couponCode).run();
  await c.env.DB.prepare('DELETE FROM cart_items WHERE cart_token=?').bind(b.cartToken).run();
  await c.env.DB.prepare('UPDATE carts SET coupon_code=NULL WHERE token=?').bind(b.cartToken).run();
  await audit(c.env, b.email, 'order_placed', number);
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<any>();
  return ok({ order, message: 'Order placed.' });
});
app.get('/api/orders/lookup', async (c) => {
  const number = c.req.query('number') || ''; const email = c.req.query('email') || '';
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE number=? AND email=?').bind(number, email).first<any>();
  if (!o) return ok({ order: null });
  const items = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id=?').bind(o.id).all();
  return ok({ order: { ...o, items: items.results } });
});

// ---------- auth & account ----------
app.post('/api/auth/register', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  if (!isValidEmail(b.email || '') || !b.password || b.password.length < 8) return err('Valid email and a password of 8+ characters are required', 400);
  const salt = newSalt(); const hash = await hashPassword(b.password, salt);
  try {
    const r = await c.env.DB.prepare('INSERT INTO users(email,name,role,password_hash,password_salt) VALUES(?,?,?, ?,?)').bind(b.email, b.name || 'Customer', 'customer', hash, salt).run();
    const token = uid('sess_'); const exp = new Date(Date.now() + 30 * 86400e3).toISOString();
    await c.env.DB.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').bind(token, r.meta.last_row_id, exp).run();
    return ok({ sessionToken: token, user: { id: r.meta.last_row_id, email: b.email, name: b.name || 'Customer', role: 'customer' }, message: 'Account created.' });
  } catch { return err('That email is already registered', 400); }
});
app.post('/api/auth/login', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const u = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(b.email).first<any>();
  if (!u || u.status !== 'active') return err('Email or password is incorrect.', 401);
  const hash = await hashPassword(b.password || '', u.password_salt);
  if (hash !== u.password_hash) return err('Email or password is incorrect.', 401);
  const token = uid('sess_'); const exp = new Date(Date.now() + 30 * 86400e3).toISOString();
  await c.env.DB.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').bind(token, u.id, exp).run();
  return ok({ sessionToken: token, user: { id: u.id, email: u.email, name: u.name, role: u.role }, message: 'Signed in.' });
});
app.post('/api/auth/logout', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  if (b.sessionToken) await c.env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(b.sessionToken).run();
  return ok({ message: 'Signed out.' });
});
app.get('/api/auth/me', async (c) => {
  const u = await authUser(c.env, c.req.raw); return u ? ok({ user: u }) : err('Not signed in', 401);
});
app.post('/api/auth/change-password', async (c) => {
  const u = await authUser(c.env, c.req.raw); if (!u) return err('Not signed in', 401);
  const b: any = await c.req.json().catch(() => ({}));
  const full = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first<any>();
  if ((await hashPassword(b.currentPassword || '', full.password_salt)) !== full.password_hash) return err('Current password is incorrect', 400);
  const salt = newSalt(); const hash = await hashPassword(b.newPassword, salt);
  await c.env.DB.prepare('UPDATE users SET password_hash=?, password_salt=? WHERE id=?').bind(hash, salt, u.id).run();
  return ok({ message: 'Password changed.' });
});
app.post('/api/auth/request-reset', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const u = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(b.email).first<any>();
  if (u) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exp = new Date(Date.now() + 30 * 60e3).toISOString();
    await c.env.DB.prepare('INSERT INTO password_resets(user_id,code_hash,expires_at) VALUES(?,?,?)').bind(u.id, await sha256Hex(code), exp).run();
    // No email provider is connected (see README). The code is stored as a notification
    // for the account holder and, in local development, can be retrieved from the
    // notifications table by an operator. Never return it to an unauthenticated caller.
    await c.env.DB.prepare('INSERT INTO notifications(user_id,email,message) VALUES(?,?,?)').bind(u.id, u.email, `Password reset requested. Your code is ${code} (valid 30 minutes).`).run();
  }
  return ok({ message: 'If an account exists for that email, a reset code has been issued.' });
});
app.post('/api/auth/reset-password', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  const u = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(b.email).first<any>();
  if (!u) return err('Reset code is invalid or expired', 400);
  const r = await c.env.DB.prepare('SELECT * FROM password_resets WHERE user_id=? AND code_hash=? AND used=0 AND expires_at>datetime("now") ORDER BY id DESC LIMIT 1').bind(u.id, await sha256Hex(b.code || '')).first<any>();
  if (!r) return err('Reset code is invalid or expired', 400);
  const salt = newSalt(); const hash = await hashPassword(b.newPassword, salt);
  await c.env.DB.prepare('UPDATE users SET password_hash=?, password_salt=? WHERE id=?').bind(hash, salt, u.id).run();
  await c.env.DB.prepare('UPDATE password_resets SET used=1 WHERE id=?').bind(r.id).run();
  return ok({ message: 'Password reset. Please sign in with your new password.' });
});
app.get('/api/account/orders', async (c) => {
  const u = await authUser(c.env, c.req.raw); if (!u) return err('Not signed in', 401);
  const r = await c.env.DB.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').bind(u.id).all();
  return ok({ orders: r.results });
});
app.get('/api/account/addresses', async (c) => {
  const u = await authUser(c.env, c.req.raw); if (!u) return err('Not signed in', 401);
  const r = await c.env.DB.prepare('SELECT * FROM addresses WHERE user_id=?').bind(u.id).all(); return ok({ addresses: r.results });
});
app.post('/api/account/addresses', async (c) => {
  const u = await authUser(c.env, c.req.raw); if (!u) return err('Not signed in', 401);
  const b: any = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('INSERT INTO addresses(user_id,label,line1,city,state,zip,country) VALUES(?,?,?,?,?,?,?)').bind(u.id, b.label || '', b.line1, b.city, b.state || '', b.zip, b.country || 'US').run();
  return ok({ message: 'Address saved.' });
});
app.get('/api/account/notifications', async (c) => {
  const u = await authUser(c.env, c.req.raw); if (!u) return err('Not signed in', 401);
  const r = await c.env.DB.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50').bind(u.id).all(); return ok({ notifications: r.results });
});
app.get('/api/account/wishlist', async (c) => {
  const u = await authUser(c.env, c.req.raw); if (!u) return err('Not signed in', 401);
  const r = await c.env.DB.prepare('SELECT p.id,p.name,p.slug,p.price_cents AS priceCents,p.sale_price_cents AS salePriceCents FROM wishlist w JOIN products p ON p.id=w.product_id WHERE w.user_id=?').bind(u.id).all(); return ok({ wishlist: r.results });
});
app.post('/api/account/wishlist', async (c) => {
  const u = await authUser(c.env, c.req.raw); if (!u) return err('Not signed in', 401);
  const b: any = await c.req.json().catch(() => ({}));
  const ex = await c.env.DB.prepare('SELECT 1 FROM wishlist WHERE user_id=? AND product_id=?').bind(u.id, b.productId).first();
  if (ex) await c.env.DB.prepare('DELETE FROM wishlist WHERE user_id=? AND product_id=?').bind(u.id, b.productId).run();
  else await c.env.DB.prepare('INSERT INTO wishlist(user_id,product_id) VALUES(?,?)').bind(u.id, b.productId).run();
  return ok({ message: ex ? 'Removed from wishlist.' : 'Added to wishlist.' });
});

// ---------- reviews, newsletter, contact ----------
app.post('/api/reviews', async (c) => {
  const u = await authUser(c.env, c.req.raw); if (!u) return err('Sign in to review', 401);
  const b: any = await c.req.json().catch(() => ({}));
  if (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5) return err('Rating must be 1–5', 400);
  if (!b.body || b.body.length < 3) return err('Review text is required', 400);
  const verified = await c.env.DB.prepare('SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.user_id=? AND oi.product_id=? AND o.status!="cancelled" LIMIT 1').bind(u.id, b.productId).first();
  try {
    await c.env.DB.prepare("INSERT INTO reviews(product_id,user_id,author_name,rating,title,body,verified_purchase,status) VALUES(?,?,?,?,?,?,?, 'approved')").bind(b.productId, u.id, u.name, b.rating, b.title || '', b.body, verified ? 1 : 0).run();
  } catch { return err("You've already reviewed this product.", 400); }
  await recomputeRating(c.env, b.productId);
  return ok({ message: verified ? 'Review published — thanks!' : 'Review published. Reviews from verified buyers are marked as verified purchases.' });
});
app.post('/api/newsletter/subscribe', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  if (!isValidEmail(b.email || '')) return err('Valid email required', 400);
  await c.env.DB.prepare('INSERT INTO newsletter(email,active) VALUES(?,1) ON CONFLICT(email) DO UPDATE SET active=1').bind(b.email).run();
  return ok({ message: 'Subscribed.' });
});
app.post('/api/newsletter/unsubscribe', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('UPDATE newsletter SET active=0 WHERE email=?').bind(b.email).run();
  return ok({ message: 'Unsubscribed.' });
});
app.post('/api/contact', async (c) => {
  const b: any = await c.req.json().catch(() => ({}));
  if (b.honeypot) return ok({ message: 'Message received.' }); // spam trap, silently accepted
  if (!b.name || !isValidEmail(b.email || '') || !b.body) return err('Name, email and message are required', 400);
  await c.env.DB.prepare('INSERT INTO contact_messages(name,email,subject,body) VALUES(?,?,?,?)').bind(b.name, b.email, b.subject || '', b.body).run();
  return ok({ message: 'Message received. We will reply soon.' });
});

// ---------- admin ----------
const admin = async (c: any) => { const u = await requireAdmin(c.env, c.req.raw); return u; };
app.get('/api/admin/stats', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const total = await c.env.DB.prepare('SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN status!="cancelled" AND status!="refunded" THEN total_cents ELSE 0 END),0) rev FROM orders').first<any>();
  const pending = await c.env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE fulfillment_status='unfulfilled' AND status='confirmed'").first<any>();
  const products = await c.env.DB.prepare('SELECT COUNT(*) n FROM products').first<any>();
  const customers = await c.env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='customer'").first<any>();
  const low = await c.env.DB.prepare('SELECT id,name,sku,stock FROM products WHERE stock<=5 ORDER BY stock ASC LIMIT 10').all();
  const recent = await c.env.DB.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 10').all();
  const refunded = await c.env.DB.prepare("SELECT COALESCE(SUM(total_cents),0) n FROM orders WHERE status='refunded'").first<any>();
  return ok({ totalOrders: total.n, totalRevenueCents: total.rev, refundedCents: refunded.n, pendingFulfillment: pending.n, productCount: products.n, customerCount: customers.n, lowStock: low.results, recentOrders: recent.results });
});
app.get('/api/admin/orders', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const q = c.req.query(); const page = Math.max(1, parseInt(q.page || '1', 10)); const pageSize = 15;
  const where: string[] = []; const binds: any[] = [];
  if (q.status && q.status !== 'all') { where.push('status=?'); binds.push(q.status); }
  if (q.query) { where.push('(number LIKE ? OR email LIKE ? OR customer_name LIKE ?)'); binds.push(`%${q.query}%`, `%${q.query}%`, `%${q.query}%`); }
  const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = await c.env.DB.prepare(`SELECT COUNT(*) n FROM orders ${sqlWhere}`).bind(...binds).first<any>();
  const rows = await c.env.DB.prepare(`SELECT * FROM orders ${sqlWhere} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...binds, pageSize, (page - 1) * pageSize).all();
  for (const o of rows.results as any[]) { const items = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id=?').bind(o.id).all(); o.items = items.results; }
  return ok({ orders: rows.results, total: total.n });
});
app.post('/api/admin/orders/:id', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const id = parseInt(c.req.param('id'), 10); const b: any = await c.req.json().catch(() => ({}));
  const o = await c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>(); if (!o) return err('Order not found', 404);
  if (b.action === 'cancel') {
    if (o.status !== 'confirmed') return err('Only confirmed orders can be cancelled', 400);
    const items = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id=?').bind(id).all();
    for (const it of items.results as any[]) { await c.env.DB.prepare('UPDATE products SET stock=stock+? WHERE id=?').bind(it.qty, it.product_id).run(); if (it.variant_name) { /* variant stock by name lookup */ } await c.env.DB.prepare('INSERT INTO inventory_movements(product_id,delta,reason) VALUES(?,?,?)').bind(it.product_id, it.qty, `cancel ${o.number}`).run(); }
    await c.env.DB.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(id).run();
    await audit(c.env, a.email, 'order_cancelled', o.number); return ok({ message: 'Order cancelled and stock restored.' });
  }
  if (b.action === 'refund') {
    await c.env.DB.prepare("UPDATE orders SET status='refunded', payment_status='refunded', refund_reason=? WHERE id=?").bind(b.refundReason || '', id).run();
    await audit(c.env, a.email, 'order_refunded', o.number); return ok({ message: 'Test-mode refund recorded.' });
  }
  const updates: string[] = []; const binds: any[] = [];
  if (b.fulfillmentStatus) { updates.push('fulfillment_status=?'); binds.push(b.fulfillmentStatus); }
  if (b.carrier !== undefined) { updates.push('carrier=?'); binds.push(b.carrier); }
  if (b.trackingNumber !== undefined) { updates.push('tracking_number=?'); binds.push(b.trackingNumber); }
  if (b.adminNotes !== undefined) { updates.push('admin_notes=?'); binds.push(b.adminNotes); }
  if (updates.length) await c.env.DB.prepare(`UPDATE orders SET ${updates.join(',')} WHERE id=?`).bind(...binds, id).run();
  if (o.user_id) await c.env.DB.prepare('INSERT INTO notifications(user_id,email,message) VALUES(?,?,?)').bind(o.user_id, o.email, `Your order ${o.number} was updated${b.fulfillmentStatus ? ` to ${b.fulfillmentStatus}` : ''}${b.trackingNumber ? ` — tracking ${b.trackingNumber}` : ''}.`).run();
  await audit(c.env, a.email, 'order_updated', o.number); return ok({ message: 'Order updated and customer notified in-app.' });
});
app.get('/api/admin/orders/export', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const rows = await c.env.DB.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  const head = 'number,email,customer,status,payment,fulfillment,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents,created_at';
  const lines = (rows.results as any[]).map((o: any) => [o.number, o.email, o.customer_name, o.status, o.payment_status, o.fulfillment_status, o.subtotal_cents, o.discount_cents, o.shipping_cents, o.tax_cents, o.total_cents, o.created_at].map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  return new Response([head, ...lines].join('\n'), { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="orders.csv"' } });
});
app.get('/api/admin/products', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const rows = await c.env.DB.prepare('SELECT * FROM products ORDER BY id').all(); return ok({ products: rows.results });
});
app.post('/api/admin/products', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const b: any = await c.req.json().catch(() => ({}));
  if (b.id) await c.env.DB.prepare('UPDATE products SET name=?,slug=?,sku=?,category_id=?,description=?,specs=?,price_cents=?,sale_price_cents=?,stock=?,featured=?,image_key=?,status=? WHERE id=?').bind(b.name, b.slug, b.sku, b.categoryId, b.description || '', JSON.stringify(b.specs || {}), b.priceCents, b.salePriceCents || null, b.stock, b.featured ? 1 : 0, b.imageKey, b.status || 'active', b.id).run();
  else await c.env.DB.prepare('INSERT INTO products(name,slug,sku,category_id,description,specs,price_cents,sale_price_cents,stock,featured,image_key,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(b.name, b.slug, b.sku, b.categoryId, b.description || '', JSON.stringify(b.specs || {}), b.priceCents, b.salePriceCents || null, b.stock || 0, b.featured ? 1 : 0, b.imageKey, b.status || 'active').run();
  await audit(c.env, a.email, 'product_saved', b.slug); return ok({ message: 'Product updated.' });
});
app.post('/api/admin/products/delete', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const b: any = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare("UPDATE products SET status='archived' WHERE id=?").bind(b.id).run();
  return ok({ message: 'Product archived.' });
});
app.post('/api/admin/stock', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const b: any = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('UPDATE products SET stock=stock+? WHERE id=?').bind(b.delta, b.productId).run();
  await c.env.DB.prepare('INSERT INTO inventory_movements(product_id,delta,reason) VALUES(?,?,?)').bind(b.productId, b.delta, b.reason || 'manual adjustment').run();
  await audit(c.env, a.email, 'stock_adjusted', `${b.productId}:${b.delta}`); return ok({ message: 'Stock adjusted.' });
});
app.get('/api/admin/inventory', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const rows = await c.env.DB.prepare('SELECT * FROM inventory_movements ORDER BY id DESC LIMIT 100').all(); return ok({ movements: rows.results });
});
app.get('/api/admin/categories', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const r = await c.env.DB.prepare('SELECT * FROM categories ORDER BY id').all(); return ok({ categories: r.results }); });
app.post('/api/admin/categories', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({}));
  if (b.id) await c.env.DB.prepare('UPDATE categories SET name=?,slug=? WHERE id=?').bind(b.name, b.slug, b.id).run();
  else await c.env.DB.prepare('INSERT INTO categories(name,slug) VALUES(?,?)').bind(b.name, b.slug).run();
  return ok({ message: 'Category saved.' });
});
app.get('/api/admin/variants', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const r = await c.env.DB.prepare('SELECT * FROM variants ORDER BY product_id, id').all(); return ok({ variants: r.results }); });
app.post('/api/admin/variants', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({}));
  if (b.id) await c.env.DB.prepare('UPDATE variants SET name=?,sku=?,price_delta_cents=?,stock=? WHERE id=?').bind(b.name, b.sku, b.priceDeltaCents, b.stock, b.id).run();
  else await c.env.DB.prepare('INSERT INTO variants(product_id,name,sku,price_delta_cents,stock) VALUES(?,?,?,?,?)').bind(b.productId, b.name, b.sku, b.priceDeltaCents, b.stock).run();
  return ok({ message: 'Variant saved.' });
});
app.get('/api/admin/customers', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const r = await c.env.DB.prepare('SELECT id,email,name,role,status,created_at FROM users ORDER BY id').all(); return ok({ customers: r.results }); });
app.post('/api/admin/customers/status', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('UPDATE users SET status=? WHERE id=?').bind(b.status, b.id).run(); return ok({ message: 'Customer status updated.' });
});
app.get('/api/admin/coupons', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const r = await c.env.DB.prepare('SELECT * FROM coupons ORDER BY id').all(); return ok({ coupons: r.results }); });
app.post('/api/admin/coupons', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({}));
  if (b.id) await c.env.DB.prepare('UPDATE coupons SET code=?,type=?,value=?,min_subtotal_cents=?,max_uses=?,active=? WHERE id=?').bind(b.code, b.type, b.value, b.minSubtotalCents, b.maxUses || null, b.active ? 1 : 0, b.id).run();
  else await c.env.DB.prepare('INSERT INTO coupons(code,type,value,min_subtotal_cents,max_uses,active,expires_at) VALUES(?,?,?,?,?,?,?)').bind(b.code, b.type, b.value, b.minSubtotalCents, b.maxUses || null, 1, b.expiresAt || null).run();
  return ok({ message: 'Coupon saved.' });
});
app.post('/api/admin/coupons/delete', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({})); await c.env.DB.prepare('DELETE FROM coupons WHERE id=?').bind(b.id).run(); return ok({ message: 'Coupon deleted.' }); });
app.get('/api/admin/reviews', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const r = await c.env.DB.prepare('SELECT r.*, p.name AS productName FROM reviews r JOIN products p ON p.id=r.product_id ORDER BY r.id DESC').all(); return ok({ reviews: r.results }); });
app.post('/api/admin/reviews/moderate', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({}));
  if (!['approved', 'hidden'].includes(b.status)) return err('Invalid status', 400);
  const r = await c.env.DB.prepare('SELECT product_id FROM reviews WHERE id=?').bind(b.id).first<any>(); if (!r) return err('Review not found', 404);
  await c.env.DB.prepare('UPDATE reviews SET status=? WHERE id=?').bind(b.status, b.id).run();
  await recomputeRating(c.env, r.product_id); await audit(c.env, a.email, 'review_moderated', `${b.id}:${b.status}`); return ok({ message: 'Review updated.' });
});
app.get('/api/admin/messages', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const r = await c.env.DB.prepare('SELECT * FROM contact_messages ORDER BY id DESC').all(); return ok({ messages: r.results }); });
app.post('/api/admin/messages/resolve', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({})); await c.env.DB.prepare("UPDATE contact_messages SET status='resolved' WHERE id=?").bind(b.id).run(); return ok({ message: 'Message resolved.' }); });
app.get('/api/admin/pages', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const r = await c.env.DB.prepare('SELECT * FROM content_pages ORDER BY id').all(); return ok({ pages: r.results }); });
app.post('/api/admin/pages', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('INSERT INTO content_pages(slug,title,body) VALUES(?,?,?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title, body=excluded.body').bind(b.slug, b.title, b.body).run(); return ok({ message: 'Page saved.' });
});
app.get('/api/admin/settings', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const r = await c.env.DB.prepare('SELECT * FROM settings ORDER BY key').all(); return ok({ settings: r.results }); });
app.post('/api/admin/settings', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({}));
  for (const [k, v] of Object.entries(b.settings || {})) await c.env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, String(v)).run();
  return ok({ message: 'Settings saved.' });
});
app.get('/api/admin/audit', async (c) => { const a = await admin(c); if (!a) return err('Admin access required', 403); const r = await c.env.DB.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all(); return ok({ logs: r.results }); });
app.get('/api/admin/products/export', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const rows = await c.env.DB.prepare('SELECT * FROM products ORDER BY id').all();
  const head = 'id,name,slug,sku,price_cents,sale_price_cents,stock,status';
  const lines = (rows.results as any[]).map((p: any) => [p.id, p.name, p.slug, p.sku, p.price_cents, p.sale_price_cents || '', p.stock, p.status].map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return new Response([head, ...lines].join('\n'), { headers: { 'content-type': 'text/csv' } });
});

// ---------- product media uploads ----------
const MAGIC: Record<string, number[][]> = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47]], 'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], 'image/gif': [[0x47, 0x49, 0x46]],
  'video/mp4': [[0x00, 0x00, 0x00]], 'video/webm': [[0x1a, 0x45, 0xdf, 0xa3]], 'video/quicktime': [[0x00, 0x00, 0x00]],
};
function magicOk(mime: string, bytes: Uint8Array) {
  if (mime === 'video/mp4' || mime === 'video/quicktime') {
    return bytes.length > 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70; // "ftyp"
  }
  const sigs = MAGIC[mime]; if (!sigs) return false;
  return bytes.length > 8 && sigs.some((sig) => sig.every((b, i) => bytes[i] === b));
}
app.post('/api/admin/media/upload', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403);
  const b: any = await c.req.json().catch(() => ({}));
  const allowed: Record<string, number> = { 'image/jpeg': 8 * 1024 * 1024, 'image/png': 8 * 1024 * 1024, 'image/webp': 8 * 1024 * 1024, 'image/gif': 8 * 1024 * 1024, 'video/mp4': 15 * 1024 * 1024, 'video/webm': 15 * 1024 * 1024, 'video/quicktime': 15 * 1024 * 1024 };
  if (!allowed[b.mimeType]) return err('File type not allowed', 400);
  let bytes: Uint8Array; try { bytes = unb64(b.dataBase64 || ''); } catch { return err('Invalid file data', 400); }
  if (bytes.length > allowed[b.mimeType]) return err('File too large', 400);
  if (!magicOk(b.mimeType, bytes)) return err('File signature does not match its declared type', 400);
  const kind = b.mimeType.startsWith('video/') ? 'video' : 'image';
  const count = await c.env.DB.prepare('SELECT COUNT(*) n FROM product_media WHERE product_id=?').bind(b.productId).first<any>();
  let url: string, dataUrl: string | null = null;
  if (c.env.R2_BUCKET) {
    const key = `product-media/${b.productId}/${uid()}-${b.filename || 'upload'}`;
    await c.env.R2_BUCKET.put(key, bytes, { httpMetadata: { contentType: b.mimeType } });
    url = `/api/media/${encodeURIComponent(key)}`;
  } else {
    dataUrl = `data:${b.mimeType};base64,${b.dataBase64}`; url = dataUrl;
  }
  const r = await c.env.DB.prepare('INSERT INTO product_media(product_id,kind,filename,mime_type,size_bytes,url,data_url,sort) VALUES(?,?,?,?,?,?,?,?)').bind(b.productId, kind, b.filename || 'upload', b.mimeType, bytes.length, url, dataUrl, count.n).run();
  await audit(c.env, a.email, 'media_uploaded', `${b.productId}:${b.filename}`);
  const media = await c.env.DB.prepare('SELECT id,kind,filename,mime_type AS mimeType,size_bytes AS sizeBytes,url,sort,is_main AS isMain FROM product_media WHERE product_id=? ORDER BY sort ASC').bind(b.productId).all();
  return ok({ media: media.results, message: `Uploaded ${b.filename || 'file'} — it's live in the product gallery.` });
});
app.get('/api/media/:key', async (c) => {
  if (!c.env.R2_BUCKET) return err('Media is stored in D1 in this deployment', 404);
  const obj = await c.env.R2_BUCKET.get(decodeURIComponent(c.req.param('key')));
  if (!obj) return err('Not found', 404);
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream' } });
});
app.post('/api/admin/media/delete', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('DELETE FROM product_media WHERE id=?').bind(b.mediaId).run(); await audit(c.env, a.email, 'media_deleted', String(b.mediaId)); return ok({ message: 'Media removed.' });
});
app.post('/api/admin/media/reorder', async (c) => {
  const a = await admin(c); if (!a) return err('Admin access required', 403); const b: any = await c.req.json().catch(() => ({}));
  for (let i = 0; i < (b.mediaIds || []).length; i++) await c.env.DB.prepare('UPDATE product_media SET sort=?, is_main=? WHERE id=? AND product_id=?').bind(i, i === 0 ? 1 : 0, b.mediaIds[i], b.productId).run();
  return ok({ message: 'Media order updated.' });
});

// ---------- static fallback (Cloudflare assets) ----------
app.all('*', async (c) => {
  if (c.env.ASSETS) { try { return await c.env.ASSETS.fetch(c.req.raw); } catch { /* fall through */ } }
  return err('Not found', 404);
});
export default app;
