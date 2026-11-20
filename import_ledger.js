import fs from 'fs';
import path from 'path';

const accountId = process.env.CF_ACCOUNT_ID || '';
const databaseId = process.env.CF_DATABASE_ID || '';
const apiToken = process.env.CF_API_TOKEN || '';
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

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
    throw new Error(data.errors?.[0]?.message || res.statusText);
  }
  return data;
}

function parseNumber(str) {
  if (!str) return 0;
  let clean = str.replace(/[",]/g, '').trim();
  if (clean.startsWith('(') && clean.endsWith(')')) {
    clean = '-' + clean.slice(1, -1);
  }
  if (clean === '-' || clean === '') return 0;
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parseLedgerData() {
  const transcriptPath = 'C:\\Users\\canva\\.gemini\\antigravity\\brain\\186a54dc-b423-4c32-8878-ca7af60839ff\\.system_generated\\logs\\transcript.jsonl';
  const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');

  let rawText = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.content && obj.content.includes('Customer Ledger Statement:')) {
        rawText = obj.content;
        break;
      }
    } catch (e) {}
  }

  if (!rawText) {
    throw new Error('Could not find Customer Ledger Statement in transcript.');
  }

  // Split into customer blocks
  const parts = rawText.split(/(?=Customer Ledger Statement:)/g);
  const customers = [];

  for (const part of parts) {
    if (!part.includes('Customer Ledger Statement:')) continue;

    const blockLines = part.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (blockLines.length === 0) continue;

    // Header line e.g. Customer Ledger Statement: 4 Season G9,,,,,,,
    const headerMatch = blockLines[0].match(/Customer Ledger Statement:\s*([^,]+)/i);
    if (!headerMatch) continue;
    let customerName = headerMatch[1].replace(/["']/g, '').trim();

    // Find summary block
    let netBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalTxs = 0;
    let tableStartIndex = -1;

    for (let j = 0; j < blockLines.length; j++) {
      const line = blockLines[j];
      if (line.includes('Total Transactions,Total You Gave')) {
        // Next line contains totals
        const totalsLine = blockLines[j + 1];
        if (totalsLine) {
          const cols = totalsLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          totalTxs = parseInt(cols[0], 10) || 0;
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

    if (tableStartIndex === -1) continue;

    const transactions = [];
    for (let k = tableStartIndex; k < blockLines.length; k++) {
      const row = blockLines[k];
      if (row.startsWith('TOTAL,') || row.startsWith('Customer Ledger Statement:')) break;

      const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
      if (cols.length < 7) continue;

      const entryNum = cols[0];
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
      const validDateTime = !isNaN(dateObj) ? dateObj.toISOString() : `${date}T${time || '12:00:00'}Z`;

      transactions.push({
        id: `tx_${customerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${entryNum}`,
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

    const custId = `cust_${customerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    const calculatedBalance = transactions.length > 0
      ? transactions[transactions.length - 1].balanceAfter
      : netBalance;

    customers.push({
      id: custId,
      name: customerName,
      phone: '0335-4311792', // from source filename _923354311792.xlsx
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
  console.log('Parsing ledger data...');
  const customers = parseLedgerData();
  console.log(`Parsed ${customers.length} customer ledgers successfully!`);

  let totalAllTxs = 0;
  for (const c of customers) totalAllTxs += c.transactions.length;
  console.log(`Total transactions parsed across all parties: ${totalAllTxs}`);

  console.log('Uploading each customer to Cloudflare D1 using 1 single row per customer...');

  for (let idx = 0; idx < customers.length; idx++) {
    const cust = customers[idx];
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

    // 2. Upsert customer chunk row (ONE ROW FOR ALL TRANSACTIONS)
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

    console.log(`[${idx + 1}/${customers.length}] Saved "${cust.name}": ${cust.totalTransactions} transactions packed into 1 single D1 row (${Math.round(byteSize / 1024)} KB)`);
  }

  console.log('\nAll customer ledgers successfully added to Cloudflare D1!');

  // Save as local seed file for the app frontend
  const seedPath = 'C:\\Users\\canva\\.gemini\\antigravity\\scratch\\ali-garments\\src\\data\\seedData.json';
  fs.mkdirSync(path.dirname(seedPath), { recursive: true });
  fs.writeFileSync(seedPath, JSON.stringify(customers, null, 2));
  console.log(`Saved local seed data with ${customers.length} parties at ${seedPath}`);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
