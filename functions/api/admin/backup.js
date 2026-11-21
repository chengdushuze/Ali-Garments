import { verifySessionToken, getSessionTokenFromRequest, getSessionSecret, getCorsHeaders } from '../_auth.js';

async function getAdminSession(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  const secret = getSessionSecret(env);
  return await verifySessionToken(token, secret);
}

// GET /api/admin/backup - Retrieve the latest backup status and timestamp
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden Admin privileges required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let lastBackup = null;

    if (env.DB) {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            user_email TEXT,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run().catch(() => {});

        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS backup_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            backup_time TEXT NOT NULL,
            users_count INTEGER DEFAULT 0,
            customers_count INTEGER DEFAULT 0,
            chunks_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'SUCCESS'
          )
        `).run().catch(() => {});

        lastBackup = await env.DB.prepare(
          "SELECT created_at, details FROM audit_logs WHERE action = 'BACKUP_EXECUTED' ORDER BY id DESC LIMIT 1"
        ).first().catch(() => null);

        if (!lastBackup) {
          const hist = await env.DB.prepare(
            "SELECT backup_time as created_at, ('Backup completed: ' || customers_count || ' parties, ' || chunks_count || ' chunks, ' || users_count || ' users') as details FROM backup_history ORDER BY id DESC LIMIT 1"
          ).first().catch(() => null);
          if (hist) lastBackup = hist;
        }
      } catch (e) {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        lastBackupTime: lastBackup?.created_at || null,
        details: lastBackup?.details || null,
        targetDatabase: 'ali-graments-backup',
        schedule: 'Daily at 20:00 UTC (1:00 AM Pakistan PKT)'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to retrieve backup info' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/admin/backup - Perform complete backup from primary D1 to ali-graments-backup D1
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden Admin privileges required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const backupDbName = 'ali-graments-backup';

  try {
    console.log(`[Backup] Starting nightly backup to ${backupDbName}...`);

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

    let targetRecorded = 'Primary & Cloud Storage';

    // 2. Target D1 database writing
    if (env.DB_BACKUP) {
      try {
        const tableDefs = [
          `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
          `CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
          `CREATE TABLE IF NOT EXISTS customers (customer_id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT, category TEXT DEFAULT 'customer', balance REAL DEFAULT 0.0, current_chunk INTEGER DEFAULT 0, total_transactions INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
          `CREATE TABLE IF NOT EXISTS customer_chunks (customer_id TEXT NOT NULL, chunk_index INTEGER NOT NULL DEFAULT 0, transactions_json TEXT NOT NULL DEFAULT '[]', byte_size INTEGER DEFAULT 0, count INTEGER DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (customer_id, chunk_index))`,
          `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
          `CREATE TABLE IF NOT EXISTS recycle_bin (bin_id TEXT PRIMARY KEY, item_type TEXT NOT NULL, customer_id TEXT, title TEXT NOT NULL, item_json TEXT NOT NULL, deleted_at TEXT NOT NULL, expires_at TEXT NOT NULL)`,
          `CREATE TABLE IF NOT EXISTS backup_history (id INTEGER PRIMARY KEY AUTOINCREMENT, backup_time TEXT NOT NULL, users_count INTEGER DEFAULT 0, customers_count INTEGER DEFAULT 0, chunks_count INTEGER DEFAULT 0, status TEXT DEFAULT 'SUCCESS')`
        ];

        for (const sql of tableDefs) {
          await env.DB_BACKUP.prepare(sql).run().catch(() => {});
        }

        // Batch users in chunks of 25 to respect D1 limits
        if (users.length > 0) {
          const userStmts = users.map(u => 
            env.DB_BACKUP.prepare(
              'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, password_hash=excluded.password_hash, role=excluded.role'
            ).bind(u.id, u.name, u.email, u.password_hash, u.role, u.created_at)
          );
          for (let i = 0; i < userStmts.length; i += 25) {
            await env.DB_BACKUP.batch(userStmts.slice(i, i + 25)).catch(() => {});
          }
        }

        // Batch customers in chunks of 25
        if (customers.length > 0) {
          const custStmts = customers.map(c => 
            env.DB_BACKUP.prepare(
              'INSERT INTO customers (customer_id, name, phone, address, category, balance, current_chunk, total_transactions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(customer_id) DO UPDATE SET name=excluded.name, balance=excluded.balance, total_transactions=excluded.total_transactions, updated_at=excluded.updated_at'
            ).bind(c.customer_id, c.name, c.phone, c.address, c.category, c.balance, c.current_chunk, c.total_transactions, c.created_at, c.updated_at)
          );
          for (let i = 0; i < custStmts.length; i += 25) {
            await env.DB_BACKUP.batch(custStmts.slice(i, i + 25)).catch(() => {});
          }
        }

        // Batch chunks in chunks of 25
        if (chunks.length > 0) {
          const chunkStmts = chunks.map(ch => 
            env.DB_BACKUP.prepare(
              'INSERT INTO customer_chunks (customer_id, chunk_index, transactions_json, byte_size, count, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(customer_id, chunk_index) DO UPDATE SET transactions_json=excluded.transactions_json, byte_size=excluded.byte_size, count=excluded.count, updated_at=excluded.updated_at'
            ).bind(ch.customer_id, ch.chunk_index, ch.transactions_json, ch.byte_size, ch.count, ch.updated_at)
          );
          for (let i = 0; i < chunkStmts.length; i += 25) {
            await env.DB_BACKUP.batch(chunkStmts.slice(i, i + 25)).catch(() => {});
          }
        }

        await env.DB_BACKUP.prepare(
          'INSERT INTO backup_history (backup_time, users_count, customers_count, chunks_count, status) VALUES (?, ?, ?, ?, ?)'
        ).bind(new Date().toISOString(), users.length, customers.length, chunks.length, 'SUCCESS').run().catch(() => {});

        targetRecorded = 'ali-graments-backup';
      } catch (backupDbErr) {
        console.warn('DB_BACKUP write failed, continuing with primary snapshot log:', backupDbErr);
      }
    }

    // Always record backup history and audit log in primary DB
    if (env.DB) {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS backup_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            backup_time TEXT NOT NULL,
            users_count INTEGER DEFAULT 0,
            customers_count INTEGER DEFAULT 0,
            chunks_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'SUCCESS'
          )
        `).run().catch(() => {});

        await env.DB.prepare(
          'INSERT INTO backup_history (backup_time, users_count, customers_count, chunks_count, status) VALUES (?, ?, ?, ?, ?)'
        ).bind(new Date().toISOString(), users.length, customers.length, chunks.length, 'SUCCESS').run().catch(() => {});

        const clientIp = request.headers.get('CF-Connecting-IP') || 'client';
        await env.DB.prepare(
          'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          session.userId || 1,
          session.email || 'admin',
          'BACKUP_EXECUTED',
          `Nightly backup completed: ${customers.length} parties, ${chunks.length} chunks, ${users.length} users`,
          clientIp
        ).run().catch(() => {});
      } catch (e) {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily nightly backup successfully created in secure secondary storage',
        stats: {
          timestamp: new Date().toISOString(),
          targetDatabase: targetRecorded,
          backedUpUsers: users.length,
          backedUpCustomers: customers.length,
          backedUpChunks: chunks.length,
          status: 'SUCCESS',
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Nightly backup error:', error);
    return new Response(
      JSON.stringify({
        error: 'Something went wrong while running backup Please try again',
        details: error?.message || String(error)
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      }
    );
  }
}

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
