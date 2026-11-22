import * as XLSX from 'xlsx';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { saveFileToDevice } from './fileSaver';

/**
 * Universal safe Excel file saver
 * 1. If running inside Android APK with AndroidDownloadBridge / AndroidExcelBridge, saves directly to Android "Download" directory.
 * 2. If running inside native Capacitor, uses Filesystem to write to external/public storage.
 * 3. In Web browser, triggers standard browser download.
 * Returns { success: boolean, filename: string, location: string }
 */
export async function saveWorkbook(wb, filename) {
  try {
    const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    return await saveFileToDevice(filename, base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (err) {
    console.error('Failed to save workbook via device saver, falling back to XLSX:', err);
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

/**
 * Downloads a professional, formatted Invoice to Excel
 */
export async function downloadInvoiceExcel(invoice, settings = {}) {
  const wb = XLSX.utils.book_new();
  const shopName = settings.shopName || 'ALI GARMENTS';
  const currency = settings.currency || 'PKR';
  const invoiceNum = invoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
  const dateStr = invoice.date || new Date().toISOString().slice(0, 10);
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  const rows = [
    [shopName.toUpperCase()],
    [settings.tagline || 'Excellence in Garments Wholesale & Retail'],
    [settings.address ? `Address: ${settings.address}` : ''],
    [settings.phone1 ? `Phone: ${settings.phone1} ${settings.phone2 ? ' | ' + settings.phone2 : ''}` : ''],
    [],
    ['TAX / COMMERCIAL INVOICE'],
    ['Invoice Number:', invoiceNum, '', 'Date:', dateStr],
    ['Due Date:', invoice.dueDate || '-', '', 'Payment Status:', invoice.paymentStatus || 'Pending'],
    [],
    ['BILLED TO (CUSTOMER DETAILS):'],
    ['Customer Name:', invoice.customerName || 'Walk-in Customer'],
    ['Phone Number:', invoice.customerPhone || '-'],
    ['Address:', invoice.customerAddress || '-'],
    [],
    ['#', 'ITEM DESCRIPTION', 'QTY', 'UNIT PRICE (' + currency + ')', 'TOTAL (' + currency + ')']
  ];

  items.forEach((item, idx) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const total = Number(item.total || qty * rate);
    rows.push([
      idx + 1,
      item.desc || 'Garment Item',
      qty,
      rate,
      total
    ]);
  });

  rows.push([]);
  rows.push(['', '', '', 'Subtotal:', Number(invoice.subtotal || 0)]);
  if (Number(invoice.discount || 0) > 0) {
    rows.push(['', '', '', 'Discount:', -Number(invoice.discount || 0)]);
  }
  if (Number(invoice.taxAmount || 0) > 0) {
    rows.push(['', '', '', `Tax (${invoice.taxPercent || 0}%):`, Number(invoice.taxAmount || 0)]);
  }
  rows.push(['', '', '', `GRAND TOTAL (${currency}):`, Number(invoice.total || 0)]);

  if (invoice.notes) {
    rows.push([]);
    rows.push(['TERMS & CONDITIONS / NOTES:']);
    rows.push([invoice.notes]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // #
    { wch: 38 }, // Description
    { wch: 12 }, // Qty
    { wch: 20 }, // Unit Price
    { wch: 22 }  // Total
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
  const safeFilename = `${shopName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Invoice_${invoiceNum.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
  return await saveWorkbook(wb, safeFilename);
}

/**
 * Triggers direct download of an HTML invoice document
 */
export function downloadInvoiceHtml(invoice, settings = {}) {
  const shopName = settings.shopName || 'ALI GARMENTS';
  const currency = settings.currency || 'PKR';
  const invoiceNum = invoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
  const dateStr = invoice.date || new Date().toISOString().slice(0, 10);
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  const itemsHtml = items.map((it, idx) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${it.desc || 'Garment Item'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.qty || 0}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${currency} ${Number(it.rate || 0).toLocaleString()}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${currency} ${Number(it.total || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${shopName} - Invoice ${invoiceNum}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #fff; }
    .invoice-card { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
    .shop-title { font-size: 26px; font-weight: 800; color: #047857; text-transform: uppercase; margin: 0; }
    .inv-title { font-size: 22px; font-weight: 700; color: #334155; margin: 0; text-align: right; }
    .info-grid { display: flex; justify-content: space-between; margin: 24px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
    th { background: #f1f5f9; padding: 10px 12px; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 12px; border-bottom: 2px solid #cbd5e1; }
    .totals { margin-top: 24px; display: flex; justify-content: flex-end; }
    .totals-table { width: 320px; font-size: 14px; }
    .grand-total { font-size: 18px; font-weight: 800; color: #047857; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; color: #64748b; }
    @media print { body { padding: 0; } .invoice-card { border: none; box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <h1 class="shop-title">${shopName}</h1>
        <p style="margin: 4px 0; color: #64748b; font-size: 13px;">${settings.tagline || 'Garments Wholesale & Retail'}</p>
        <p style="margin: 2px 0; font-size: 12px;">${settings.address || ''}</p>
        <p style="margin: 2px 0; font-size: 12px;">Phone: ${settings.phone1 || ''}</p>
      </div>
      <div>
        <h2 class="inv-title">INVOICE</h2>
        <p style="margin: 4px 0; font-weight: bold; text-align: right;"># ${invoiceNum}</p>
        <p style="margin: 2px 0; font-size: 13px; text-align: right; color: #64748b;">Date: ${dateStr}</p>
      </div>
    </div>
    <div class="info-grid">
      <div>
        <strong style="font-size: 12px; text-transform: uppercase; color: #64748b;">Billed To:</strong>
        <p style="margin: 4px 0; font-size: 15px; font-weight: bold;">${invoice.customerName || 'Walk-in Customer'}</p>
        <p style="margin: 2px 0; font-size: 13px; color: #64748b;">${invoice.customerPhone || ''}</p>
        <p style="margin: 2px 0; font-size: 13px; color: #64748b;">${invoice.customerAddress || ''}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th style="text-align: left;">Item Description</th>
          <th style="width: 80px; text-align: center;">Qty</th>
          <th style="width: 120px; text-align: right;">Rate</th>
          <th style="width: 130px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    <div class="totals">
      <table class="totals-table">
        <tr><td style="padding: 6px 0;">Subtotal:</td><td style="text-align: right; font-weight: 600;">${currency} ${Number(invoice.subtotal || 0).toLocaleString()}</td></tr>
        ${Number(invoice.discount || 0) > 0 ? `<tr><td style="padding: 6px 0; color: #e11d48;">Discount:</td><td style="text-align: right; color: #e11d48; font-weight: 600;">-${currency} ${Number(invoice.discount).toLocaleString()}</td></tr>` : ''}
        ${Number(invoice.taxAmount || 0) > 0 ? `<tr><td style="padding: 6px 0;">Tax (${invoice.taxPercent}%):</td><td style="text-align: right; font-weight: 600;">${currency} ${Number(invoice.taxAmount).toLocaleString()}</td></tr>` : ''}
        <tr class="grand-total"><td style="padding: 10px 0;">Grand Total:</td><td style="text-align: right;">${currency} ${Number(invoice.total || 0).toLocaleString()}</td></tr>
      </table>
    </div>
    <div class="footer">
      <div>
        <p style="margin: 0; font-weight: 600;">Terms & Notes:</p>
        <p style="margin: 2px 0;">${invoice.notes || 'Thank you for your business!'}</p>
      </div>
      <div style="text-align: center; border-top: 1px dashed #64748b; padding-top: 8px; width: 140px;">
        <span style="font-weight: 600;">ALI Garments</span><br><span style="font-size: 10px;">Authorized Signature</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const filename = `${shopName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Invoice_${invoiceNum.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { success: true, filename, location: 'Downloads' };
}
