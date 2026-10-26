// Generate admin.sql from ADMIN_PASSWORD (never hardcode a password here).
// Usage: ADMIN_PASSWORD='your-strong-password' npm run generate-admin
// Then: wrangler d1 execute maison --local --file=./admin.sql   (or --remote)
// Change the password after first sign-in.
import { webcrypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const pw = process.env.ADMIN_PASSWORD;
if (!pw || pw.length < 12) { console.error('Set ADMIN_PASSWORD to 12+ characters.'); process.exit(1); }
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const b64 = (b) => Buffer.from(b).toString('base64');
const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
const sql = `INSERT INTO users(email,name,role,password_hash,password_salt) VALUES('admin@maison.store','Store Admin','admin','${b64(bits)}','${b64(salt)}');\n`;
writeFileSync('admin.sql', sql);
console.log('Wrote admin.sql (not committed — see .gitignore). Run it with wrangler d1 execute, then change the password after first sign-in.');
