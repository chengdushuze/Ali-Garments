# ALI Garments — Enterprise Security & AI Development Instructions
**Classification:** STRICT INTERNAL MANDATE  
**Applies To:** All Developers, AI Agents, Subagents, and Automation Workflows

> **CRITICAL DIRECTIVE FOR ALL AI ASSISTANTS:**  
> When working on this codebase, you MUST strictly adhere to the security principles, architecture rules, and functional requirements outlined in this document. NEVER compromise security, NEVER re-introduce plaintext passwords, and NEVER expose database credentials in client code or Git.

---

## 1. Zero Plaintext Passwords Policy (SEC-VULN-01)
- **NO Plaintext Storage:** Passwords must **NEVER** be stored in cleartext in the database or written to columns such as `password_plain`.
- **NO Password Revelation in UI:** Features that attempt to view or decrypt passwords (such as "Reveal Password") are strictly prohibited.
- **Secure Password Changes Only:** If an administrator needs to resolve a forgotten password, they must use the **"Change / Reset Password"** modal.
- **Cryptographic Standards:** All password hashing must use native Web Crypto `PBKDF2` with `SHA-256`, 100,000 iterations, and a cryptographically secure 16-byte random salt (`functions/api/_auth.js`).

---

## 2. Cloudflare D1 Native Architecture & Zero Secret Exposure
- **No Client-Side Secrets:** Cloudflare Account ID, Database ID, and API Tokens must **NEVER** be displayed in the client settings UI, saved in `localStorage`, or committed to Git.
- **Serverless Edge Binding:** All database interactions must use the native Cloudflare Pages binding `env.DB`.
- **Prepared Statements Only:** Always use `env.DB.prepare(...).bind(...)`. NEVER concatenate user input into SQL queries.
- **No Arbitrary D1 Execution:** The `/api/d1` endpoint must enforce table whitelisting (`customers`, `customer_chunks`, `recycle_bin`, `settings`). Non-administrators are strictly blocked from blanket `DELETE` or `DROP TABLE` operations.

---

## 3. Session Security & Instant Multi-Device Revocation (SEC-VULN-03 & 04)
- **Mandatory Session Secret:** Sessions are signed using HMAC-SHA256 with the `SESSION_SECRET` environment variable. Never hardcode or leak secrets in git commits.
- **Token Versioning (`token_version`):**
  - The `users` table maintains a `token_version` integer.
  - The signed session payload includes `{ ver: user.token_version }`.
  - When an admin **suspends a user**, **deletes a user**, or **changes their password**, `token_version` is automatically incremented in D1:
    ```sql
    UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?;
    ```
  - Any request presenting a token with an outdated `ver` is immediately rejected with HTTP 401 (`isLoggedOut: true`).

---

## 4. Immediate Suspension, Deletion & Auto-Logout Protocol
- **Suspension Support:** Administrators can suspend users with predefined durations (3 days, 5 days, 7 days, 14 days, 30 days, or indefinite).
- **Instant Client Reaction:** When a user is suspended or deleted:
  - Any API call made by their device returns 401/403 with `isSuspended: true` (including `suspendedDays`) or `isDeleted: true`.
  - The client interceptor (`src/services/apiClient.js`) immediately triggers `ag_account_revocation`.
  - The app clears all local tokens and displays a clear popup modal:
    - *"Account Suspended for X days"* OR *"Account Removed"*.
  - When dismissed, the user is redirected to the Login Screen.

---

## 5. Strict VPN & Proxy Security Policy
- **Default Block:** By default, all connections originating from VPNs, Tor exit nodes, datacenter/hosting ASNs (DigitalOcean, Linode, Hetzner, OVH, Vultr, M247, etc.), corporate proxies, or IPs with high threat scores (>15) are **BLOCKED**.
- **Admin Authorization Required:** A user may ONLY connect through a VPN/Proxy if an Administrator has explicitly enabled **"Allow VPN / Proxy Access"** (`allow_vpn = 1`) for their account in the Admin Panel.
- **User Notice:** When blocked, the user is shown:
  *"VPN / Proxy Detected. Security policy requires Administrator authorization to access ALI Garments through a VPN or Proxy. Please disable your VPN or contact your administrator."*

---

## 6. Mobile PWA & Android APK UI Standards
- **Startup Screen:** The app must **ALWAYS** launch on the **Main / Home screen** (Parties Directory and Dashboard Stats). NEVER default to a specific customer (such as "4 Season G9") on launch.
- **Sticky Transaction Buttons:** In `CustomerDetail.jsx`, the **"You Gave" (ادھار دیا)** and **"You Got" (وصولی ملی)** action buttons must be sticky/pinned at the bottom of the screen (above mobile navigation) so the user never has to scroll through transaction feeds to record an entry.
- **App Lock Screen:**
  - Keypad numbers must be ultra-smooth with `touch-action: manipulation`, fast pointerdown response, and haptic feedback (no 300ms mobile touch delay).
  - Enforce Android-style rate limiting: 5 failed attempts locks the screen for 30 seconds with a real-time countdown timer.
- **Settings Screen:** On mobile screens, Settings must open as a clean full-screen view (never a cramped popup). No D1 database keys may be shown.

---

## 7. Cloudflare Worker Credit Optimization
- **No Tight Polling Loops:** NEVER poll `/api/me` every few seconds. Use visibility/focus-based checks throttled to at most once per 60–90 seconds.
- **Edge Cache for Static Assets:** Fast-path static assets (`/assets/*`, `.js`, `.css`, `.png`, `.svg`, `.woff2`) in `functions/_middleware.js` with `Cache-Control: public, max-age=31536000, immutable` so Cloudflare CDN serves them without consuming Worker credits.

---

## 8. Audit Trails & Role Confidentiality
- **Super Admin Confidentiality:** Audit log entries generated by or relating to the Super Admin (`admin@chengdushuze.com`) must **ONLY** be visible to the Super Admin. Standard admins cannot view Super Admin audit trails.
- **Delete Specific Logs:** Only the Super Admin is authorized to delete specific audit trail records.
- **Export / Download:** Administrators are allowed to download the complete audit trail to a formatted Excel file (`.xlsx`) via the **"Download Audit Trail"** button.

---

## 9. Pakistan-Only Geo Check & Super Admin Foreign Access Bypass
- **Pakistan-Only Default:** All connections to the application are restricted to Pakistan (`request.cf?.country === 'PK'`). Requests from other countries are blocked with HTTP 403 (`GEO_BLOCKED`).
- **Local Dev / Capacitor Native Handling:** When `request.cf` is undefined (e.g. local development, localhost, or direct native WebView), the geo-restriction is waived.
- **Super Admin Foreign Bypass:**
  - The `users` table includes an `allow_foreign_access` column (integer, default `0`).
  - **ONLY** the `super_admin` can toggle `allow_foreign_access` for specific users in the Admin Panel or API.
  - Users with `allow_foreign_access = 1` are permitted to connect from international locations.
  - Blocked access attempts from foreign countries are logged to `audit_logs`.

---

## 10. Zero Real Customer Data in Frontend Bundles (Data Privacy Mandate)
- **NO Real Data in Seed Files:** `src/data/seedData.json` must **NEVER** contain real customer names, phone numbers, addresses, ledger records, or balances.
- **Build Verification:** All production build chunks (`dist/assets/seedData-*.js`) must be verified to contain zero real customer data. Real customer data lives solely in Cloudflare D1 and is retrieved over authenticated, authorized API queries.
- **Android Hardening:**
  - `AndroidManifest.xml` must enforce `android:allowBackup="false"` and `android:usesCleartextTraffic="false"`.
  - WebView debugging must be disabled in release builds (`!BuildConfig.DEBUG`).
  - Web browser sessions must use secure `HttpOnly` cookies, avoiding storing raw session tokens in plain `localStorage`.

---
*Last verified & updated: 2026-11-22*
