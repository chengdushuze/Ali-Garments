# ALI Garments - Smart Khata & Multi-User Secure Enterprise Ledger

> **Production-Grade Closed Multi-User Architecture hosted on Cloudflare Pages with Native Cloudflare D1 Database Binding (`env.DB`), Zero-Trust PBKDF2 Web Crypto Authentication, and PWA / Android APK Ready**  
> *Developed for ALI Garments • Made With ❤️ By Chengdu Shuze International*

---

## 🌟 Architecture & Core Highlights

- **Native Cloudflare D1 Database Binding (`env.DB`)**:
  - Direct, zero-latency database binding running on Cloudflare Edge runtime.
  - **No `CLOUDFLARE_API_TOKEN` required** on Cloudflare Pages: the edge worker accesses `env.DB` natively.
- **Closed Multi-User Authentication**:
  - **No public user registration** (`/api/register` does not exist).
  - Only authenticated administrators (`role === 'admin'`) can create new user accounts via `POST /api/admin/users`.
  - Edge-native **Web Crypto API** (`crypto.subtle` PBKDF2 with 100,000 SHA-256 iterations and unique 16-byte cryptographically secure salts; HMAC-SHA256 signed session tokens in `HttpOnly`, `Secure`, `SameSite=Strict` cookies).
  - Built-in 500ms security delay on failed logins to prevent timing and brute-force attacks.
- **Strict D1 Dashboard-Only User Table Management**:
  - The `users` table is strictly protected: **no edit/update route exists in the application API**.
  - User credentials, email changes, and role promotions can only be modified directly by the owner in the **Cloudflare D1 Dashboard Console**.
  - Any direct SQL targeting the `users` table from application proxies is hard-blocked with `403 Forbidden`.
- **User-Isolated Data Workspace (`/api/data`)**:
  - Every user query is strictly scoped with `WHERE user_id = ?`.
  - Users can only access, create, and delete their own private memos, reminders, and items.
- **Custom Branded Zero-Latency Loading Screen**:
  - Instant inline CSS preloader inside `index.html` displaying the animated gold-and-emerald AG monogram before JavaScript bundles load.
  - React `LoadingScreen` component displayed during edge session verification (`/api/me`).
- **Complete Ali Garments Khata Ledger**:
  - 132 wholesale customers & 132 customer chunks verified in Cloudflare D1.
  - Single-row chunking engine saving 99% of D1 quotas.
  - 30-day multi-device synchronized Recycle Bin with delete consent safeguards.
  - Commercial Invoicing with WhatsApp sharing, PDF generation, and Excel (.xlsx) export.
- **PWA & Android APK Ready**:
  - Fully configured `manifest.json` (`display: "standalone"`), service worker (`sw.js`), security headers (`_headers`), and `robots.txt`.
  - Ready for one-click APK generation using PWABuilder or Capacitor.

---

## 🔒 Security Best Practices & Secret Storage Guide

### 1. Cloudflare Pages Deployment (Recommended)
When deploying to Cloudflare Pages:
1. Push your repository to GitHub (secrets are blocked by `.gitignore`).
2. Go to **Cloudflare Dashboard &rarr; Workers & Pages &rarr; Create application &rarr; Pages &rarr; Connect to Git**.
3. Select the `Ali-Garments` repository.
4. **Build settings**:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
5. **D1 Database Binding**:
   - In Pages project &rarr; **Settings &rarr; Functions &rarr; D1 database bindings**.
   - Click **Add binding**:
     - Variable name: `DB`
     - D1 database: select your `ali-garments` database (`5fbfb37e-e24a-4b51-9401-e861ff4b6dc1`).
6. **Environment Variables & Secrets**:
   - Go to **Settings &rarr; Environment variables**.
   - Add `SESSION_SECRET`: enter a strong 64-character random string (e.g., `openssl rand -hex 32`).
   - For local development with `npx wrangler pages dev dist`, place `SESSION_SECRET` inside `.dev.vars` (this file is blocked by `.gitignore` and never committed).

### 2. Vercel Deployment (If Hosting on Vercel)
If you deploy or test on Vercel:
- **Where to store `.env` on Vercel?**
  - **Never commit `.env` to Git!**
  - In your Vercel Dashboard, go to **Project &rarr; Settings &rarr; Environment Variables**.
  - Add the following variables:
    - `SESSION_SECRET` = your secret string
    - `CF_ACCOUNT_ID` = your Cloudflare account ID
    - `CF_DATABASE_ID` = your Cloudflare D1 database ID
    - `CF_API_TOKEN` = your Cloudflare API token (with D1:Edit permissions)
- **Server Error Logging**:
  - All errors are captured with `console.error(...)` on the server runtime, so they appear in **Vercel Logs / Cloudflare Real-Time Logs**.
  - The client screen receives only clean, generic error messages (`"Something went wrong. Please try again."`) to prevent sensitive internal stack traces from leaking.

---

## 🗄️ Database Schema & Initial Setup

The database schema is defined in `schema.sql`:

```sql
-- 1. Users Table (Closed Admin-only creation / D1 Console edit)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- 'admin', 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. User-Owned Items Table (Strictly scoped: WHERE user_id = ?)
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Customers Table
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

-- 4. Customer Chunks Table (1 Row per customer)
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

-- 6. Recycle Bin Table (30-day retention)
CREATE TABLE IF NOT EXISTS recycle_bin (
    bin_id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL,
    customer_id TEXT,
    title TEXT NOT NULL,
    item_json TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
```

---

## 🔑 Seeding the First Admin User

To create your initial administrator account safely in Cloudflare D1:

1. Run the admin creation script locally:
   ```bash
   node scripts/create-admin.js "Ali Amir" "admin@aligarments.com" "YourStrongPassword"
   ```
2. The script computes the PBKDF2 Web Crypto hash and outputs the exact SQL statement:
   ```sql
   INSERT INTO users (name, email, password_hash, role)
   VALUES ('Ali Amir', 'admin@aligarments.com', 'SALT_HEX:HASH_HEX', 'admin')
   ON CONFLICT(email) DO UPDATE SET
     name = excluded.name,
     password_hash = excluded.password_hash,
     role = 'admin';
   ```
3. Open **Cloudflare Dashboard &rarr; Workers & Pages &rarr; D1 &rarr; ali-garments &rarr; Console**.
4. Paste the SQL query and click **Execute**.

---

## 🛠️ How to Edit User Accounts in D1 Dashboard

Because user accounts cannot be edited from the web application interface for zero-trust security:

- **To Change a User's Password**:
  1. Generate the new PBKDF2 hash using `node scripts/create-admin.js "User Name" "email" "NewPassword"`.
  2. In Cloudflare D1 Console, run:
     ```sql
     UPDATE users SET password_hash = 'NEW_SALT:NEW_HASH' WHERE email = 'user@aligarments.com';
     ```
- **To Promote a User to Admin**:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'user@aligarments.com';
  ```
- **To Delete a User**:
  ```sql
  DELETE FROM users WHERE email = 'user@aligarments.com';
  ```

---

## 📱 Building the Android APK

1. **Option A: PWABuilder (Zero Install)**
   - Deploy your live site to Cloudflare Pages (e.g. `https://ali-garments.pages.dev`).
   - Visit [PWABuilder.com](https://www.pwabuilder.com).
   - Enter your `https://...pages.dev` URL.
   - Click **Build My APK** and download the signed APK or Android Studio project!

2. **Option B: Capacitor CLI**
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```
   - In Android Studio, select **Build &rarr; Build Bundle(s) / APK(s) &rarr; Build APK(s)**.

---

## 📦 Project Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Starts Vite local development server |
| `npm run build` | Builds production frontend into `dist/` |
| `npm run preview` | Previews production build locally |
| `node scripts/create-admin.js` | Generates PBKDF2 SQL statement for D1 console |

---

*© 2026 ALI Garments. Closed Multi-User Enterprise System.*
