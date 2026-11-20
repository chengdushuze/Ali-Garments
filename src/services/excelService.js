import * as XLSX from 'xlsx';

/**
 * Downloads a complete multi-sheet Excel file of all customers and transactions
 */
export function downloadAllDataExcel(customers, transactionsMap, settings) {
  const wb = XLSX.utils.book_new();
  const currency = settings.currency || 'Rs.';

  // Sheet 1: Customers Summary
  const summaryRows = [
    ['ALI GARMENTS - COMPLETE KHATA & LEDGER STATEMENT'],
    [`Generated On: ${new Date().toLocaleString()}`],
    [`Business: ${settings.shopName || 'ALI Garments'} | Phone: ${settings.phone1 || ''}`],
    [],
    ['Customer ID', 'Customer Name', 'Phone Number', 'Category', 'Address', `Total Debit (Gave ${currency})`, `Total Credit (Got ${currency})`, `Net Balance (${currency})`, 'Status', 'Total Entries']
  ];

  let grandDebit = 0;
  let grandCredit = 0;
  let grandBalance = 0;

  customers.forEach(c => {
    const txs = transactionsMap[c.id] || [];
    let custDebit = 0;
    let custCredit = 0;
    txs.forEach(t => {
      if (t.type === 'give') custDebit += Number(t.amount || 0);
      else custCredit += Number(t.amount || 0);
    });

    const net = custDebit - custCredit;
    grandDebit += custDebit;
    grandCredit += custCredit;
    grandBalance += net;

    summaryRows.push([
      c.id,
      c.name,
      c.phone || '-',
      c.category || 'customer',
      c.address || '-',
      custDebit,
      custCredit,
      net,
      net > 0 ? 'You Will Receive' : net < 0 ? 'You Will Pay' : 'Settled',
      txs.length
    ]);
  });

  // Summary footer
  summaryRows.push([]);
  summaryRows.push(['TOTALS', '', '', '', '', grandDebit, grandCredit, grandBalance, grandBalance > 0 ? 'Net Receivable' : 'Net Payable', '']);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Customers Summary');

  // Sheet 2: All Detailed Transactions
  const allTxRows = [
    ['Date', 'Time', 'Customer Name', 'Customer Phone', 'Type', 'Description / Items', 'Bill #', `Debit (+Gave ${currency})`, `Credit (-Got ${currency})`, `Running Balance (${currency})`, 'Payment Method', 'Notes']
  ];

  customers.forEach(c => {
    const txs = transactionsMap[c.id] || [];
    let running = 0;
    // Sort ascending by timestamp for running balance
    const sorted = [...txs].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

    sorted.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.type === 'give') running += amt;
      else running -= amt;

      const dateObj = new Date(t.dateTime || t.date);
      const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString() : (t.date || '-');
      const timeStr = !isNaN(dateObj) ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (t.time || '-');

      allTxRows.push([
        dateStr,
        timeStr,
        c.name,
        c.phone || '',
        t.type === 'give' ? 'Maal Diya (Debit)' : 'Paisa Mila (Credit)',
        t.description || '-',
        t.billNumber || '-',
        t.type === 'give' ? amt : 0,
        t.type === 'get' ? amt : 0,
        running,
        t.paymentMethod || 'Cash',
        t.notes || ''
      ]);
    });
  });

  const wsAllTxs = XLSX.utils.aoa_to_sheet(allTxRows);
  XLSX.utils.book_append_sheet(wb, wsAllTxs, 'All Transactions');

  const todayStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `ALI_Garments_Complete_Ledger_${todayStr}.xlsx`);
}

/**
 * Downloads a specific customer's ledger sheet with running balances and timestamps
 */
export function downloadCustomerExcel(customer, transactions, settings) {
  const wb = XLSX.utils.book_new();
  const currency = settings.currency || 'Rs.';

  const sorted = [...(transactions || [])].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const rows = [
    [`${settings.shopName || 'ALI GARMENTS'} - CUSTOMER LEDGER STATEMENT`],
    [`Phone: ${settings.phone1 || ''} | Address: ${settings.address || ''}`],
    [],
    [`Customer Name: ${customer.name}`, `Phone: ${customer.phone || '-'}`],
    [`Address: ${customer.address || '-'}`, `Category: ${customer.category || 'Retail'}`],
    [`Statement Date: ${new Date().toLocaleString()}`],
    [],
    ['#', 'Date', 'Time', 'Details / Description', 'Bill No', `Debit (+Gave ${currency})`, `Credit (-Got ${currency})`, `Balance (${currency})`, 'Payment Method', 'Notes']
  ];

  let totalDebit = 0;
  let totalCredit = 0;
  let running = 0;

  sorted.forEach((t, idx) => {
    const amt = Number(t.amount || 0);
    if (t.type === 'give') {
      totalDebit += amt;
      running += amt;
    } else {
      totalCredit += amt;
      running -= amt;
    }

    const dateObj = new Date(t.dateTime || t.date);
    const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString() : (t.date || '-');
    const timeStr = !isNaN(dateObj) ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (t.time || '-');

    rows.push([
      idx + 1,
      dateStr,
      timeStr,
      t.description || 'Goods / Transaction',
      t.billNumber || '-',
      t.type === 'give' ? amt : 0,
      t.type === 'get' ? amt : 0,
      running,
      t.paymentMethod || 'Cash',
      t.notes || ''
    ]);
  });

  rows.push([]);
  rows.push([
    'TOTAL',
    '',
    '',
    '',
    '',
    totalDebit,
    totalCredit,
    running,
    running > 0 ? 'Customer Owes Us' : running < 0 ? 'We Owe Customer' : 'Account Settled',
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `${customer.name.slice(0, 25)} Ledger`);

  const cleanName = customer.name.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(wb, `ALI_Garments_Ledger_${cleanName}.xlsx`);
}
