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
  const [localToast, setLocalToast] = useState('');

  const handleExportCustomerExcel = async () => {
    try {
      const res = await downloadCustomerExcel(customer, transactions, settings);
      if (res && res.success) {
        setLocalToast('Excel Sheet Saved Successfully to Downloads Folder • فائل کامیابی سے محفوظ ہو گئی');
        setTimeout(() => setLocalToast(''), 3500);
      }
    } catch (e) {
      console.error('Excel export error:', e);
    }
  };

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

  // Sort filtered transactions: latest transaction at the top, oldest on last
  const sortedFilteredTxs = [...filteredTxs].sort((a, b) => {
    const timeA = new Date(a.dateTime || a.date || a.createdAt || 0).getTime() || 0;
    const timeB = new Date(b.dateTime || b.date || b.createdAt || 0).getTime() || 0;
    if (timeB !== timeA) return timeB - timeA;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });

  // Calculate totals
  let totalGiven = 0; // Debit
  let totalGot = 0;   // Credit
  (transactions || []).forEach(t => {
    const amt = Number(t.amount || 0);
    if (t.type === 'give') totalGiven += amt;
    else totalGot += amt;
  });

  // WhatsApp reminder message in English
  const handleSendWhatsAppReminder = () => {
    if (!customer.phone) {
      alert('Please add a phone number for this customer first');
      return;
    }

    let cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '92' + cleanPhone.slice(1);
    }

    const shopName = settings.shopName || 'ALI Garments';
    const contactLine = settings.phone1 ? `\nContact: ${settings.phone1}` : '';
    let msg = '';
    if (bal > 0) {
      msg = `Dear ${customer.name},\nThis is a balance reminder from ${shopName}.\nYour outstanding balance is ${currency} ${bal.toLocaleString()}.\nPlease arrange the payment at your earliest convenience.\nThank you!${contactLine}`;
    } else if (bal < 0) {
      msg = `Dear ${customer.name},\nThis is an account statement from ${shopName}.\nWe have an advance credit balance of ${currency} ${Math.abs(bal).toLocaleString()} in your account.\nThank you!${contactLine}`;
    } else {
      msg = `Dear ${customer.name},\nThis is an account statement from ${shopName}.\nYour account is fully cleared with a Nil / settled balance (0).\nThank you!${contactLine}`;
    }

    const text = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
  };

  const handleToggleSelectTx = (id) => {
    setSelectedTxIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllTxs = () => {
    if (selectedTxIds.length === sortedFilteredTxs.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(sortedFilteredTxs.map(t => t.id));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col h-full transition-all relative">
      {/* Toast Notification Banner */}
      {localToast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white border border-emerald-500/50 shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="whitespace-nowrap">{localToast}</span>
        </div>
      )}
      {/* Top Status Bar Spacer & Crisp Divider Line (Mobile Android Only) */}
      <div className="w-full bg-slate-100 dark:bg-slate-950 border-b border-slate-300 dark:border-slate-800 h-10 md:hidden flex items-center justify-between px-3.5 shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>ALI Garments Khata</span>
        </div>
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
      </div>

      {/* ============================================================== */}
      {/* DESKTOP / PC PROFILE HEADER (>= md) - Maximum Ledger Visibility */}
      {/* ============================================================== */}
      <div className="hidden md:block px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-950/60 space-y-2.5 shrink-0">
        {/* Row 1: Full Customer Identity on Left & Net Balance on Right (NO TRUNCATE) */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Avatar + Full Party Name + Category Badge + Phone + Address */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-sm sm:text-base flex items-center justify-center shadow-sm shrink-0">
              {customer.name ? customer.name.slice(0, 2).toUpperCase() : 'AG'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {customer.name}
                </h2>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shrink-0">
                  {customer.category || 'Wholesale'}
                </span>
                {onOpenEditCustomer && (
                  <button
                    type="button"
                    onClick={() => onOpenEditCustomer(customer)}
                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                    title="Edit Party Details"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="inline-flex items-center gap-1.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{customer.phone}</span>
                  </a>
                )}
                {customer.phone && customer.address && <span className="text-slate-300 dark:text-slate-700">•</span>}
                {customer.address && (
                  <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{customer.address}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Prominent Net Balance Badge */}
          <div className="text-right shrink-0 pl-3">
            <span className={`text-[10px] font-black uppercase tracking-wider block leading-none ${
              bal > 0 ? 'text-emerald-600 dark:text-emerald-400' : bal < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
            }`}>
              {bal > 0 ? "You'll Receive" : bal < 0 ? "You'll Give" : 'Settled'}
            </span>
            <div
              className={`text-lg sm:text-xl font-black font-mono tabular-nums whitespace-nowrap leading-tight mt-1 ${
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

        {/* Row 2: "You Gave" & "You Got" on Left + Action Toolbar & Ledger Summary on Right */}
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 flex-wrap">
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenAddTransaction(customer, 'give')}
              className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl font-black text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ You Gave (ادھار دیا)</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAddTransaction(customer, 'get')}
              className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ You Got (وصولی ملی)</span>
            </button>
          </div>

          {/* Action Toolbar + Summary Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSendWhatsAppReminder}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 hover:bg-green-100 border border-green-200 dark:border-green-800 transition-colors shadow-xs cursor-pointer"
                title="Send WhatsApp Reminder"
              >
                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleExportCustomerExcel}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                title="Export Ledger to Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="whitespace-nowrap">Excel</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenInvoiceForCustomer(customer, selectedTxIds)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-colors shadow-xs cursor-pointer"
                title="Create Bill / Invoice"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>{selectedTxIds.length > 0 ? `Invoice (${selectedTxIds.length})` : 'Invoice'}</span>
              </button>

              {onRequestDeleteCustomer && (
                <button
                  type="button"
                  onClick={() => onRequestDeleteCustomer(customer)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 transition-colors shadow-xs cursor-pointer"
                  title="Delete Party"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            {/* Inline Ledger Summary Strip */}
            <div className="flex items-center gap-1.5 text-xs">
              <div className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50">
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase mr-1">Given:</span>
                <span className="font-mono font-extrabold text-rose-700 dark:text-rose-300">{currency} {totalGiven.toLocaleString()}</span>
              </div>

              <div className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mr-1">Received:</span>
                <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300">{currency} {totalGot.toLocaleString()}</span>
              </div>

              <div className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Entries:</span>
                <span className="font-mono font-extrabold text-slate-800 dark:text-slate-200">{transactions.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MOBILE / PHONE PROFILE HEADER (< md)                           */}
      {/* ============================================================== */}
      <div className="block md:hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/50 space-y-2.5">
          {/* Row 1: Back Arrow + Avatar + Party Name with Category + Balance */}
          <div className="flex items-center justify-between gap-2.5">
            {/* Left: Back Arrow + Avatar + Party Name + Category Tag */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to Party List"
                className="p-2 rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer shadow-xs active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-sm flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                {customer.name ? customer.name.slice(0, 2).toUpperCase() : 'AG'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight truncate">
                    {customer.name}
                  </h2>
                  {onOpenEditCustomer && (
                    <button
                      type="button"
                      onClick={() => onOpenEditCustomer(customer)}
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                      title="Edit Party Details • کھاتہ تفصیل تبدیل کریں"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shrink-0">
                    {customer.category || 'Wholesale'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Net Balance Badge */}
            <div className="text-right shrink-0 pl-2">
              <span className={`text-[10px] font-black uppercase tracking-wider block leading-none ${
                bal > 0 ? 'text-emerald-600 dark:text-emerald-400' : bal < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
              }`}>
                {bal > 0 ? "You'll Receive" : bal < 0 ? "You'll Give" : 'Settled'}
              </span>
              <div
                className={`text-base sm:text-xl font-black font-mono tabular-nums whitespace-nowrap leading-tight mt-1 ${
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

          {/* Row 2: Phone Pill + Address Pill in a clean metadata strip */}
          <div className="flex items-center gap-2 flex-wrap text-xs pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60 hover:bg-emerald-100 font-mono text-[11px] font-bold shrink-0 transition-colors"
              >
                <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{customer.phone}</span>
              </a>
            )}

            {customer.address && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80 text-[11px] min-w-0 max-w-full">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{customer.address}</span>
              </div>
            )}
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
              onClick={handleExportCustomerExcel}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 transition-all active:scale-95 whitespace-nowrap cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="whitespace-nowrap">Excel Sheet</span>
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
              <span className="text-[10px] uppercase font-bold text-rose-600/80 dark:text-rose-400/80 block leading-none whitespace-nowrap">
                Given (دیئے)
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-rose-600 dark:text-rose-400 block mt-1 leading-tight whitespace-nowrap">
                {currency} {totalGiven.toLocaleString()}
              </span>
            </div>

            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
              <span className="text-[10px] uppercase font-bold text-emerald-600/80 dark:text-emerald-400/80 block leading-none whitespace-nowrap">
                Received (ملے)
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 block mt-1 leading-tight whitespace-nowrap">
                {currency} {totalGot.toLocaleString()}
              </span>
            </div>

            <div className="p-1.5 sm:p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block leading-none whitespace-nowrap">
                Entries (اندراج)
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-800 dark:text-slate-200 block mt-1 leading-tight whitespace-nowrap">
                {transactions.length}
              </span>
            </div>
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

          {sortedFilteredTxs.length > 0 && (
            <button
              onClick={handleSelectAllTxs}
              className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline px-1"
            >
              {selectedTxIds.length === sortedFilteredTxs.length ? 'Deselect All' : 'Select for Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Transaction Feed (With pb-28 so it never hides behind the mobile bottom nav) */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100 dark:divide-slate-800/80 p-2 sm:p-3 space-y-2 pb-28 md:pb-8">
        {sortedFilteredTxs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              No transactions recorded yet
            </p>
            <p className="text-xs text-slate-400">
              Record goods given on credit or cash payment received above.
            </p>
          </div>
        ) : (
          sortedFilteredTxs.map(tx => {
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
              <div key={tx.id}>
                {/* 1. DESKTOP LEDGER ROW (>= md) - Full Details Visible, Zero Text Truncation */}
                <div
                  className={`hidden md:block py-2.5 px-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
                  }`}
                >
                  {/* Top Line: Date & Time, Tag Badge, Bill #, Mode, Running Balance, Amount & Delete */}
                  <div className="flex items-center justify-between gap-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-700/40">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectTx(tx.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                      />

                      <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="whitespace-nowrap">{formattedDate}</span>
                        {formattedTime && (
                          <span className="text-[11px] font-normal text-slate-400 whitespace-nowrap">
                            • {formattedTime}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
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
                          Bill #{cleanBill}
                        </span>
                      )}

                      {tx.paymentMethod && (
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                          {tx.paymentMethod}
                        </span>
                      )}
                    </div>

                    {/* Right: Amount & Running Balance + Delete button */}
                    <div className="flex items-center gap-3 shrink-0">
                      {tx.balanceAfter !== undefined && (
                        <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                          Bal: {currency}&nbsp;{Number(tx.balanceAfter).toLocaleString()}
                        </span>
                      )}

                      <div
                        className={`text-sm sm:text-base font-black font-mono tabular-nums whitespace-nowrap ${
                          isDebit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isDebit ? '+' : '-'} {currency}&nbsp;{Number(tx.amount || 0).toLocaleString()}
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
                        title="Delete Entry"
                        className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Line: Full Description with NO TRUNCATE (Full text like "Garments Supplied", "Payment Received", etc.) */}
                  <div className="pt-1.5 flex items-start justify-between gap-2">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words leading-snug">
                      {tx.description || (isDebit ? 'Garments Supplied' : 'Payment Received')}
                    </div>
                    {tx.notes && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 italic shrink-0">
                        Note: {tx.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. MOBILE MULTI-LINE CARD (< md) - Phone Touch Optimized */}
                <div
                  className={`block md:hidden p-3 rounded-2xl border transition-all ${
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
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
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
                        <p className="text-xs font-bold text-slate-900 dark:text-white break-words leading-snug">
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
                          className={`text-sm font-black font-mono tabular-nums leading-none ${
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
                        title="Delete Entry"
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
