import React from 'react';
import { Sun, Moon, Settings, FileSpreadsheet, FileText, Trash2, Shield, LogOut, User } from 'lucide-react';
import SyncStatusPill from './SyncStatusPill';

export default function Navbar({
  theme,
  toggleTheme,
  onOpenSettings,
  onOpenInvoiceBuilder,
  onOpenRecycleBin,
  recycleBinCount = 0,
  onDownloadAllExcel,
  syncState,
  onSyncNow,
  settings,
  currentUser,
  onOpenAdminPanel,
  onLogout
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Left */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md shadow-emerald-500/20 flex-shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="text-emerald-400 font-black text-sm tracking-tighter font-serif">
                  AG
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {settings.shopName || 'ALI Garments'}
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-md uppercase tracking-wider">
                  Khata
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px] sm:max-w-xs">
                {settings.shopTagline || 'Smart Ledger & Invoicing'}
              </p>
            </div>
          </div>

          {/* Center / Sync Pill */}
          <div className="hidden lg:flex items-center gap-2">
            <SyncStatusPill syncState={syncState} onSyncNow={onSyncNow} />
          </div>

          {/* Right Action Icons & User Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Admin Portal Button (Admin Role Only) */}
            {currentUser?.role === 'admin' && (
              <button
                onClick={onOpenAdminPanel}
                title="Admin User Management Portal"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all active:scale-95"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin Users</span>
              </button>
            )}

            {/* One Click All Data Download */}
            <button
              onClick={onDownloadAllExcel}
              title="Download All Ledger Data (Excel .xlsx)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Export Excel</span>
            </button>

            {/* Invoices */}
            <button
              onClick={onOpenInvoiceBuilder}
              title="Create Smart Invoice"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden md:inline">Invoice</span>
            </button>

            {/* Recycle Bin (Trash) */}
            <button
              onClick={onOpenRecycleBin}
              title="Recycle Bin (30-Day Auto Retention)"
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              {recycleBinCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[10px] font-black bg-rose-600 text-white rounded-full leading-tight shadow-sm animate-pulse">
                  {recycleBinCount > 99 ? '99+' : recycleBinCount}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              aria-label="App Settings & Cloudflare D1"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Profile & Logout */}
            {currentUser && (
              <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 dark:border-slate-800">
                <div
                  title={`Signed in as ${currentUser.name} (${currentUser.email})`}
                  className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium max-w-[100px] truncate">{currentUser.name}</span>
                  <span className="text-[10px] uppercase font-mono px-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {currentUser.role}
                  </span>
                </div>

                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-2 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
