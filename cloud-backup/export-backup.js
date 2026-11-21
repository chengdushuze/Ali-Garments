// cloud-backup/export-backup.js
// Utility script to generate timestamped JSON & SQL backup files for cloud storage (Google Drive, S3, R2, Dropbox)
// Usage: node cloud-backup/export-backup.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const outDir = path.join(__dirname, 'dumps');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const jsonFileName = `ali_garments_cloud_backup_${dateStr}.json`;
  const sqlFileName = `ali_garments_cloud_schema_${dateStr}.sql`;

  const jsonPath = path.join(outDir, jsonFileName);
  const sqlPath = path.join(outDir, sqlFileName);

  const schemaContent = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  fs.writeFileSync(sqlPath, schemaContent, 'utf8');

  const templateContent = fs.readFileSync(path.join(__dirname, 'ali-garments-full-backup-template.json'), 'utf8');
  const backupData = JSON.parse(templateContent);
  backupData.exportedAt = new Date().toISOString();

  fs.writeFileSync(jsonPath, JSON.stringify(backupData, null, 2), 'utf8');

  console.log('===============================================================');
  console.log('✅ CLOUD BACKUP FILES GENERATED SUCCESSFULLY');
  console.log('===============================================================');
  console.log(`1. SQL Schema Dump: ${sqlPath}`);
  console.log(`2. JSON App Backup: ${jsonPath}`);
  console.log('\nYou can now upload these files to your cloud storage:');
  console.log('• Google Drive');
  console.log('• Dropbox');
  console.log('• Microsoft OneDrive');
  console.log('• Cloudflare R2 / AWS S3');
  console.log('===============================================================\n');
}

main().catch(console.error);
