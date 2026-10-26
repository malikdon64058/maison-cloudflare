export interface Env { DB: D1Database; ASSETS: Fetcher; R2_BUCKET?: R2Bucket; TAX_RATE_PERCENT?: string; FREE_SHIPPING_THRESHOLD_CENTS?: string }
export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
export const err = (message: string, status = 400) => json({ ok: false, message }, status);
export function uid(prefix = '') { return prefix + crypto.randomUUID(); }
export function b64(bytes: Uint8Array) { let s=''; bytes.forEach(b=>s+=String.fromCharCode(b)); return btoa(s); }
export function unb64(s: string) { const bin = atob(s); const out = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out; }
export async function sha256Hex(text: string) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
export async function hashPassword(password: string, saltB64: string) {
  const salt = unb64(saltB64);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return b64(new Uint8Array(bits));
}
export function newSalt() { const a = new Uint8Array(16); crypto.getRandomValues(a); return b64(a); }
export async function getSetting(env: Env, key: string, fallback: string) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();
  return row?.value ?? fallback;
}
export async function audit(env: Env, actor: string, action: string, detail = '') {
  await env.DB.prepare('INSERT INTO audit_logs(actor,action,detail) VALUES(?,?,?)').bind(actor, action, detail).run().catch(()=>{});
}
export function gallery(imageKey: string) {
  const views = ['main','detail','texture','wide','left','right','zoom'];
  return views.map((v,i)=> i===0 ? imageKey : `${imageKey}-${v}`);
}
export function placeholderSvg(key: string, view: string) {
  // Deterministic hue from the image key, so every product gets a distinct placeholder.
  let h=0; for (const c of key) h=(h*31 + c.charCodeAt(0))%360;
  const label = `${key} — ${view}`.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 35% 82%)"/><stop offset="1" stop-color="hsl(${(h+40)%360} 35% 62%)"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><text x="400" y="285" font-family="Georgia,serif" font-size="34" text-anchor="middle" fill="#2b2118">${label}</text><text x="400" y="330" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#5b4636">Placeholder image — original catalogue photography is not exportable</text></svg>`;
}
export async function quoteTotals(env: Env, subtotalCents: number, couponCode: string | null, shippingMethod: string) {
  let discount = 0, freeShip = false;
  if (couponCode) {
    const c = await env.DB.prepare('SELECT * FROM coupons WHERE code=? AND active=1').bind(couponCode).first<any>();
    if (c && subtotalCents >= (c.min_subtotal_cents||0) && (!c.expires_at || c.expires_at > new Date().toISOString())) {
      if (c.type==='percent') discount = Math.round(subtotalCents * c.value / 100);
      else if (c.type==='fixed') discount = Math.min(c.value, subtotalCents);
      else if (c.type==='free_shipping') freeShip = true;
    }
  }
  const threshold = parseInt(await getSetting(env,'free_shipping_threshold_cents','15000'),10);
  let shipping = shippingMethod==='express' ? 1899 : shippingMethod==='pickup' ? 0 : 695;
  if (freeShip || (shippingMethod==='standard' && subtotalCents - discount >= threshold)) shipping = 0;
  const taxRate = parseInt(await getSetting(env,'tax_rate_percent','8'),10);
  const taxable = Math.max(0, subtotalCents - discount);
  const tax = Math.round(taxable * taxRate / 100);
  return { discountCents: discount, shippingCents: shipping, taxCents: tax, totalCents: taxable + shipping + tax };
}
export async function recomputeRating(env: Env, productId: number) {
  const row = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(AVG(rating),0) a FROM reviews WHERE product_id=? AND status='approved'").bind(productId).first<any>();
  await env.DB.prepare('UPDATE products SET rating_count=?, rating_avg=? WHERE id=?').bind(row.n, row.a, productId).run();
}
export async function authUser(env: Env, req: Request) {
  const token = req.headers.get('x-session-token') || new URL(req.url).searchParams.get('sessionToken') || '';
  if (!token) return null;
  const s = await env.DB.prepare('SELECT * FROM sessions WHERE token=? AND expires_at>datetime("now")').bind(token).first<any>();
  if (!s) return null;
  const u = await env.DB.prepare('SELECT id,email,name,role,status FROM users WHERE id=?').bind(s.user_id).first<any>();
  return u?.status==='active' ? u : null;
}
export async function requireAdmin(env: Env, req: Request) {
  const u = await authUser(env, req);
  return u?.role==='admin' ? u : null;
}
export function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
