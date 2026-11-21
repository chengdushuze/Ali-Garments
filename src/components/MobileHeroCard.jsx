import React from 'react';
import { ArrowDownLeft, ArrowUpRight, UserPlus, FileText, FileSpreadsheet, Wallet, Sparkles } from 'lucide-react';

export default function MobileHeroCard({
  customers,
  transactionsMap,
  currency = 'Rs.',
  onOpenNewCustomer,
  onOpenInvoice,
  onOpenExcel,
  onFilterChange
}) {
  let totalReceivable = 0;
  let totalPayable = 0;
  let receivableCount = 0;
  let payableCount = 0;

  customers.forEach(c => {
    const txs = transactionsMap[c.id] || [];
    let custDebit = 0;
    let custCredit = 0;

    txs.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.type === 'give') custDebit += amt;
      else custCredit += amt;
    });

    const net = custDebit - custCredit;
    if (net > 0) {
      totalReceivable += net;
      receivableCount++;
    } else if (net < 0) {
      totalPayable += Math.abs(net);
      payableCount++;
    }
  });

  const netBalance = totalReceivable - totalPayable;
  const isNetPositive = netBalance >= 0;

  return (
    <div className="md:hidden space-y-3">
      {/* Executive Financial Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 text-white p-5 shadow-xl shadow-slate-950/30">
        {/* Subtle Ambient Glow */}
        <div
          className={`absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl opacity-30 pointer-events-none ${
            isNetPositive ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />

        {/* Card Header Row */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Net Khata Balance (خالص بقایا)</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800/80 border border-slate-700/80 text-emerald-400 font-mono">
            <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
            Active
          </span>
        </div>

        {/* Large Single-Line Net Amount */}
        <div className="mt-2.5 relative z-10">
          <div
            className={`flex items-baseline flex-nowrap gap-1.5 font-bold font-mono whitespace-nowrap leading-none tabular-nums overflow-hidden ${
              isNetPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
            style={{ whiteSpace: 'nowrap', display: 'flex', flexWrap: 'nowrap', alignItems: 'baseline' }}
          >
            <span className="text-sm font-semibold opacity-85 shrink-0 whitespace-nowrap">
              {netBalance < 0 ? '-' : '+'} {currency}
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold shrink-0 whitespace-nowrap tracking-tight">
              {Math.abs(netBalance).toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            {isNetPositive ? 'Surplus in market (کاروباری سرپلس)' : 'Net Payables Higher (دینے زیادہ ہیں)'}
          </p>
        </div>

        {/* Two Interactive Summary Pills (Receive & Give) */}
        <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3.5 border-t border-slate-800/90 relative z-10">
          {/* Lene Hain (You'll Receive) */}
          <button
            type="button"
            onClick={() => onFilterChange && onFilterChange('receivable')}
            className="p-2.5 rounded-2xl bg-emerald-950/50 hover:bg-emerald-950/80 border border-emerald-800/50 text-left transition-all active:scale-95 cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400 mb-1">
              <span className="truncate">Lene Hain (لینے ہیں)</span>
              <ArrowDownLeft className="w-3.5 h-3.5 shrink-0 group-hover:translate-y-0.5 transition-transform" />
            </div>
            <div
              className="text-sm font-bold font-mono text-white whitespace-nowrap overflow-hidden"
              style={{ whiteSpace: 'nowrap' }}
            >
              {currency}&nbsp;{totalReceivable.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-300/80 block mt-0.5 font-medium">
              {receivableCount} parties owe us
            </span>
          </button>

          {/* Dene Hain (You'll Give) */}
          <button
            type="button"
            onClick={() => onFilterChange && onFilterChange('payable')}
            className="p-2.5 rounded-2xl bg-rose-950/50 hover:bg-rose-950/80 border border-rose-800/50 text-left transition-all active:scale-95 cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-rose-400 mb-1">
              <span className="truncate">Dene Hain (دینے ہیں)</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div
              className="text-sm font-bold font-mono text-white whitespace-nowrap overflow-hidden"
              style={{ whiteSpace: 'nowrap' }}
            >
              {currency}&nbsp;{totalPayable.toLocaleString()}
            </div>
            <span className="text-[10px] text-rose-300/80 block mt-0.5 font-medium">
              {payableCount} suppliers/accounts
            </span>
          </button>
        </div>
      </div>

      {/* Quick Action Touch Bar (Thumb Zone) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onOpenNewCustomer}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-950/30 transition-all cursor-pointer whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span>New Party</span>
        </button>

        <button
          onClick={onOpenInvoice}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 active:scale-95 text-slate-800 dark:text-slate-200 text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Invoice</span>
        </button>

        <button
          onClick={onOpenExcel}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 active:scale-95 text-slate-800 dark:text-slate-200 text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <FileSpreadsheet className="w-4 h-4 text-teal-500 shrink-0" />
          <span>Excel</span>
        </button>
      </div>
    </div>
  );
}
