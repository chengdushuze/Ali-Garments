import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Phone,
  MapPin,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Search,
  Calendar,
  Clock,
  Trash2,
  CheckCircle2,
  Share2,
  Plus
} from 'lucide-react';
import { downloadCustomerExcel } from '../services/excelService';

export default function CustomerDetail({
  customer,
  transactions,
  onBack,
  onOpenAddTransaction,
  onOpenInvoiceForCustomer,
  onDeleteTransaction,
  onRequestDeleteTransaction,
  onRequestDeleteCustomer,
  settings,
  currency = 'Rs.'
}) {
  const [txSearch, setTxSearch] = useState('');
  const [selectedTxIds, setSelectedTxIds] = useState([]);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'month', 'week'

  if (!customer) return null;

  const bal = Number(customer.balance || 0);

  // Filter transactions
  const filteredTxs = (transactions || []).filter(tx => {
    const matchSearch =
      (tx.description && tx.description.toLowerCase().includes(txSearch.toLowerCase())) ||
      (tx.billNumber && tx.billNumber.toLowerCase().includes(txSearch.toLowerCase())) ||
      (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(txSearch.toLowerCase()));

    if (!matchSearch) return false;

    if (dateFilter === 'week') {
      const txDate = new Date(tx.dateTime || tx.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return txDate >= weekAgo;
    }

    if (dateFilter === 'month') {
      const txDate = new Date(tx.dateTime || tx.date);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return txDate >= monthAgo;
    }

    return true;
  });

  // Calculate totals
  let totalGiven = 0; // Debit
  let totalGot = 0;   // Credit
  (transactions || []).forEach(t => {
    const amt = Number(t.amount || 0);
    if (t.type === 'give') totalGiven += amt;
    else totalGot += amt;
  });

  // WhatsApp reminder message
  const handleSendWhatsAppReminder = () => {
    if (!customer.phone) {
      alert('Please add a phone number for this customer first.');
      return;
    }

    let cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '92' + cleanPhone.slice(1);
    }

    const shopName = settings.shopName || 'ALI Garments';
    let text = '';
    if (bal > 0) {
      text = `السلام علیکم ${customer.name} صاحب!%0A${shopName} کی طرف سے آپ کے کھاتے کا بقایا بیلنس ${currency} ${bal.toLocaleString()} ہے۔%0Aبراہ کرم جلد ادائیگی کو یقینی بنائیں۔ جزاک اللہ!%0Aرابطہ: ${settings.phone1 || ''}`;
    } else if (bal < 0) {
      text = `السلام علیکم ${customer.name} صاحب!%0A${shopName} کی طرف سے آپ کے کھاتے میں ہمارے ذمہ بقایا ${currency} ${Math.abs(bal).toLocaleString()} ہے۔%0Aشکریہ!%0Aرابطہ: ${settings.phone1 || ''}`;
    } else {
      text = `السلام علیکم ${customer.name} صاحب!%0A${shopName} کی طرف سے آپ کا کھاتہ بالکل برابر (Nil Balance) ہے۔ شکریہ!`;
    }

    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
  };

  const handleToggleSelectTx = (id) => {
    setSelectedTxIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllTxs = () => {
    if (selectedTxIds.length === filteredTxs.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(filteredTxs.map(t => t.id));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Top Profile Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors lg:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-emerald-500/20">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {customer.name}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md font-medium uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {customer.category || 'Retail'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {customer.phone}
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {customer.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Balance Badge */}
          <div className="text-right flex-shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {bal > 0 ? "You'll Receive" : bal < 0 ? "You'll Give" : 'Balance'}
            </span>
            <div
              className={`text-xl sm:text-2xl font-black font-mono tabular-nums whitespace-nowrap ${
                bal > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : bal < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
              style={{ whiteSpace: 'nowrap' }}
            >
              {currency}&nbsp;{Math.abs(bal).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
          {/* Download Specific XLS */}
          <button
            onClick={() => downloadCustomerExcel(customer, transactions, settings)}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="whitespace-nowrap">Download XLS</span>
          </button>

          {/* WhatsApp Reminder */}
          <button
            onClick={handleSendWhatsAppReminder}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-green-50 hover:bg-green-100 dark:bg-green-950/40 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/60 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <span className="whitespace-nowrap">WhatsApp</span>
          </button>

          {/* Create Invoice */}
          <button
            onClick={() => onOpenInvoiceForCustomer(customer, selectedTxIds)}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="whitespace-nowrap">{selectedTxIds.length > 0 ? `Invoice (${selectedTxIds.length})` : 'Invoice'}</span>
          </button>

          {/* Quick Share Statement */}
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="whitespace-nowrap">Print Ledger</span>
          </button>

          {/* Delete Customer (Move to Recycle Bin) */}
          {onRequestDeleteCustomer && (
            <button
              onClick={() => onRequestDeleteCustomer(customer)}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              title="Delete Party (Move to Recycle Bin for 30 Days)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="whitespace-nowrap">Delete Party</span>
            </button>
          )}
        </div>

        {/* Ledger Totals Mini Bar */}
        <div className="flex items-center justify-between text-xs font-mono pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          <span>Total Given: <strong className="text-rose-600 dark:text-rose-400 font-bold">{currency} {totalGiven.toLocaleString()}</strong></span>
          <span>Total Received: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{currency} {totalGot.toLocaleString()}</strong></span>
          <span>Entries: <strong>{transactions.length}</strong></span>
        </div>
      </div>

      {/* Transaction Controls & Filters */}
      <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items, bill #, payment mode..."
            value={txSearch}
            onChange={e => setTxSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-2.5 py-1 rounded-md ${dateFilter === 'all' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-medium' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            All
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-2.5 py-1 rounded-md ${dateFilter === 'month' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-medium' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            This Month
          </button>

          {filteredTxs.length > 0 && (
            <button
              onClick={handleSelectAllTxs}
              className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline px-1"
            >
              {selectedTxIds.length === filteredTxs.length ? 'Deselect All' : 'Select for Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Transaction Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px]">
        {filteredTxs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No transactions recorded yet
            </p>
            <p className="text-xs text-slate-400">
              Record goods given on credit or cash payment received below.
            </p>
          </div>
        ) : (
          filteredTxs.map(tx => {
            const isDebit = tx.type === 'give'; // Maal Diya
            const isSelected = selectedTxIds.includes(tx.id);
            const dateObj = new Date(tx.dateTime || tx.date);
            const formattedDate = !isNaN(dateObj)
              ? dateObj.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
              : (tx.date || 'Today');
            const formattedTime = !isNaN(dateObj)
              ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : (tx.time || '');

            return (
              <div
                key={tx.id}
                className={`p-3.5 sm:p-4 transition-colors flex items-center justify-between gap-3 ${
                  isSelected ? 'bg-indigo-50/70 dark:bg-indigo-950/30' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                }`}
              >
                {/* Left: Checkbox + Date & Description */}
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelectTx(tx.id)}
                    className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          isDebit
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        }`}
                      >
                        {isDebit ? 'Maal Diya (Debit)' : 'Paisa Mila (Credit)'}
                      </span>
                      {tx.billNumber && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Bill: #{tx.billNumber}
                        </span>
                      )}
                      {tx.paymentMethod && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {tx.paymentMethod}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1 truncate">
                      {tx.description || (isDebit ? 'Garments / Goods Supplied' : 'Payment Received')}
                    </p>

                    {/* Date and Time */}
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formattedDate}
                      </span>
                      {formattedTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formattedTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Actions */}
                <div className="flex items-center gap-3 text-right flex-shrink-0">
                  <div>
                    <div
                      className={`text-base font-bold font-mono tabular-nums whitespace-nowrap ${
                        isDebit
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {isDebit ? '+' : '-'} {currency}&nbsp;{Number(tx.amount || 0).toLocaleString()}
                    </div>
                    {tx.balanceAfter !== undefined && (
                      <span className="text-[10px] text-slate-400 block font-mono whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        Bal: {currency}&nbsp;{Number(tx.balanceAfter).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (onRequestDeleteTransaction) {
                        onRequestDeleteTransaction(customer, tx);
                      } else if (onDeleteTransaction) {
                        onDeleteTransaction(customer.id, tx.id);
                      }
                    }}
                    title="Delete Entry (Move to Recycle Bin for 30 Days)"
                    className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom Actions: You Gave (Debit) vs You Got (Credit) */}
      <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 gap-2 sm:gap-3">
        {/* You Gave (Debit / Maal Diya) */}
        <button
          onClick={() => onOpenAddTransaction(customer, 'give')}
          className="flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
        >
          <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="whitespace-nowrap">You Gave (ادھار دیا)</span>
        </button>

        {/* You Got (Credit / Paisa Mila) */}
        <button
          onClick={() => onOpenAddTransaction(customer, 'get')}
          className="flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
        >
          <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="whitespace-nowrap">You Got (وصولی ملی)</span>
        </button>
      </div>
    </div>
  );
}
