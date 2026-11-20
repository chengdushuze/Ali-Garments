// scripts/create-admin.js
// Generates parameterized SQL and raw SQL to insert an Admin user directly in Cloudflare D1 Dashboard
// Usage: node scripts/create-admin.js [name] [email] [password]

import { hashPassword } from '../functions/api/_auth.js';

async function main() {
  const name = process.argv[2] || 'Admin';
  const email = process.argv[3] || 'admin@aligarments.com';
  const password = process.argv[4] || 'Admin@123456';

  console.log('Generating PBKDF2 Web Crypto password hash...');
  const passwordHash = await hashPassword(password);

  console.log('\n===============================================================');
  console.log('✨ CLOUDFLARE D1 ADMIN USER CREATION SQL STATEMENT');
  console.log('===============================================================');
  console.log(`Name:     ${name}`);
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Hash:     ${passwordHash}`);
  console.log('\n--- Copy & Paste the SQL below into your Cloudflare D1 Console: ---');
  console.log(`
INSERT INTO users (name, email, password_hash, role)
VALUES ('${name}', '${email}', '${passwordHash}', 'admin')
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = 'admin';
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
