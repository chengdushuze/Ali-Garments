import * as XLSX from 'xlsx';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/**
 * Universal file saver for Web and Android Capacitor:
 * 1. If running inside Android APK with AndroidExcelBridge, saves directly to the Android "Downloads" folder!
 * 2. If running inside native Capacitor, uses Filesystem to write to external/public storage.
 * 3. In Web browser, triggers standard browser download via XLSX.writeFile.
 * Returns { success: boolean, filename: string, location: string }
 */
export async function saveWorkbook(wb, filename) {
  try {
    // 1. Android Native Bridge (Guaranteed save directly into Android's Downloads directory)
    if (typeof window !== 'undefined' && window.AndroidExcelBridge && typeof window.AndroidExcelBridge.saveExcelToDownloads === 'function') {
      const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const ok = window.AndroidExcelBridge.saveExcelToDownloads(filename, base64Data);
      if (ok) {
        return { success: true, filename, location: 'Android Downloads folder' };
      }
    }

    // 2. Capacitor Native Platform
    if (Capacitor.isNativePlatform()) {
      const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      try {
        await Filesystem.writeFile({
          path: `Download/${filename}`,
          data: base64Data,
          directory: Directory.External,
          recursive: true
        });
        return { success: true, filename, location: 'Downloads folder' };
      } catch (e) {
        // Fallback to Documents
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        return { success: true, filename, location: 'Documents folder' };
      }
    }

    // 3. Web Browser standard download
    XLSX.writeFile(wb, filename);
    return { success: true, filename, location: 'Downloads' };
  } catch (err) {
    console.error('Failed to save workbook:', err);
    try {
      XLSX.writeFile(wb, filename);
      return { success: true, filename, location: 'Downloads' };
    } catch (e) {
      return { success: false, error: err.message };
    }
  }
}

/**
 * Format a number as financial accounting currency string
 * e.g. 19080 => "19,080.00", -8760 => "(8,760.00)", 0 => "-"
 */
function formatAccounting(num) {
  if (num === 0 || num === null || num === undefined) return '-';
  const absVal = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return num < 0 ? `(${absVal})` : absVal;
}

/**
 * Formats ISO or date string to YYYY-MM-DD
 */
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

/**
 * Formats ISO or time string to HH:MM:SS
 */
function formatTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) {
    if (typeof d === 'string' && d.includes(':')) return d.slice(0, 8);
    return '';
  }
  return dt.toTimeString().slice(0, 8);
}

/**
 * Downloads a specific customer's ledger sheet formatted exactly like the authentic Garment Book statements
 */
export async function downloadCustomerExcel(customer, transactions, settings = {}) {
  const wb = XLSX.utils.book_new();
  const shopName = settings.shopName || 'ALI Garments';
  const currency = settings.currency || 'Rs.';

  const txs = [...(transactions || [])].sort((a, b) => {
    const timeA = new Date(a.dateTime || a.date).getTime() || 0;
    const timeB = new Date(b.dateTime || b.date).getTime() || 0;
    return timeA - timeB;
  });

  const firstDate = txs.length > 0 ? formatDate(txs[0].dateTime || txs[0].date) : '-';
  const lastDate = txs.length > 0 ? formatDate(txs[txs.length - 1].dateTime || txs[txs.length - 1].date) : '-';

  // Calculate totals
  let totalDebit = 0;  // You Gave (ادھار دیا)
  let totalCredit = 0; // You Got (وصولی ملی)
  let running = 0;

  txs.forEach(t => {
    const amt = Number(t.amount || 0);
    if (t.type === 'give') {
      totalDebit += amt;
    } else {
      totalCredit += amt;
    }
  });

  const netBalance = totalDebit - totalCredit;
  const accountStatus = netBalance > 0
    ? 'Receivable (Customer Owes)'
    : netBalance < 0
    ? 'Advance / Credit'
    : 'Settled';

  const rows = [
    // Header Info
    [`Customer Ledger Statement: ${customer.name}`],
    [`Source: ${shopName} Book | Period: ${firstDate} to ${lastDate} | Total Entries: ${txs.length}`],
    [],
    // KPI Summary Table
    ['Total Transactions', 'Total You Gave (Debit)', 'Total You Got (Credit)', 'Net Receivable Balance', 'Account Status'],
    [txs.length, formatAccounting(totalDebit), formatAccounting(totalCredit), formatAccounting(netBalance), accountStatus],
    [],
    // Detailed Transactions Header
    ['#', 'Date', 'Time', 'Bill Number', 'Description', 'You Gave (Debit)', 'You Got (Credit)', 'Running Balance']
  ];

  // Populate transaction entries
  running = 0;
  txs.forEach((t, index) => {
    const amt = Number(t.amount || 0);
    const isDebit = t.type === 'give';
    if (isDebit) {
      running += amt;
    } else {
      running -= amt;
    }

    const dateVal = formatDate(t.dateTime || t.date);
    const timeVal = formatTime(t.dateTime || t.time);

    rows.push([
      index + 1,
      dateVal,
      timeVal,
      t.billNumber && t.billNumber !== '""' ? t.billNumber : '',
      t.description && t.description !== '""' ? t.description : '',
      isDebit ? amt : 0,
      !isDebit ? amt : 0,
      formatAccounting(running)
    ]);
  });

  // Footer Totals Row
  rows.push([
    'TOTAL',
    '',
    '',
    '',
    `${txs.length} Transactions`,
    formatAccounting(totalDebit),
    formatAccounting(totalCredit),
    formatAccounting(netBalance)
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Auto column widths for clean readability
  ws['!cols'] = [
    { wch: 6 },   // #
    { wch: 14 },  // Date
    { wch: 12 },  // Time
    { wch: 14 },  // Bill Number
    { wch: 30 },  // Description
    { wch: 18 },  // You Gave (Debit)
    { wch: 18 },  // You Got (Credit)
    { wch: 20 }   // Running Balance
  ];

  const sheetTitle = (customer.name || 'Party').replace(/[:\\/?*\[\]]/g, '').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

  const cleanFilename = (customer.name || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_');
  return await saveWorkbook(wb, `${cleanFilename}_Ledger_Statement.xlsx`);
}

/**
 * Downloads a complete multi-sheet Excel file of all customers and all transactions with executive styling
 */
export async function downloadAllDataExcel(customers, transactionsMap, settings = {}) {
  const wb = XLSX.utils.book_new();
  const shopName = settings.shopName || 'ALI Garments';
  const currency = settings.currency || 'Rs.';
  const todayStr = new Date().toISOString().slice(0, 10);

  // -------------------------------------------------------------
  // Sheet 1: Master Parties Summary (Executive Khata Overview)
  // -------------------------------------------------------------
  const summaryRows = [
    [`${shopName.toUpperCase()} - CONSOLIDATED LEDGER & PARTIES DIRECTORY`],
    [`Export Date: ${new Date().toLocaleString()} | Total Parties: ${customers.length}`],
    [`Business Address: ${settings.address || 'Cloth Market, Faisalabad'} | Phone: ${settings.phone1 || ''}`],
    [],
    ['Party ID', 'Party Name', 'Phone Number', 'Category', 'Address / Market', 'Total Gave (Debit)', 'Total Got (Credit)', 'Net Balance', 'Status', 'Total Entries']
  ];

  let grandDebit = 0;
  let grandCredit = 0;
  let totalReceivable = 0;
  let totalPayable = 0;
  let totalAllTxCount = 0;

  customers.forEach(c => {
    const txs = transactionsMap[c.id] || [];
    totalAllTxCount += txs.length;

    let custDebit = 0;
    let custCredit = 0;

    txs.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.type === 'give') custDebit += amt;
      else custCredit += amt;
    });

    const net = custDebit - custCredit;
    grandDebit += custDebit;
    grandCredit += custCredit;

    if (net > 0) totalReceivable += net;
    else if (net < 0) totalPayable += Math.abs(net);

    summaryRows.push([
      c.id,
      c.name,
      c.phone || '-',
      c.category || 'wholesale',
      c.address || '-',
      formatAccounting(custDebit),
      formatAccounting(custCredit),
      formatAccounting(net),
      net > 0 ? 'Receivable (Lene Hain)' : net < 0 ? 'Payable (Dene Hain)' : 'Settled',
      txs.length
    ]);
  });

  const netBusinessBalance = totalReceivable - totalPayable;

  summaryRows.push([]);
  summaryRows.push([
    'TOTALS',
    `${customers.length} Parties`,
    '',
    '',
    '',
    formatAccounting(grandDebit),
    formatAccounting(grandCredit),
    formatAccounting(netBusinessBalance),
    netBusinessBalance >= 0 ? 'Surplus in Market' : 'Net Payables Higher',
    totalAllTxCount
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 16 }, // ID
    { wch: 28 }, // Name
    { wch: 16 }, // Phone
    { wch: 14 }, // Category
    { wch: 28 }, // Address
    { wch: 20 }, // Gave
    { wch: 20 }, // Got
    { wch: 20 }, // Net
    { wch: 24 }, // Status
    { wch: 14 }  // Entries
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Parties Summary');

  // -------------------------------------------------------------
  // Sheet 2: All Detailed Chronological Transactions
  // -------------------------------------------------------------
  const allTxRows = [
    ['#', 'Date', 'Time', 'Party Name', 'Party Phone', 'Type', 'Description / Goods', 'Bill #', 'You Gave (Debit)', 'You Got (Credit)', 'Running Balance', 'Payment Mode']
  ];

  let entryIndex = 1;

  customers.forEach(c => {
    const txs = transactionsMap[c.id] || [];
    let running = 0;

    const sorted = [...txs].sort((a, b) => {
      const timeA = new Date(a.dateTime || a.date).getTime() || 0;
      const timeB = new Date(b.dateTime || b.date).getTime() || 0;
      return timeA - timeB;
    });

    sorted.forEach(t => {
      const amt = Number(t.amount || 0);
      const isDebit = t.type === 'give';
      if (isDebit) running += amt;
      else running -= amt;

      allTxRows.push([
        entryIndex++,
        formatDate(t.dateTime || t.date),
        formatTime(t.dateTime || t.time),
        c.name,
        c.phone || '',
        isDebit ? 'You Gave (ادھار دیا)' : 'You Got (وصولی ملی)',
        t.description && t.description !== '""' ? t.description : '-',
        t.billNumber && t.billNumber !== '""' ? t.billNumber : '-',
        isDebit ? amt : 0,
        !isDebit ? amt : 0,
        formatAccounting(running),
        t.paymentMethod || 'Cash'
      ]);
    });
  });

  const wsAllTxs = XLSX.utils.aoa_to_sheet(allTxRows);
  wsAllTxs['!cols'] = [
    { wch: 6 },  // #
    { wch: 14 }, // Date
    { wch: 12 }, // Time
    { wch: 26 }, // Party
    { wch: 16 }, // Phone
    { wch: 20 }, // Type
    { wch: 30 }, // Description
    { wch: 14 }, // Bill #
    { wch: 18 }, // Gave
    { wch: 18 }, // Got
    { wch: 20 }, // Running Balance
    { wch: 14 }  // Mode
  ];
  XLSX.utils.book_append_sheet(wb, wsAllTxs, 'All Transactions');

  return await saveWorkbook(wb, `${shopName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Complete_Ledger_${todayStr}.xlsx`);
}

/**
 * Downloads the Enterprise Security Audit Trail Report to formatted Excel
 */
export async function downloadAuditTrailExcel(logs = []) {
  const wb = XLSX.utils.book_new();
  const todayStr = new Date().toISOString().slice(0, 10);

  const rows = [
    ['ALI GARMENTS - ENTERPRISE SECURITY & ACTIVITY AUDIT TRAIL'],
    [`Generated: ${new Date().toLocaleString()} | Total Records: ${logs.length}`],
    [],
    ['ID', 'Date & Time', 'User / Actor', 'Action', 'Event Details', 'IP Address']
  ];

  logs.forEach(log => {
    rows.push([
      log.id || '-',
      log.created_at ? new Date(log.created_at).toLocaleString() : '-',
      log.user_email || 'System',
      log.action || '-',
      log.details || '-',
      log.ip_address || '-'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8 },  // ID
    { wch: 22 }, // Date & Time
    { wch: 28 }, // User / Actor
    { wch: 22 }, // Action
    { wch: 50 }, // Event Details
    { wch: 18 }  // IP Address
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Audit Trails');
  return await saveWorkbook(wb, `ALI_Garments_Audit_Trail_${todayStr}.xlsx`);
}
