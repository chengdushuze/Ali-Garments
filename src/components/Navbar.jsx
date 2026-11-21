import React from 'react';
import { Sun, Moon, Settings, FileSpreadsheet, FileText, Trash2, Shield, LogOut, User, Crown } from 'lucide-react';
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
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Left with Custom Rana ALI Garments Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src={settings.logoUrl || '/logo.png'}
              alt="Rana ALI Garments Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shadow-md shadow-emerald-500/20 shrink-0 bg-white p-0.5 border border-slate-200 dark:border-slate-800 hover:scale-105 transition-transform"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                  {settings.shopName || 'ALI Garments'}
                </h1>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded uppercase tracking-wider whitespace-nowrap">
                  Khata
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px] sm:max-w-xs">
                {settings.shopTagline || 'Smart Ledger & Invoicing'}
              </p>
            </div>
          </div>

          {/* Center / Sync Pill */}
          <div className="hidden lg:flex items-center gap-2">
            <SyncStatusPill syncState={syncState} onSyncNow={onSyncNow} />
          </div>

          {/* Right Action Icons & User Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Admin / Super Admin Portal Button */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
              <button
                onClick={onOpenAdminPanel}
                title={currentUser?.role === 'super_admin' ? 'Super Admin Control Center' : 'Admin Management Portal'}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer whitespace-nowrap shadow-sm ${
                  currentUser?.role === 'super_admin'
                    ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-500 dark:text-amber-300 border border-amber-400/50 shadow-amber-500/10'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/40'
                }`}
              >
                {currentUser?.role === 'super_admin' ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <span className="whitespace-nowrap">{currentUser?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
              </button>
            )}

            {/* One Click All Data Download (Desktop / Tablet) */}
            <button
              onClick={onDownloadAllExcel}
              title="Download All Ledger Data (Excel .xlsx)"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden md:inline whitespace-nowrap">Export Excel</span>
            </button>

            {/* Invoices (Desktop / Tablet) */}
            <button
              onClick={onOpenInvoiceBuilder}
              title="Create Smart Invoice"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all active:scale-95 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden md:inline whitespace-nowrap">Invoice</span>
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
                <button
                  onClick={onLogout}
                  title={`Sign Out (${currentUser.name})`}
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
