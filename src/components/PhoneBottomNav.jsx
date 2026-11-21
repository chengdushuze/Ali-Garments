import React from 'react';
import { Users, TrendingUp, Plus, FileText, Menu, Sparkles } from 'lucide-react';

export default function PhoneBottomNav({
  activeTab = 'parties',
  onSelectTab,
  onOpenNewCustomer,
  onOpenInvoice,
  onOpenMenu,
  selectedCustomer = null,
  onBackToParties
}) {
  return (
    <nav className="md:hidden fixed bottom-2.5 left-3.5 right-3.5 z-40 max-w-md mx-auto select-none pointer-events-auto">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-1.5 shadow-2xl shadow-slate-950/25 flex items-center justify-between pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        {/* 1. Parties / Khata Directory */}
        <button
          type="button"
          onClick={() => {
            if (selectedCustomer && onBackToParties) {
              onBackToParties();
            }
            onSelectTab('parties');
          }}
          className={`flex-1 py-1.5 px-2 flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer ${
            activeTab === 'parties' && !selectedCustomer
              ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/70 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-5 h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium whitespace-nowrap">Parties</span>
        </button>

        {/* 2. Analytics & Cash Flow */}
        <button
          type="button"
          onClick={() => onSelectTab('stats')}
          className={`flex-1 py-1.5 px-2 flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/70 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-5 h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium whitespace-nowrap">Analytics</span>
        </button>

        {/* 3. Center Elevated Action Button (+ New Party) */}
        <div className="flex-shrink-0 px-1 -mt-5">
          <button
            type="button"
            onClick={onOpenNewCustomer}
            title="Add New Customer / Supplier"
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/35 border-2 border-white dark:border-slate-900 active:scale-90 transition-transform cursor-pointer"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. Smart Invoice Builder */}
        <button
          type="button"
          onClick={onOpenInvoice}
          className="flex-1 py-1.5 px-2 flex flex-col items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
        >
          <FileText className="w-5 h-5 shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium whitespace-nowrap">Invoice</span>
        </button>

        {/* 5. More / Settings & Admin Drawer */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex-1 py-1.5 px-2 flex flex-col items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
        >
          <Menu className="w-5 h-5 shrink-0" />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium whitespace-nowrap">Menu</span>
        </button>
      </div>
    </nav>
  );
}
