import React from 'react';
import { TrendingUp, TrendingDown, Users, Wallet, ArrowUpRight, ArrowDownLeft, FileSpreadsheet, PlusCircle } from 'lucide-react';

export default function DashboardStats({
  customers,
  transactionsMap,
  currency = 'Rs.',
  onOpenNewCustomer,
  onDownloadAllExcel
}) {
  let totalReceivable = 0; // You'll get (Customers owe us)
  let totalPayable = 0;    // You'll give (We owe suppliers/customers)
  let totalTxCount = 0;
  let todayCashIn = 0;
  let todayCreditGiven = 0;

  const todayStr = new Date().toISOString().slice(0, 10);

  customers.forEach(c => {
    const txs = transactionsMap[c.id] || [];
    totalTxCount += txs.length;

    let custDebit = 0;  // Maal Diya (You Gave)
    let custCredit = 0; // Paisa Mila (You Got)

    txs.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.type === 'give') {
        custDebit += amt;
      } else {
        custCredit += amt;
      }

      const txDateStr = (t.dateTime || t.date || '').slice(0, 10);
      if (txDateStr === todayStr) {
        if (t.type === 'get') todayCashIn += amt;
        if (t.type === 'give') todayCreditGiven += amt;
      }
    });

    const net = custDebit - custCredit;
    if (net > 0) {
      totalReceivable += net;
    } else if (net < 0) {
      totalPayable += Math.abs(net);
    }
  });

  const netBalance = totalReceivable - totalPayable;

  return (
    <div className="space-y-4">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Receivables (Lene Hain) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-emerald-100 dark:border-emerald-950/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              You'll Receive (لینے ہیں)
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className="flex items-baseline flex-nowrap gap-1.5 font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap leading-none tracking-tight overflow-hidden max-w-full"
              style={{ whiteSpace: 'nowrap', display: 'flex', flexWrap: 'nowrap', alignItems: 'baseline' }}
              title={`${currency} ${totalReceivable.toLocaleString()}`}
            >
              <span className="text-xs sm:text-sm font-semibold opacity-90 shrink-0 whitespace-nowrap">{currency}</span>
              <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold shrink-0 whitespace-nowrap tracking-tight">{totalReceivable.toLocaleString()}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap truncate">
              From {customers.filter(c => (c.balance || 0) > 0).length} customers
            </p>
          </div>
        </div>

        {/* Total Payables (Dene Hain) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-rose-100 dark:border-rose-950/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 whitespace-nowrap">
              You'll Give (دینے ہیں)
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className="flex items-baseline flex-nowrap gap-1.5 font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums whitespace-nowrap leading-none tracking-tight overflow-hidden max-w-full"
              style={{ whiteSpace: 'nowrap', display: 'flex', flexWrap: 'nowrap', alignItems: 'baseline' }}
              title={`${currency} ${totalPayable.toLocaleString()}`}
            >
              <span className="text-xs sm:text-sm font-semibold opacity-90 shrink-0 whitespace-nowrap">{currency}</span>
              <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold shrink-0 whitespace-nowrap tracking-tight">{totalPayable.toLocaleString()}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap truncate">
              To {customers.filter(c => (c.balance || 0) < 0).length} suppliers/accounts
            </p>
          </div>
        </div>

        {/* Net Business Balance */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Net Balance (خالص بقایا)
            </span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`flex items-baseline flex-nowrap gap-1.5 font-bold font-mono tabular-nums whitespace-nowrap leading-none tracking-tight overflow-hidden max-w-full ${
                netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
              style={{ whiteSpace: 'nowrap', display: 'flex', flexWrap: 'nowrap', alignItems: 'baseline' }}
              title={`${netBalance < 0 ? '-' : '+'} ${currency} ${Math.abs(netBalance).toLocaleString()}`}
            >
              <span className="text-xs sm:text-sm font-semibold opacity-90 shrink-0 whitespace-nowrap">
                {netBalance < 0 ? '-' : '+'} {currency}
              </span>
              <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold shrink-0 whitespace-nowrap tracking-tight">
                {Math.abs(netBalance).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap truncate">
              {netBalance >= 0 ? 'Surplus in market' : 'Deficit / Payables higher'}
            </p>
          </div>
        </div>

        {/* Today's Cash Flow */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Today's Activity
            </span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs whitespace-nowrap">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">In:&nbsp;+{currency}&nbsp;{todayCashIn.toLocaleString()}</span>
              <span className="text-rose-600 dark:text-rose-400 font-medium whitespace-nowrap">Out:&nbsp;-{currency}&nbsp;{todayCreditGiven.toLocaleString()}</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 whitespace-nowrap truncate">
              {customers.length} total parties • {totalTxCount} entries
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl p-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Fast Ledger Controls:</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewCustomer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="whitespace-nowrap">Add Party / Customer</span>
          </button>

          <button
            onClick={onDownloadAllExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="whitespace-nowrap">Download All Data (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
