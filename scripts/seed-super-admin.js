// scripts/seed-super-admin.js
// CLI script to securely seed or update the Super Admin user in Cloudflare D1
// Usage: node scripts/seed-super-admin.js [name] [email] [password]

import { hashPassword } from '../functions/api/_auth.js';

const SUPER_ADMIN_EMAIL = 'admin@chengdushuze.com';
const DEFAULT_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456';

async function main() {
  const name = process.argv[2] || 'Super Admin';
  const email = process.argv[3] || SUPER_ADMIN_EMAIL;
  const password = process.argv[4] || DEFAULT_PASSWORD;

  console.log('Generating PBKDF2 Web Crypto password hash (100,000 iterations)...');
  const passwordHash = await hashPassword(password);

  console.log('\n===============================================================');
  console.log('🛡️  ALI GARMENTS - SUPER ADMIN SEEDING SCRIPT');
  console.log('===============================================================');
  console.log(`Name:                   ${name}`);
  console.log(`Email:                  ${email}`);
  console.log(`Role:                   super_admin`);
  console.log(`Allow VPN:              1 (Enabled)`);
  console.log(`Allow Foreign Access:   1 (Enabled)`);
  console.log(`Password Hash:          ${passwordHash}`);
  console.log('\n--- Paste into Cloudflare D1 Console (or execute via Wrangler): ---');
  console.log(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT DEFAULT 'active',
  allow_vpn INTEGER DEFAULT 0,
  allow_foreign_access INTEGER DEFAULT 0,
  token_version INTEGER DEFAULT 1,
  suspended_until INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, email, password_hash, role, status, allow_vpn, allow_foreign_access)
VALUES ('${name}', '${email.toLowerCase().trim()}', '${passwordHash}', 'super_admin', 'active', 1, 1)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = 'super_admin',
  status = 'active',
  allow_vpn = 1,
  allow_foreign_access = 1,
  token_version = token_version + 1;
  `.trim());
  console.log('\n===============================================================');
  console.log('Wrangler command:');
  console.log(`npx wrangler d1 execute ali-garments --remote --command="INSERT INTO users (name, email, password_hash, role, status, allow_vpn, allow_foreign_access) VALUES ('${name}', '${email.toLowerCase().trim()}', '${passwordHash}', 'super_admin', 'active', 1, 1) ON CONFLICT(email) DO UPDATE SET role='super_admin', password_hash='${passwordHash}', allow_vpn=1, allow_foreign_access=1;"`);
  console.log('===============================================================\n');
}

main().catch(console.error);
