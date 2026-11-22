import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Share2,
  Plus,
  Trash2,
  Building,
  CreditCard,
  QrCode,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { saveInvoice } from '../services/storage';

export default function InvoiceBuilder({
  isOpen,
  onClose,
  customer,
  customers,
  selectedTxIds = [],
  transactionsMap = {},
  settings,
  onInvoiceCreated,
  currency = 'Rs.'
}) {
  const [selectedCustomer, setSelectedCustomer] = useState(customer || null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (customer) {
      setSelectedCustomer(customer);
    } else if (customers && customers.length > 0 && !selectedCustomer) {
      setSelectedCustomer(customers[0]);
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`AG-INV-${randomNum}`);

    const now = new Date();
    setInvoiceDate(now.toISOString().slice(0, 10));

    const due = new Date();
    due.setDate(due.getDate() + 15);
    setDueDate(due.toISOString().slice(0, 10));

    // Initialize editable terms & conditions from settings
    setNotes(settings.terms || '1. Sold goods are not returnable without bill.\n2. Payment terms 15 days net.\n3. In case of dispute, Faisalabad jurisdiction applies.');

    // On invoice, only show customer balance (do NOT populate all historical in and out transactions)
    const target = customer || (customers && customers.length > 0 ? customers[0] : null);
    if (target) {
      const bal = Number(target.balance || 0);
      const isReceive = bal >= 0;
      setItems([
        {
          id: `item_bal_${Date.now()}`,
          date: now.toISOString().slice(0, 10),
          type: isReceive ? 'give' : 'get',
          description: `Khata Balance (موجودہ بقایا کھاتہ) - ${target.name}`,
          quantity: 1,
          rate: Math.abs(bal),
          amount: Math.abs(bal)
        }
      ]);
      return;
    }

    setItems([]);
  }, [isOpen, customer]);

  if (!isOpen) return null;

  const handleCustomerChange = (custId) => {
    const found = customers.find(c => c.id === custId);
    setSelectedCustomer(found);
    if (found) {
      const bal = Number(found.balance || 0);
      const isReceive = bal >= 0;
      setItems([
        {
          id: `item_bal_${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          type: isReceive ? 'give' : 'get',
          description: `Khata Balance (موجودہ بقایا کھاتہ) - ${found.name}`,
          quantity: 1,
          rate: Math.abs(bal),
          amount: Math.abs(bal)
        }
      ]);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'rate') {
      const qty = parseFloat(updated[index].quantity) || 0;
      const rate = parseFloat(updated[index].rate) || 0;
      updated[index].amount = qty * rate;
    }
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        date: invoiceDate || new Date().toISOString().slice(0, 10),
        type: 'give',
        description: 'Garments Goods / Service',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations for Total Gave, Total Got, and Grand Total
  const totalGave = items
    .filter(item => item.type === 'give')
    .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const totalGot = items
    .filter(item => item.type === 'get')
    .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const netLedgerBalance = totalGave - totalGot;

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const discountAmount = parseFloat(discount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * (parseFloat(taxPercent) || 0)) / 100;
  const grandTotal = taxableAmount + taxAmount;

  // Save invoice & sync to D1
  const handleSaveAndPrint = async () => {
    const invoiceData = {
      id: `inv_${Date.now()}`,
      invoiceNumber,
      date: invoiceDate,
      dueDate,
      customerId: selectedCustomer?.id || '',
      customerName: selectedCustomer?.name || 'Walk-in Customer',
      customerPhone: selectedCustomer?.phone || '',
      customerAddress: selectedCustomer?.address || '',
      items,
      subtotal,
      discount: discountAmount,
      taxPercent: parseFloat(taxPercent) || 0,
      taxAmount,
      total: grandTotal,
      notes: notes || settings.terms,
      createdAt: new Date().toISOString()
    };

    // Save to local cache / in-app storage only (Zero D1 credits used)
    await saveInvoice(invoiceData);
    if (onInvoiceCreated) onInvoiceCreated(invoiceData);

    setIsSaved(true);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleWhatsAppShare = () => {
    if (!selectedCustomer?.phone) {
      alert('Please add customer phone number to share on WhatsApp');
      return;
    }

    let phone = selectedCustomer.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.slice(1);

    const text = `*${settings.shopName || 'ALI GARMENTS'} - INVOICE*%0AInvoice No: ${invoiceNumber}%0ADate: ${invoiceDate}%0A*Total Amount: ${currency} ${grandTotal.toLocaleString()}*%0APlease check your bill statement. Shukriya!`;
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex justify-center items-start pt-[max(env(safe-area-inset-top),2.5rem)] px-2 sm:px-4 pb-24 md:pb-8">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-1 sm:my-6 overflow-hidden flex flex-col relative">
        {/* Sticky Editor Modal Header */}
        <div className="no-print sticky top-0 z-20 p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Smart Invoice Creator
                </h3>
                <span className="hidden sm:inline-block text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700/50 shrink-0">
                  Local / In-App (0 D1 Credits)
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Created within website/app — print, PDF, WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shrink-0"
            title="Close Invoice"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Body / Print Container */}
        <div id="printable-invoice" className="p-3.5 sm:p-8 space-y-4 sm:space-y-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          {/* Top Brand Banner */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b pb-6 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Shop Logo"
                  className="w-16 h-16 rounded-2xl object-contain border border-slate-200 dark:border-slate-700 p-1 bg-white"
                />
              ) : (
                <img
                  src="/logo.png"
                  alt="Rana ALI Garments Logo"
                  className="w-16 h-16 rounded-2xl object-contain border border-slate-200 dark:border-slate-700 p-0.5 bg-white shadow-sm"
                />
              )}
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {settings.shopName || 'ALI GARMENTS'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  {settings.shopTagline || 'Wholesale & Retail Garments'}
                </p>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                  <p>{settings.address}</p>
                  <p>Phone: {settings.phone1} {settings.phone2 && `| ${settings.phone2}`}</p>
                  {settings.ntn && <p className="font-mono">NTN / TRN: {settings.ntn}</p>}
                </div>
              </div>
            </div>

            {/* Invoice Meta */}
            <div className="text-left sm:text-right space-y-1">
              <span className="inline-block px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                Tax Invoice & Receipt
              </span>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-white pt-1">
                {invoiceNumber}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-mono space-y-0.5">
                <div><span className="font-semibold text-slate-800 dark:text-slate-200">Transaction Date:</span> {invoiceDate}</div>
                <div><span className="font-semibold text-slate-800 dark:text-slate-200">Due Date:</span> {dueDate}</div>
              </div>
            </div>
          </div>

          {/* Billed To / Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Billed To (Customer / Party)
              </span>
              <div className="no-print mb-2">
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={e => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                >
                  <option value="">Select a Customer...</option>
                  {customers?.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedCustomer?.name || 'Walk-In Customer'}
              </h2>
              {selectedCustomer?.phone && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Phone: {selectedCustomer.phone}
                </p>
              )}
              {selectedCustomer?.address && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Address: {selectedCustomer.address}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Ledger Status
              </span>
              <div className="text-sm font-bold font-mono">
                Balance: {currency} {Math.abs(Number(selectedCustomer?.balance || 0)).toLocaleString()}{' '}
                <span className="text-xs font-normal">
                  {(selectedCustomer?.balance || 0) > 0 ? "(You'll Receive)" : '(Payable)'}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">#</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Tx Date</th>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Description / Garments Particulars</th>
                  <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Rate ({currency})</th>
                  <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Amount ({currency})</th>
                  <th className="no-print py-2.5 px-2 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-xs text-slate-400 font-medium">
                      No transactions selected. Click "+ Add Line Item" below to add custom entries.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <input
                          type="date"
                          value={item.date || invoiceDate}
                          onChange={e => handleItemChange(idx, 'date', e.target.value)}
                          className="bg-transparent border-0 border-b border-transparent focus:border-emerald-500 focus:outline-none p-1 font-mono text-xs w-28 text-slate-800 dark:text-slate-200"
                        />
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <select
                          value={item.type || 'give'}
                          onChange={e => handleItemChange(idx, 'type', e.target.value)}
                          className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 border cursor-pointer ${
                            item.type === 'get'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          <option value="give">Diya (Gave)</option>
                          <option value="get">Mila (Got)</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.description}
                          placeholder="Garment item / fabric description..."
                          onChange={e => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-emerald-500 focus:outline-none p-1 font-medium"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-16 text-right bg-transparent border-0 border-b border-transparent focus:border-emerald-500 focus:outline-none p-1 font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate}
                          onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                          className="w-24 text-right bg-transparent border-0 border-b border-transparent focus:border-emerald-500 focus:outline-none p-1 font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                        {currency} {(parseFloat(item.amount) || 0).toLocaleString()}
                      </td>
                      <td className="no-print py-2.5 px-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-300 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add Line Item Button (No-print) */}
          <div className="no-print">
            <button
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">Add Line Item</span>
            </button>
          </div>

          {/* Totals & Calculations */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            {/* Left: Payment Info & QR Codes */}
            <div className="space-y-3 flex-1 max-w-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Official Payment Methods
                </span>
                <div className="text-xs space-y-1">
                  {settings.bankName && (
                    <div>
                      <span className="font-semibold">{settings.bankName}</span>
                      <div className="font-mono text-slate-600 dark:text-slate-400">
                        Title: {settings.accountTitle} | Acc: {settings.accountNumber}
                      </div>
                      {settings.iban && (
                        <div className="font-mono text-[11px] text-slate-500">
                          IBAN: {settings.iban}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-1 font-mono text-[11px]">
                    {settings.jazzCash && <span>JazzCash: {settings.jazzCash}</span>}
                    {settings.easyPaisa && <span>EasyPaisa: {settings.easyPaisa}</span>}
                  </div>
                </div>

                {/* QR Code */}
                {settings.qrCodeUrl ? (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <img
                      src={settings.qrCodeUrl}
                      alt="Payment QR"
                      className="w-16 h-16 border rounded-lg bg-white p-1"
                    />
                    <span className="text-[11px] text-slate-500">
                      Scan QR Code to pay directly via Mobile Banking
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right: Clean Customer Balance Summary (No In/Out clutter) */}
            <div className="w-full sm:w-80 space-y-2.5 font-mono text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">Khata Balance:</span>
                <span className={`font-bold font-mono ${
                  (selectedCustomer?.balance || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {currency}&nbsp;{Math.abs(selectedCustomer?.balance || 0).toLocaleString()}
                  <span className="text-[10px] ml-1 font-sans">
                    {(selectedCustomer?.balance || 0) >= 0 ? '(لینے ہیں)' : '(دینے ہیں)'}
                  </span>
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 whitespace-nowrap">Invoice Subtotal:</span>
                <span className="font-bold">{currency}&nbsp;{subtotal.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 whitespace-nowrap">Discount ({currency}):</span>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  className="no-print w-20 text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5"
                />
                <span className="print:inline hidden font-bold">-{currency}&nbsp;{discountAmount.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 whitespace-nowrap">Tax (%):</span>
                <input
                  type="number"
                  min="0"
                  value={taxPercent}
                  onChange={e => setTaxPercent(e.target.value)}
                  className="no-print w-16 text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5"
                />
                <span className="print:inline hidden font-bold">+{currency}&nbsp;{taxAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between py-2.5 border-t-2 border-slate-900 dark:border-white text-sm font-bold">
                <span className="whitespace-nowrap">Total Invoice Amount:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  {currency}&nbsp;{grandTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions (Editable on Receipt) & Stamp Footer */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs text-slate-500">
            <div className="w-full sm:max-w-md">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
                Terms & Conditions / شرائط (Editable on Receipt)
              </span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Enter custom terms & conditions for this receipt..."
                className="no-print w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
              />
              <div className="print:block hidden whitespace-pre-line text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {notes}
              </div>
            </div>

            <div className="text-center w-40 pt-8 border-t border-dashed border-slate-400 shrink-0 self-end">
              <span className="block font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                ALI Garments
              </span>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">Authorized Signature</span>
            </div>
          </div>
        </div>

        {/* Modal Action Controls Footer (No Print) */}
        <div className="no-print p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-500 hover:bg-green-600 text-white transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>Share WhatsApp</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              Close
            </button>

            <button
              onClick={handleSaveAndPrint}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Save & Print Invoice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
