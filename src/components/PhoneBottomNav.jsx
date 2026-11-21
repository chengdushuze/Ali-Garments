import React from 'react';
import { Users, TrendingUp, FileText, FileSpreadsheet, Shield, Settings, Trash2 } from 'lucide-react';

export default function PhoneBottomNav({
  activeTab = 'parties',
  onSelectTab,
  onOpenInvoice,
  onOpenExcel,
  onOpenAdmin,
  onOpenSettings,
  isAdmin = false,
  selectedCustomer = null,
  onBackToParties
}) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1 py-1.5 shadow-2xl select-none pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {/* Parties / Ledger Tab */}
        <button
          onClick={() => {
            if (selectedCustomer && onBackToParties) {
              onBackToParties();
            }
            onSelectTab('parties');
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'parties'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 whitespace-nowrap">Parties</span>
        </button>

        {/* Analytics / Stats Tab */}
        <button
          onClick={() => onSelectTab('stats')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 whitespace-nowrap">Analytics</span>
        </button>

        {/* Smart Invoice Builder Trigger */}
        <button
          onClick={onOpenInvoice}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-all cursor-pointer"
        >
          <div className="p-1 rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 -mt-2">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium whitespace-nowrap">Invoice</span>
        </button>

        {/* Excel Export Trigger */}
        <button
          onClick={onOpenExcel}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-all cursor-pointer"
        >
          <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] mt-0.5 font-medium whitespace-nowrap">Excel</span>
        </button>

        {/* Admin Portal (if admin role) */}
        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all cursor-pointer"
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-bold whitespace-nowrap">Admin</span>
          </button>
        )}

        {/* App Settings */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-all cursor-pointer"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium whitespace-nowrap">Settings</span>
        </button>
      </div>
    </nav>
  );
}
