-- ===============================================================
-- ALI Garments - Cloudflare D1 Production Database Schema
-- Multi-User Secure Authentication & Ultra-Optimized Khata Engine
-- ===============================================================

-- 1. Users Table (Managed via Cloudflare D1 Dashboard only / Admin seed script - NO public registration)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- 'admin', 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. User-Owned Items Table (Scoped strictly to WHERE user_id = ?)
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Customers Table (Wholesale & Retail Parties)
CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    category TEXT DEFAULT 'customer', -- 'customer', 'supplier', 'wholesale'
    balance REAL DEFAULT 0.0,
    current_chunk INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 4. Customer Chunks Table (1 Row per customer, up to ~1.8MB for 99% D1 quota savings)
CREATE TABLE IF NOT EXISTS customer_chunks (
    customer_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    transactions_json TEXT NOT NULL DEFAULT '[]',
    byte_size INTEGER DEFAULT 0,
    count INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (customer_id, chunk_index),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);

-- 5. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 6. Recycle Bin Table (30-Day Auto Expiration & Multi-Device Sync)
CREATE TABLE IF NOT EXISTS recycle_bin (
    bin_id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL, -- 'customer', 'transaction', 'invoice'
    customer_id TEXT,
    title TEXT NOT NULL,
    item_json TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- Indexes for maximum query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_chunks_customer ON customer_chunks(customer_id);
CREATE INDEX IF NOT EXISTS idx_recycle_expires ON recycle_bin(expires_at);
