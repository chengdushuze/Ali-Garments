// scripts/create-admin.js
// Generates parameterized SQL to insert an Admin user in Cloudflare D1
// Usage: node scripts/create-admin.js <name> <email> <password>

import { hashPassword } from '../functions/api/_auth.js';

async function main() {
  const name = process.argv[2];
  const email = process.argv[3];
  const password = process.argv[4];

  if (!name || !email || !password) {
    console.error('\nUsage: node scripts/create-admin.js <name> <email> <password>');
    console.error('Example: node scripts/create-admin.js "Admin User" "admin@example.com" "YourSecurePassword"\n');
    process.exit(1);
  }

  const cleanEmail = email.toLowerCase().trim();
  console.log('Generating PBKDF2 Web Crypto password hash...');
  const passwordHash = await hashPassword(password);

  console.log('\n===============================================================');
  console.log('✨ CLOUDFLARE D1 ADMIN USER CREATION SQL STATEMENT');
  console.log('===============================================================');
  console.log(`Name:  ${name.trim()}`);
  console.log(`Email: ${cleanEmail}`);
  console.log('\n--- Copy & Paste the SQL below into your Cloudflare D1 Console: ---');
  console.log(`
INSERT INTO users (name, email, password_hash, role, status, allow_vpn, allow_foreign_access)
VALUES ('${name.trim()}', '${cleanEmail}', '${passwordHash}', 'admin', 'active', 1, 1)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = 'admin',
  status = 'active',
  allow_vpn = 1,
  allow_foreign_access = 1;
  `.trim());
  console.log('\n===============================================================');
  console.log('How to run this in Cloudflare D1 Dashboard:');
  console.log('1. Go to Cloudflare Dashboard -> Workers & Pages -> D1');
  console.log('2. Select your database ("ali-garments")');
  console.log('3. Open the "Console" tab');
  console.log('4. Paste the SQL query above and click "Execute"');
  console.log('===============================================================\n');
}

main().catch(console.error);
