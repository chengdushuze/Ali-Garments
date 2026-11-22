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
  Plus,
  Edit3
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
  onOpenEditCustomer,
  settings,
  currency = 'Rs.'
}) {
  const [txSearch, setTxSearch] = useState('');
  const [selectedTxIds, setSelectedTxIds] = useState([]);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'month', 'week'

  if (!customer) return null;

  const bal = Number(customer.balance || 0);

  const searchLower = String(txSearch || '').toLowerCase();
  const safeTxs = Array.isArray(transactions) ? transactions : [];

  // Filter transactions safely
  const filteredTxs = safeTxs.filter(tx => {
    if (!tx) return false;
    const descStr = String(tx.description || '').toLowerCase();
    const billStr = String(tx.billNumber || '').toLowerCase();
    const methodStr = String(tx.paymentMethod || '').toLowerCase();

    const matchSearch =
      !searchLower ||
      descStr.includes(searchLower) ||
      billStr.includes(searchLower) ||
      methodStr.includes(searchLower);

    if (!matchSearch) return false;

    if (dateFilter === 'week') {
      const txDate = new Date(tx.dateTime || tx.date);
      if (isNaN(txDate.getTime())) return true;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return txDate >= weekAgo;
    }

    if (dateFilter === 'month') {
      const txDate = new Date(tx.dateTime || tx.date);
      if (isNaN(txDate.getTime())) return true;
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
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col h-full transition-all">
      {/* Top Profile Header (With pt-7 for Mobile Status Bar & Notch Clearance) */}
      <div className="pt-7 sm:pt-5 pb-3.5 px-3.5 sm:px-5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/50">
        <div className="flex items-start justify-between gap-2.5">
          {/* Left: Back Arrow + Avatar + Party Details (Name, Wholesale Tag, Phone, Address beautifully aligned) */}
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Party List"
              className="p-2 -ml-1 rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer shadow-xs mt-0.5"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-sm sm:text-base flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 mt-0.5">
              {customer.name ? customer.name.slice(0, 2).toUpperCase() : 'AG'}
            </div>

            <div className="min-w-0 flex-1">
              {/* Row 1: Full Party Name + Edit Button */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight break-words">
                  {customer.name}
                </h2>
                {onOpenEditCustomer && (
                  <button
                    type="button"
                    onClick={() => onOpenEditCustomer(customer)}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                    title="Edit Party Details • کھاتہ تفصیل تبدیل کریں"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Row 2: Tag (Wholesale/Retail) + Phone Number */}
              <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shrink-0">
                  {customer.category || 'Wholesale'}
                </span>

                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-mono text-[11px] font-semibold"
                  >
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{customer.phone}</span>
                  </a>
                )}
              </div>

              {/* Row 3: Address */}
              {customer.address && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{customer.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Balance Badge */}
          <div className="text-right shrink-0 pl-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {bal > 0 ? "You'll Receive" : bal < 0 ? "You'll Give" : 'Balance'}
            </span>
            <div
              className={`text-base sm:text-xl font-black font-mono tabular-nums whitespace-nowrap leading-tight ${
                bal > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : bal < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {currency}&nbsp;{Math.abs(bal).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Action Buttons: 3 Full Lines as requested (No 2.5 lines) */}
        <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
          {/* Line 1: Edit Details & WhatsApp */}
          {onOpenEditCustomer ? (
            <button
              type="button"
              onClick={() => onOpenEditCustomer(customer)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 transition-all active:scale-95 whitespace-nowrap cursor-pointer shadow-xs"
              title="Edit Customer Details (نام اور تفصیل تبدیل کریں)"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Edit Details</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={handleSendWhatsAppReminder}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/25 transition-all active:scale-95 whitespace-nowrap cursor-pointer shadow-xs"
          >
            <MessageCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <span>WhatsApp</span>
          </button>

          {/* Line 2: Excel Sheet & Invoice */}
          <button
            type="button"
            onClick={() => downloadCustomerExcel(customer, transactions, settings)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 transition-all active:scale-95 whitespace-nowrap cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Excel Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenInvoiceForCustomer(customer, selectedTxIds)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 transition-all active:scale-95 whitespace-nowrap cursor-pointer shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>{selectedTxIds.length > 0 ? `Invoice (${selectedTxIds.length})` : 'Invoice'}</span>
          </button>

          {/* Line 3: Delete Party (Full-Width Button for clean 3-line layout) */}
          {onRequestDeleteCustomer && (
            <button
              type="button"
              onClick={() => onRequestDeleteCustomer(customer)}
              className="col-span-2 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition-all active:scale-95 whitespace-nowrap cursor-pointer shadow-xs"
              title="Delete Party (Move to Recycle Bin for 30 Days)"
            >
              <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Delete Party • کھاتہ حذف کریں (30 Days Bin)</span>
            </button>
          )}
        </div>

        {/* Action Buttons: You Gave (Rose) & You Got (Emerald) placed JUST BELOW DELETE PARTY BUTTON! */}
        <div className="grid grid-cols-2 gap-2.5 mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => onOpenAddTransaction(customer, 'give')}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] text-white shadow-lg shadow-rose-600/30 transition-all whitespace-nowrap cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 stroke-[2.5]" />
            <span className="whitespace-nowrap">You Gave (ادھار دیا)</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenAddTransaction(customer, 'get')}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white shadow-lg shadow-emerald-600/30 transition-all whitespace-nowrap cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 stroke-[2.5]" />
            <span className="whitespace-nowrap">You Got (وصولی ملی)</span>
          </button>
        </div>

        {/* Ledger Summary Bar: Given, Received, Entries on EXACT SAME LINE! */}
        <div className="grid grid-cols-3 gap-1.5 pt-2.5 mt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 text-center">
          <div className="p-1.5 sm:p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
            <span className="text-[10px] uppercase font-bold text-rose-600/80 dark:text-rose-400/80 block leading-none">
              Given (دیئے)
            </span>
            <span className="text-xs sm:text-sm font-extrabold font-mono text-rose-600 dark:text-rose-400 block mt-1 leading-tight whitespace-nowrap truncate">
              {currency} {totalGiven.toLocaleString()}
            </span>
          </div>

          <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
            <span className="text-[10px] uppercase font-bold text-emerald-600/80 dark:text-emerald-400/80 block leading-none">
              Received (ملے)
            </span>
            <span className="text-xs sm:text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 block mt-1 leading-tight whitespace-nowrap truncate">
              {currency} {totalGot.toLocaleString()}
            </span>
          </div>

          <div className="p-1.5 sm:p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block leading-none">
              Entries (اندراج)
            </span>
            <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-800 dark:text-slate-200 block mt-1 leading-tight whitespace-nowrap">
              {transactions.length}
            </span>
          </div>
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

      {/* Transaction Feed (With pb-28 so it never hides behind the mobile bottom nav) */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100 dark:divide-slate-800/80 p-2 sm:p-3 space-y-2 pb-28 md:pb-8">
        {filteredTxs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              No transactions recorded yet
            </p>
            <p className="text-xs text-slate-400">
              Record goods given on credit or cash payment received above.
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
            const cleanBill = tx.billNumber ? String(tx.billNumber).replace(/["'\s]/g, '') : '';

            return (
              <div
                key={tx.id}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
                }`}
              >
                {/* LINE 1: Date & Time on Left, Tag Badge on Right (EXACT SAME LINE, NEVER WRAPS) */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-2 overflow-hidden">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="whitespace-nowrap">{formattedDate}</span>
                    {formattedTime && (
                      <span className="text-[11px] font-normal text-slate-400 whitespace-nowrap">
                        • {formattedTime}
                      </span>
                    )}
                  </div>

                  {/* Tag on the EXACT SAME LINE: Paisa Mila (Credit) or Maal Diya (Debit) */}
                  <div className="flex items-center gap-1.5 shrink-0 overflow-hidden">
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                        isDebit
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDebit ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                      <span>{isDebit ? 'Maal Diya (Debit)' : 'Paisa Mila (Credit)'}</span>
                    </span>
                    {cleanBill && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 whitespace-nowrap shrink-0">
                        #{cleanBill}
                      </span>
                    )}
                  </div>
                </div>

                {/* LINE 2: Description & Payment Mode on Left, Amount & Running Balance on Right */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectTx(tx.id)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {tx.description || (isDebit ? 'Garments / Goods Supplied' : 'Payment Received')}
                      </p>
                      {tx.paymentMethod && (
                        <span className="text-[10px] text-slate-400 font-medium block">
                          Mode: {tx.paymentMethod}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount & Running Balance + Delete Icon */}
                  <div className="text-right shrink-0 flex items-center gap-2.5">
                    <div>
                      <div
                        className={`text-sm sm:text-base font-black font-mono tabular-nums leading-none ${
                          isDebit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isDebit ? '+' : '-'} {currency}&nbsp;{Number(tx.amount || 0).toLocaleString()}
                      </div>
                      {tx.balanceAfter !== undefined && (
                        <span className="text-[10px] text-slate-400 font-mono mt-1 block leading-none">
                          Bal: {currency}&nbsp;{Number(tx.balanceAfter).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onRequestDeleteTransaction) {
                          onRequestDeleteTransaction(customer, tx);
                        } else if (onDeleteTransaction) {
                          onDeleteTransaction(customer.id, tx.id);
                        }
                      }}
                      title="Delete Entry (Move to Recycle Bin for 30 Days)"
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
