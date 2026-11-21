# ALI Garments - Cloud Backup & Disaster Recovery Guide

This directory contains database schemas, templates, and scripts to back up and restore your ALI Garments Khata & ERP system to any cloud storage provider (Google Drive, Microsoft OneDrive, Dropbox, Cloudflare R2, or AWS S3).

---

## 1. Automated Nightly Cloud Backup (Cloudflare D1 to D1)
Your system has an automated worker (`workers/daily-backup/`) that runs nightly at **20:00 UTC (1:00 AM Pakistan Standard Time)**:
- Automatically snapshots all customers, transaction chunks, user accounts, and settings from primary D1 (`ali-garments`) to backup D1 (`ali-graments-backup`).
- You can also manually trigger this backup at any time from **Admin Panel > D1 Backup > Run Backup Now**.

---

## 2. Generating Cloud Backup Files (.json & .sql)
To generate fresh backup files to store in Google Drive, OneDrive, or Dropbox:
```bash
node cloud-backup/export-backup.js
```
This generates:
- `cloud-backup/dumps/ali_garments_cloud_backup_<DATE>.json`: Complete application data (settings, customers, ledgers, recycle bin).
- `cloud-backup/dumps/ali_garments_cloud_schema_<DATE>.sql`: Complete D1 database schema ready to recreate all tables.

---

## 3. Web & Mobile App One-Click Backup Download
1. Open the app on the web or Android APK.
2. Click **Settings (Gear Icon)**.
3. Scroll down to **Data Backup & Restore**.
4. Click **Download Backup (.json)**.
5. Save the downloaded `.json` file to your Google Drive or cloud folder.

---

## 4. How to Restore from Backup
### Option A: Via the Web or Android App UI
1. Go to **Settings > Data Backup & Restore**.
2. Click **Restore from Backup File**.
3. Select your `.json` backup file from your device/cloud.
4. All customers, transactions, and settings will instantly restore and sync to Cloudflare D1.

### Option B: Via Cloudflare D1 Console
1. Open Cloudflare Dashboard > **Workers & Pages** > **D1 SQL Database**.
2. Select your database (`ali-garments`).
3. Click the **Console** tab.
4. Copy and paste the contents of `cloud-backup/schema.sql` and execute.
