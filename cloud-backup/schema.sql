-- ====================================================================
-- ALI GARMENTS KHATA & ERP - COMPLETE CLOUD D1 DATABASE SCHEMA BACKUP
-- Compatible with Cloudflare D1 (SQLite)
-- ====================================================================

-- 1. Users & Authentication Table
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
  suspension_reason TEXT,
  last_login_ip TEXT,
  last_login_device TEXT,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers / Parties Table
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

-- 3. Customer Transaction Chunks (High Capacity Ledger Engine)
CREATE TABLE IF NOT EXISTS customer_chunks (
  customer_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  transactions_json TEXT NOT NULL DEFAULT '[]',
  byte_size INTEGER DEFAULT 0,
  count INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (customer_id, chunk_index)
);

-- 4. Application Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Soft-Delete Recycle Bin Table
CREATE TABLE IF NOT EXISTS recycle_bin (
  bin_id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  customer_id TEXT,
  title TEXT NOT NULL,
  item_json TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- 6. Activity & Security Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_email TEXT,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Automated Cloud Backup History Table
CREATE TABLE IF NOT EXISTS backup_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_time TEXT NOT NULL,
  users_count INTEGER DEFAULT 0,
  customers_count INTEGER DEFAULT 0,
  chunks_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'SUCCESS'
);

-- Indexes for lightning-fast lookups
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_chunks_cust ON customer_chunks(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
