import React from 'react';
import { Sun, Moon, Trash2, Shield, Crown, RefreshCw, Menu } from 'lucide-react';

export default function MobileHeader({
  settings,
  currentUser,
  theme,
  toggleTheme,
  recycleBinCount = 0,
  onOpenRecycleBin,
  onOpenMenu,
  onOpenAdminPanel,
  syncState,
  onSyncNow
}) {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors shadow-sm pt-[max(env(safe-area-inset-top),1.75rem)] px-3.5 pb-2.5">
      <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
        {/* Left: Brand Avatar & Shop Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src={settings.logoUrl || '/logo.png'}
              alt="ALI Garments Logo"
              className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm"
            />
            {/* Live Cloud Status Dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                syncState?.isOffline
                  ? 'bg-amber-500 animate-pulse'
                  : syncState?.isSyncing
                  ? 'bg-blue-500 animate-spin'
                  : 'bg-emerald-500'
              }`}
              title={syncState?.isOffline ? 'Offline Mode' : 'Cloud Synchronized'}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                {settings.shopName || 'ALI Garments'}
              </h1>
              {isSuperAdmin ? (
                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5 text-amber-500" />
                  Super
                </span>
              ) : isAdmin ? (
                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" />
                  Admin
                </span>
              ) : null}
            </div>
            <button
              onClick={onSyncNow}
              disabled={syncState?.isSyncing}
              className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left"
            >
              <span>{syncState?.isOffline ? 'Offline Cache' : 'Cloud D1 Synced'}</span>
              <RefreshCw className={`w-2.5 h-2.5 text-emerald-500 ${syncState?.isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Recycle Bin Button */}
          <button
            onClick={onOpenRecycleBin}
            aria-label="Recycle Bin"
            className="relative p-2 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
            {recycleBinCount > 0 && (
              <span className="absolute 1 top-1 right-1 w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Mobile Menu Drawer Button */}
          <button
            onClick={onOpenMenu}
            aria-label="Open Mobile Menu"
            className="p-2 rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer active:scale-95"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
