# Maison — standalone, Cloudflare-hostable e-commerce store

A rebuild of the Maison store as a portable project: a Cloudflare Worker
(Hono) + Cloudflare D1 database, with the storefront and admin UI served
as static files by the same Worker. No build step is required for the
frontend; the Worker is TypeScript compiled by Wrangler.

**Payments are TEST MODE only.** Checkout accepts a test card for format
validation and records `paid_test`. Card numbers and CVV are never stored.
Tax is a single configurable rate (default 8%) — documented here and in
`settings` as **not jurisdiction-verified tax compliance**. Email is not
connected: order updates are stored as in-app notifications. Connect a
real email provider before a real launch.

## What is included

- 42 products across 5 categories (Ceramics, Textiles, Lighting,
  Furniture, Kitchen & Dining), with variants, sale prices, stock and
  featured flags. Gallery views (main, detail, texture, wide, left,
  right, zoom) are derived from each product's `image_key`.
- **Catalogue illustrations:** the original catalogue photography is not
  exportable from the Muse artifact, so gallery views in this build are
  stylised SVG product illustrations keyed by `image_key` (a silhouette
  per product type, in a deterministic colour per product). Replace
  `/api/placeholder` / `public` image handling with real product photos
  when you have them — the media-upload feature below is the intended
  way to add real photos per product, and uploaded photos lead the gallery.
- Search with suggestions, category filter, sorting, pagination.
- Server-side persistent cart (cart token), coupons:
  `WELCOME10` (10% off), `MAISON25` ($25 off, $150 minimum subtotal),
  `FREESHIP` (free shipping, $40 minimum).
- Guest + account checkout, server-recalculated totals, integer cents
  only. Shipping: standard $6.95, express $18.99, pickup $0; standard
  shipping is free at $150+ subtotal (before tax, after discount).
- Accounts (PBKDF2 via Web Crypto, 30-day sessions), address book,
  order history, guest lookup by order number + email, password reset
  (code hashed, 30-minute expiry, single use; delivered to the account
  holder's notification record until an email provider is connected).
- Orders `MSN-1001` onward, item snapshots, separate order / payment /
  fulfilment statuses (unfulfilled → processing → shipped → delivered),
  carrier + tracking, admin notes, cancel with stock restock, test-mode
  refund with reason, CSV export, admin stats, audit log, inventory ledger.
- Reviews: signed-in only, one per user per product, rating 1–5
  validated server-side, verified-purchase flag from real orders, rating
  average/count, admin approve/hide (hidden reviews are excluded from
  the average and the storefront).
- Wishlist, newsletter with unsubscribe, contact form with honeypot,
  in-app notifications, content pages, settings.
- Admin: products, categories, variants, stock adjustments,
  orders/fulfilment, customers, coupons, review moderation, inbox,
  content pages, settings, CSV exports, audit log.
- Product media uploads: photos JPG/PNG/WebP/GIF up to 8 MB, videos
  MP4/WebM/MOV up to 15 MB, validated server-side by MIME **and** file
  signature (magic bytes, including `ftyp` for MP4), size-capped,
  main-image selection (first in sort order), reorder, delete,
  audit-logged. **Storage choice:** if an `R2_BUCKET` binding is present
  in `wrangler.toml`, uploads go to R2 and are served at `/api/media/:key`.
  Otherwise (the default in this repo) uploads are stored as data URLs in
  D1, subject to the same caps — fine for a demo/portfolio, but move to
  R2 before production use with large video files.

## Known differences from the original Muse artifact

- Known products (names, SKUs, slugs, prices, sale prices, stock,
  featured flags, descriptions/specs where the original context gave
  them) are preserved. The full original 42-product list is not
  exportable from the artifact, so remaining catalogue slots are filled
  with Maison-style products to reach 42 products in the same
  10 / 10 / 6 / 7 / 9 category split. Slugs, SKUs and prices for the
  products named in testing (candle, mug set, vase, side table, chair,
  pendant, cutlery set, etc.) match the original.
- Gallery images are placeholders (see above), not the original photos.
- The original test orders/reviews are **not** copied — this is a fresh
  store. Seed it, then create your own test orders.

## Quick start (local)

```bash
npm install
# Create the D1 database and put the id into wrangler.toml
npx wrangler d1 create maison
npx wrangler d1 migrations apply maison --local
npx wrangler d1 execute maison --local --file=./seed.sql
# Admin account (no password is hardcoded anywhere):
ADMIN_PASSWORD='a-strong-password-of-12-plus-chars' npm run generate-admin
npx wrangler d1 execute maison --local --file=./admin.sql
npm run dev   # http://localhost:8787
```

Change the admin password after first sign-in (Account → change password
in the API, or set a new one via the admin account settings).

## Deploy to Cloudflare (do this after connecting your account)

```bash
npx wrangler login
npx wrangler d1 create maison          # copy the database_id into wrangler.toml
npx wrangler d1 migrations apply maison --remote
npx wrangler d1 execute maison --remote --file=./seed.sql
ADMIN_PASSWORD='a-strong-password-of-12-plus-chars' npm run generate-admin
npx wrangler d1 execute maison --remote --file=./admin.sql
npm run deploy
```

Optional R2 (recommended for media): create a bucket, then add to
`wrangler.toml`:
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "maison-media"
```
and redeploy. Without it, uploads fall back to D1 data URLs.

## Push to GitHub (do this after connecting GitHub)

```bash
git init
git add .
git commit -m "Maison: standalone Cloudflare Worker + D1 store"
git remote add origin git@github.com:<you>/maison-cloudflare.git
git push -u origin main
```

Do not commit `admin.sql` (it is in `.gitignore`), `.dev.vars`, or any
real secrets. `wrangler.toml` contains a placeholder `database_id` that
must be replaced on first deploy.

## API overview

All JSON under `/api/*`; admin routes require the `x-session-token`
header of an admin session.

- `GET /api/products`, `GET /api/products/:slug`, `GET /api/search?q=`,
  `GET /api/categories`, `GET /api/placeholder?key=&view=`
- `POST /api/cart/add`, `GET /api/cart`, `POST /api/cart/update`,
  `POST /api/cart/coupon`, `POST /api/checkout/quote`,
  `POST /api/checkout/place` (idempotencyKey required)
- `POST /api/auth/register|login|logout`, `GET /api/auth/me`,
  `POST /api/auth/request-reset`, `POST /api/auth/reset-password`
- `GET /api/orders/lookup?number=&email=`, `GET /api/account/orders`,
  `POST /api/reviews`, `POST /api/newsletter/subscribe|unsubscribe`,
  `POST /api/contact`
- `GET /api/admin/stats|orders|products|categories|variants|customers|coupons|reviews|messages|pages|settings|audit|inventory`,
  `POST /api/admin/orders/:id` (update/cancel/refund),
  `POST /api/admin/media/upload|delete|reorder`,
  `GET /api/admin/orders/export`, `GET /api/admin/products/export`

## Test data (after seeding)

- Coupons: `WELCOME10`, `MAISON25`, `FREESHIP` (see above).
- Admin: `admin@maison.store` — password set by you via
  `generate-admin`; change it after first sign-in.
- Test checkout: any test card number format (e.g. the usual Stripe
  test number) — it is validated for format only and never stored.
