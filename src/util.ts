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
  // Stylised catalogue illustration: a simple product silhouette in a
  // deterministic colour per product, with a soft shadow and pedestal.
  // No "placeholder" wording — the storefront should look finished.
  // Views vary the framing (detail/zoom crop in, wide pulls back, left/right shift).
  let h=0; for (const c of key) h=(h*31 + c.charCodeAt(0))%360;
  const main = `hsl(${h} 32% 48%)`, light = `hsl(${h} 32% 66%)`, dark = `hsl(${h} 32% 34%)`;
  const shapes: Record<string, string> = {
    vase: `<path d="M355 170 Q400 155 445 170 L458 300 Q458 420 400 455 Q342 420 342 300 Z" fill="${main}"/><ellipse cx="400" cy="168" rx="45" ry="10" fill="${light}"/>`,
    bowl: `<path d="M250 250 Q250 400 400 400 Q550 400 550 250 Q400 285 250 250 Z" fill="${main}"/><ellipse cx="400" cy="252" rx="150" ry="18" fill="${light}"/>`,
    mug: `<rect x="330" y="210" width="130" height="180" rx="18" fill="${main}"/><path d="M460 240 q55 0 55 55 q0 55 -55 55" fill="none" stroke="${main}" stroke-width="16"/><ellipse cx="395" cy="212" rx="65" ry="12" fill="${light}"/>`,
    candle: `<rect x="355" y="210" width="90" height="210" rx="10" fill="${main}"/><ellipse cx="400" cy="175" rx="14" ry="26" fill="#e8a33d"/><rect x="397" y="195" width="6" height="18" fill="${dark}"/>`,
    lamp: `<path d="M330 210 L470 210 L500 310 L300 310 Z" fill="${main}"/><rect x="395" y="310" width="10" height="110" fill="${dark}"/><ellipse cx="400" cy="430" rx="70" ry="12" fill="${dark}"/>`,
    pendant: `<rect x="397" y="60" width="6" height="130" fill="${dark}"/><path d="M320 190 Q400 150 480 190 L500 280 L300 280 Z" fill="${main}"/><circle cx="400" cy="285" r="18" fill="#e8a33d"/>`,
    table: `<rect x="270" y="230" width="260" height="22" rx="8" fill="${main}"/><rect x="295" y="252" width="16" height="170" fill="${dark}"/><rect x="489" y="252" width="16" height="170" fill="${dark}"/>`,
    chair: `<rect x="320" y="170" width="20" height="170" fill="${dark}"/><rect x="460" y="170" width="20" height="170" fill="${dark}"/><rect x="310" y="330" width="180" height="22" rx="8" fill="${main}"/><rect x="325" y="352" width="14" height="80" fill="${dark}"/><rect x="461" y="352" width="14" height="80" fill="${dark}"/>`,
    textile: `<rect x="270" y="260" width="260" height="52" rx="10" fill="${main}"/><rect x="285" y="205" width="230" height="48" rx="10" fill="${light}"/><rect x="300" y="155" width="200" height="44" rx="10" fill="${main}"/><path d="M285 230 q15 -12 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="${dark}" stroke-width="4" opacity="0.5"/>`,
    rug: `<rect x="230" y="210" width="340" height="190" rx="14" fill="${main}"/><rect x="255" y="235" width="290" height="140" rx="8" fill="none" stroke="${light}" stroke-width="6"/><circle cx="400" cy="305" r="42" fill="${light}" opacity="0.7"/>`,
    pot: `<path d="M320 210 L480 210 L455 410 L345 410 Z" fill="${main}"/><rect x="305" y="200" width="190" height="20" rx="8" fill="${light}"/>`,
    teapot: `<ellipse cx="400" cy="320" rx="95" ry="80" fill="${main}"/><path d="M485 300 q60 -10 45 45 q-40 -5 -55 -25" fill="${main}"/><rect x="390" y="225" width="20" height="25" fill="${dark}"/>`,
    skillet: `<circle cx="385" cy="315" r="90" fill="${main}"/><circle cx="385" cy="315" r="55" fill="${light}"/><rect x="465" y="300" width="90" height="22" rx="10" fill="${dark}"/>`,
    dish: `<ellipse cx="400" cy="330" rx="140" ry="55" fill="${main}"/><path d="M280 300 q120 55 240 0" fill="none" stroke="${light}" stroke-width="10"/>`,
  };
  const group: Record<string, string> = {
    vase: 'vase', mugs: 'mug', espresso: 'mug', bowl: 'bowl', cereal: 'bowl', mortar: 'bowl',
    dinnerware: 'dish', butter: 'dish', bakingdish: 'dish', carafe: 'pot',
    candle: 'candle', teapot: 'teapot', planter: 'pot', dutchoven: 'pot',
    lamp: 'lamp', ceramiclamp: 'lamp', floorlamp: 'lamp', sconce: 'pendant', pendant: 'pendant', globe: 'pendant',
    table: 'table', coffeetable: 'table', desk: 'table', bookshelf: 'table', bench: 'table',
    chair: 'chair', chairpair: 'chair', basket: 'pot', board: 'table',
    throw: 'textile', woolthrow: 'textile', knit: 'textile', duvet: 'textile', towels: 'textile',
    cushions: 'textile', runner: 'textile', apron: 'textile', napkins: 'textile', teatowels: 'textile',
    rug: 'rug', skillet: 'skillet', cutlery: 'table',
  };
  const shape = shapes[group[key] || 'vase'];
  const frame = view === 'detail' || view === 'zoom' ? 'translate(400 320) scale(1.6) translate(-400 -320)'
    : view === 'wide' ? 'translate(400 300) scale(0.75) translate(-400 -300)'
    : view === 'left' ? 'translate(-60 0)' : view === 'right' ? 'translate(60 0)'
    : view === 'texture' ? 'translate(400 320) scale(1.25) translate(-400 -320)' : '';
  const label = key.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 28% 92%)"/><stop offset="1" stop-color="hsl(${(h+40)%360} 28% 78%)"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><ellipse cx="400" cy="475" rx="185" ry="22" fill="#2b2118" opacity="0.12"/><g transform="${frame}">${shape}</g><text x="400" y="545" font-family="Georgia,serif" font-size="22" letter-spacing="3" text-anchor="middle" fill="#2b2118" opacity="0.65">${label}</text></svg>`;
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
