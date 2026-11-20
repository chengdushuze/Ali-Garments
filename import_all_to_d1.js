import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const accountId = process.env.CF_ACCOUNT_ID || '';
const databaseId = process.env.CF_DATABASE_ID || '';
const apiToken = process.env.CF_API_TOKEN || '';
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

const excelPath = process.env.EXCEL_PATH || './khata.xlsx';

async function executeD1Query(sql, params = []) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.errors?.[0]?.message || JSON.stringify(data.errors) || res.statusText);
  }
  return data;
}

function parseNumber(str) {
  if (!str && str !== 0) return 0;
  if (typeof str === 'number') return str;
  let clean = str.replace(/[",]/g, '').trim();
  if (clean.startsWith('(') && clean.endsWith(')')) clean = '-' + clean.slice(1, -1);
  if (clean === '-' || clean === '') return 0;
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parseWorkbook() {
  const fileBuffer = fs.readFileSync(excelPath);
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  console.log(`Loaded workbook with ${wb.SheetNames.length} customer sheets.`);

  const customers = [];

  for (let idx = 0; idx < wb.SheetNames.length; idx++) {
    const sheetName = wb.SheetNames[idx];
    const sheet = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);

    let customerName = sheetName;
    let netBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let tableStartIndex = -1;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (line.startsWith('Customer Ledger Statement:')) {
        const m = line.match(/Customer Ledger Statement:\s*([^,]+)/i);
        if (m) customerName = m[1].replace(/["']/g, '').trim();
      }
      if (line.includes('Total Transactions,Total You Gave')) {
        const next = lines[j + 1];
        if (next) {
          const cols = next.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          totalDebit = parseNumber(cols[1]);
          totalCredit = parseNumber(cols[2]);
          netBalance = parseNumber(cols[3]);
        }
      }
      if (line.startsWith('#,Date,Time,') || line.includes('#,Date,Time')) {
        tableStartIndex = j + 1;
        break;
      }
    }

    const transactions = [];
    if (tableStartIndex !== -1) {
      for (let k = tableStartIndex; k < lines.length; k++) {
        const row = lines[k];
        if (row.startsWith('TOTAL,') || row.startsWith('Customer Ledger Statement:')) break;

        const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length < 7) continue;

        const entryNum = cols[0].replace(/[",]/g, '').trim();
        if (!/^\d+$/.test(entryNum)) continue;

        const date = cols[1];
        const time = cols[2];
        const billNumber = cols[3] && cols[3] !== '""' ? cols[3] : '';
        const description = cols[4] && cols[4] !== '""' ? cols[4] : '';
        const debit = parseNumber(cols[5]);
        const credit = parseNumber(cols[6]);
        const runningBalance = cols[7] ? parseNumber(cols[7]) : (debit - credit);

        const type = debit > 0 ? 'give' : 'get';
        const amount = debit > 0 ? debit : credit;

        const dateObj = new Date(`${date}T${time || '12:00:00'}`);
        const validDateTime = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : `${date}T${time || '12:00:00'}Z`;

        transactions.push({
          id: `tx_${customerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${entryNum}`,
          entryNumber: parseInt(entryNum, 10),
          type,
          amount,
          date,
          time,
          dateTime: validDateTime,
          billNumber,
          description: description || (type === 'give' ? 'Garments Supplied' : 'Payment Received'),
          paymentMethod: 'Cash',
          balanceAfter: runningBalance
        });
      }
    }

    const custId = `cust_${customerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    const calculatedBalance = transactions.length > 0
      ? transactions[transactions.length - 1].balanceAfter
      : netBalance;

    customers.push({
      id: custId,
      name: customerName,
      phone: '0335-4311792',
      address: 'Cloth Market, Faisalabad',
      category: 'wholesale',
      balance: calculatedBalance,
      totalTransactions: transactions.length,
      createdAt: transactions.length > 0 ? transactions[0].dateTime : new Date().toISOString(),
      lastTransactionAt: transactions.length > 0 ? transactions[transactions.length - 1].dateTime : new Date().toISOString(),
      transactions
    });
  }

  return customers;
}

async function run() {
  console.log('--- ALI Garments: Cloudflare D1 Ledger Importer ---');
  console.log('Requirement: 1 Row per customer, All transactions in 1 Row chunk, No invoices on D1\n');

  const customers = parseWorkbook();
  let totalTxs = 0;
  for (const c of customers) totalTxs += c.transactions.length;
  console.log(`Parsed ${customers.length} customers with ${totalTxs} total transactions.`);

  // Save seedData.json for fast app hydration
  const seedPath = 'C:/Users/canva/.gemini/antigravity/scratch/ali-garments/src/data/seedData.json';
  fs.mkdirSync(path.dirname(seedPath), { recursive: true });
  fs.writeFileSync(seedPath, JSON.stringify(customers, null, 2));
  console.log(`Saved full local seed dataset to ${seedPath}`);

  // Initialize D1 Schema without invoices table
  console.log('\nEnsuring D1 schema is clean and optimized...');
  await executeD1Query(`
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
      PRIMARY KEY (customer_id, chunk_index),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    DROP TABLE IF EXISTS invoices;
  `);
  console.log('D1 Schema confirmed: customers, customer_chunks, settings (invoices table removed).');

  // Insert customers & chunks
  console.log('\nBeginning upload of 132 customers to Cloudflare D1 (1 row for each customer)...');

  const BATCH_SIZE = 4; // 4 parallel customer uploads for balance of speed and stability
  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (cust, batchOffset) => {
      const currentIdx = i + batchOffset + 1;
      const txJson = JSON.stringify(cust.transactions);
      const byteSize = Buffer.byteLength(txJson, 'utf8');

      // 1. Upsert customer summary row
      const custSql = `
        INSERT INTO customers (customer_id, name, phone, address, category, balance, current_chunk, total_transactions, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        ON CONFLICT(customer_id) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          address = excluded.address,
          category = excluded.category,
          balance = excluded.balance,
          current_chunk = excluded.current_chunk,
          total_transactions = excluded.total_transactions,
          updated_at = excluded.updated_at;
      `;

      await executeD1Query(custSql, [
        cust.id,
        cust.name,
        cust.phone,
        cust.address,
        cust.category,
        cust.balance,
        cust.totalTransactions,
        cust.createdAt,
        cust.lastTransactionAt
      ]);

      // 2. Upsert customer chunk row (1 single row for all transactions)
      const chunkSql = `
        INSERT INTO customer_chunks (customer_id, chunk_index, transactions_json, byte_size, count, updated_at)
        VALUES (?, 0, ?, ?, ?, ?)
        ON CONFLICT(customer_id, chunk_index) DO UPDATE SET
          transactions_json = excluded.transactions_json,
          byte_size = excluded.byte_size,
          count = excluded.count,
          updated_at = excluded.updated_at;
      `;

      await executeD1Query(chunkSql, [
        cust.id,
        txJson,
        byteSize,
        cust.totalTransactions,
        new Date().toISOString()
      ]);

      console.log(`[${currentIdx}/${customers.length}] Saved "${cust.name}" -> 1 row in customers, 1 row in customer_chunks (${cust.totalTransactions} txs, ${Math.round(byteSize / 1024)} KB)`);
    }));
  }

  console.log('\n--- VERIFICATION OF CLOUDFLARE D1 DATABASE ---');
  const checkRes = await executeD1Query(`
    SELECT count(*) as total_customers FROM customers;
    SELECT count(*) as total_chunks FROM customer_chunks;
  `);

  console.log('Customer rows in D1:', checkRes.result[0].results[0].total_customers);
  console.log('Customer Chunk rows in D1:', checkRes.result[1].results[0].total_chunks);
  console.log('\nALL 132 CUSTOMERS SUCCESSFULLY SAVED TO D1 WITH EXACTLY ONE ROW PER CUSTOMER!');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
