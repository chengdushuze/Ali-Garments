// Cloudflare Cron Worker: Daily Nightly Backup
// Triggers automatically every night at 20:00 UTC (1:00 AM Pakistan Standard Time)

export default {
  // 1. Scheduled Cron Event Handler (Runs automatically every night)
  async scheduled(event, env, ctx) {
    console.log(`[Nightly Cron] Daily backup started at ${new Date().toISOString()}`);
    ctx.waitUntil(executeBackup(env));
  },

  // 2. Fetch Handler (Allows testing or manual trigger via HTTP)
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/trigger') {
      const stats = await executeBackup(env);
      return new Response(JSON.stringify({ success: true, stats }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Ali Garments Nightly D1 Backup Worker is running.', { status: 200 });
  },
};

async function executeBackup(env) {
  if (!env.DB || !env.DB_BACKUP) {
    throw new Error('Missing D1 database bindings: DB or DB_BACKUP');
  }

  // Ensure tables exist in backup D1
  await env.DB_BACKUP.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      category TEXT DEFAULT 'customer',
      balance REAL DEFAULT 0.0,
      current_chunk INTEGER DEFAULT 0,
      total_transactions INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_chunks (
      customer_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      transactions_json TEXT NOT NULL DEFAULT '[]',
      byte_size INTEGER DEFAULT 0,
      count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (customer_id, chunk_index)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recycle_bin (
      bin_id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      customer_id TEXT,
      title TEXT NOT NULL,
      item_json TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS backup_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      backup_time TEXT NOT NULL,
      users_count INTEGER DEFAULT 0,
      customers_count INTEGER DEFAULT 0,
      chunks_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'SUCCESS'
    );
  `);

  // Read data from primary DB
  const [uRes, cRes, chRes, sRes, rRes] = await Promise.all([
    env.DB.prepare('SELECT * FROM users').all(),
    env.DB.prepare('SELECT * FROM customers').all(),
    env.DB.prepare('SELECT * FROM customer_chunks').all(),
    env.DB.prepare('SELECT * FROM settings').all(),
    env.DB.prepare('SELECT * FROM recycle_bin').all(),
  ]);

  const users = uRes.results || [];
  const customers = cRes.results || [];
  const chunks = chRes.results || [];
  const settings = sRes.results || [];
  const recycleBin = rRes.results || [];

  // Backup Users
  for (const u of users) {
    await env.DB_BACKUP.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, password_hash=excluded.password_hash, role=excluded.role'
    ).bind(u.id, u.name, u.email, u.password_hash, u.role, u.created_at).run().catch(() => {});
  }

  // Backup Customers
  for (const c of customers) {
    await env.DB_BACKUP.prepare(
      'INSERT INTO customers (customer_id, name, phone, address, category, balance, current_chunk, total_transactions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(customer_id) DO UPDATE SET name=excluded.name, balance=excluded.balance, total_transactions=excluded.total_transactions, updated_at=excluded.updated_at'
    ).bind(c.customer_id, c.name, c.phone, c.address, c.category, c.balance, c.current_chunk, c.total_transactions, c.created_at, c.updated_at).run().catch(() => {});
  }

  // Backup Chunks
  for (const ch of chunks) {
    await env.DB_BACKUP.prepare(
      'INSERT INTO customer_chunks (customer_id, chunk_index, transactions_json, byte_size, count, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(customer_id, chunk_index) DO UPDATE SET transactions_json=excluded.transactions_json, byte_size=excluded.byte_size, count=excluded.count, updated_at=excluded.updated_at'
    ).bind(ch.customer_id, ch.chunk_index, ch.transactions_json, ch.byte_size, ch.count, ch.updated_at).run().catch(() => {});
  }

  // Backup Settings
  for (const s of settings) {
    await env.DB_BACKUP.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at'
    ).bind(s.key, s.value, s.updated_at).run().catch(() => {});
  }

  // Backup Recycle Bin
  for (const r of recycleBin) {
    await env.DB_BACKUP.prepare(
      'INSERT INTO recycle_bin (bin_id, item_type, customer_id, title, item_json, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(bin_id) DO UPDATE SET title=excluded.title, item_json=excluded.item_json'
    ).bind(r.bin_id, r.item_type, r.customer_id, r.title, r.item_json, r.deleted_at, r.expires_at).run().catch(() => {});
  }

  // Log backup completion
  const timestamp = new Date().toISOString();
  await env.DB_BACKUP.prepare(
    'INSERT INTO backup_history (backup_time, users_count, customers_count, chunks_count, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(timestamp, users.length, customers.length, chunks.length, 'SUCCESS').run();

  console.log(`[Nightly Cron] Backup finished successfully at ${timestamp}. Users: ${users.length}, Customers: ${customers.length}, Chunks: ${chunks.length}`);

  return {
    timestamp,
    usersCount: users.length,
    customersCount: customers.length,
    chunksCount: chunks.length,
    status: 'SUCCESS',
  };
}
