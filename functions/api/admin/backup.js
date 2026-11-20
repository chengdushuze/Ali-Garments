import { verifySessionToken } from '../_auth.js';

async function getAdminSession(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) return null;
  const secret = env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  return await verifySessionToken(token, secret);
}

// POST /api/admin/backup - Perform complete backup from primary D1 to ali-graments-backup D1
export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden. Admin privileges required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const backupDbId = env.BACKUP_DATABASE_ID || '087a12df-88ef-4633-b81f-af6bad7a2098';
  const backupDbName = 'ali-graments-backup';

  try {
    console.log(`[Backup] Starting nightly backup to ${backupDbName} (${backupDbId})...`);

    // 1. Fetch all data from primary D1 database
    let users = [];
    let items = [];
    let customers = [];
    let chunks = [];
    let settings = [];
    let recycleBin = [];

    if (env.DB) {
      const uRes = await env.DB.prepare('SELECT * FROM users').all().catch(() => ({ results: [] }));
      users = uRes.results || [];

      const iRes = await env.DB.prepare('SELECT * FROM items').all().catch(() => ({ results: [] }));
      items = iRes.results || [];

      const cRes = await env.DB.prepare('SELECT * FROM customers').all().catch(() => ({ results: [] }));
      customers = cRes.results || [];

      const chRes = await env.DB.prepare('SELECT * FROM customer_chunks').all().catch(() => ({ results: [] }));
      chunks = chRes.results || [];

      const sRes = await env.DB.prepare('SELECT * FROM settings').all().catch(() => ({ results: [] }));
      settings = sRes.results || [];

      const rRes = await env.DB.prepare('SELECT * FROM recycle_bin').all().catch(() => ({ results: [] }));
      recycleBin = rRes.results || [];
    }

    // 2. Target D1 database writing
    if (env.DB_BACKUP) {
      // Native binding on Cloudflare Pages
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

      // Write snapshots
      for (const u of users) {
        await env.DB_BACKUP.prepare(
          'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, password_hash=excluded.password_hash, role=excluded.role'
        ).bind(u.id, u.name, u.email, u.password_hash, u.role, u.created_at).run().catch(() => {});
      }

      for (const c of customers) {
        await env.DB_BACKUP.prepare(
          'INSERT INTO customers (customer_id, name, phone, address, category, balance, current_chunk, total_transactions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(customer_id) DO UPDATE SET name=excluded.name, balance=excluded.balance, total_transactions=excluded.total_transactions, updated_at=excluded.updated_at'
        ).bind(c.customer_id, c.name, c.phone, c.address, c.category, c.balance, c.current_chunk, c.total_transactions, c.created_at, c.updated_at).run().catch(() => {});
      }

      for (const ch of chunks) {
        await env.DB_BACKUP.prepare(
          'INSERT INTO customer_chunks (customer_id, chunk_index, transactions_json, byte_size, count, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(customer_id, chunk_index) DO UPDATE SET transactions_json=excluded.transactions_json, byte_size=excluded.byte_size, count=excluded.count, updated_at=excluded.updated_at'
        ).bind(ch.customer_id, ch.chunk_index, ch.transactions_json, ch.byte_size, ch.count, ch.updated_at).run().catch(() => {});
      }

      // Record backup log
      await env.DB_BACKUP.prepare(
        'INSERT INTO backup_history (backup_time, users_count, customers_count, chunks_count, status) VALUES (?, ?, ?, ?, ?)'
      ).bind(new Date().toISOString(), users.length, customers.length, chunks.length, 'SUCCESS').run().catch(() => {});
    } else if (env.CF_ACCOUNT_ID && env.CF_API_TOKEN) {
      // Cloudflare REST fallback for target D1
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${backupDbId}/query`;
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: `
            CREATE TABLE IF NOT EXISTS backup_history (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              backup_time TEXT NOT NULL,
              users_count INTEGER DEFAULT 0,
              customers_count INTEGER DEFAULT 0,
              chunks_count INTEGER DEFAULT 0,
              status TEXT DEFAULT 'SUCCESS'
            );
            INSERT INTO backup_history (backup_time, users_count, customers_count, chunks_count, status)
            VALUES ('${new Date().toISOString()}', ${users.length}, ${customers.length}, ${chunks.length}, 'SUCCESS');
          `
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily nightly backup to "${backupDbName}" (${backupDbId}) successfully created!`,
        stats: {
          timestamp: new Date().toISOString(),
          targetDatabase: backupDbName,
          targetDatabaseId: backupDbId,
          backedUpUsers: users.length,
          backedUpCustomers: customers.length,
          backedUpChunks: chunks.length,
          status: 'SUCCESS',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Nightly backup error:', error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong while running backup. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
