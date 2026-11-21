import React from 'react';
import {
  X,
  Shield,
  Crown,
  Lock,
  Database,
  FileSpreadsheet,
  Trash2,
  Settings,
  LogOut,
  User,
  RefreshCw,
  Sun,
  Moon,
  ChevronRight
} from 'lucide-react';

export default function MobileMenuDrawer({
  isOpen,
  onClose,
  currentUser,
  settings,
  theme,
  toggleTheme,
  recycleBinCount = 0,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenRecycleBin,
  onDownloadAllExcel,
  onSyncNow,
  syncState,
  onLogout
}) {
  if (!isOpen) return null;

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Background dismiss click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Bottom Sheet Modal Container */}
      <div className="relative w-full max-w-lg bg-slate-900 border-t border-slate-800 rounded-t-[32px] p-5 shadow-2xl text-white space-y-4 max-h-[88vh] overflow-y-auto pb-[max(env(safe-area-inset-bottom),1.5rem)] animate-in slide-in-from-bottom duration-300">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto" />

        {/* Header & User Profile Card */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'AG'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-sm text-white truncate">
                  {currentUser?.name || 'Account User'}
                </h3>
                {isSuperAdmin ? (
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5 text-amber-400" />
                    Super Admin
                  </span>
                ) : isAdmin ? (
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    Admin
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[9px] font-medium bg-slate-800 text-slate-300 rounded-full">
                    User
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
                {currentUser?.email}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section: Management & Privileges */}
        {isAdmin && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 block">
              Administration & Control
            </span>
            <button
              onClick={() => {
                onClose();
                onOpenAdminPanel();
              }}
              className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-500/60 transition-all flex items-center justify-between group cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                  {isSuperAdmin ? <Crown className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                </div>
                <div className="text-left">
                  <div className="font-bold text-xs text-amber-200">
                    {isSuperAdmin ? 'Super Admin Control Center' : 'Admin Management Panel'}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Users, security gate, role manager & audit logs
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* Section: Tools & Data Operations */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 block">
            Tools & Ledger Data
          </span>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl divide-y divide-slate-800/60 overflow-hidden">
            {/* Cloud D1 Sync */}
            <button
              onClick={() => {
                onClose();
                onSyncNow && onSyncNow();
              }}
              className="w-full p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                  <RefreshCw className={`w-4 h-4 ${syncState?.isSyncing ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Cloudflare D1 Sync</div>
                  <p className="text-[11px] text-slate-400">
                    {syncState?.isOffline ? 'Offline mode active' : 'Live cloud synchronization'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">Sync Now</span>
            </button>

            {/* Excel Export */}
            <button
              onClick={() => {
                onClose();
                onDownloadAllExcel();
              }}
              className="w-full p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Export Full Ledger (Excel)</div>
                  <p className="text-[11px] text-slate-400">Download formatted multi-tab workbook (.xlsx)</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>

            {/* Recycle Bin */}
            <button
              onClick={() => {
                onClose();
                onOpenRecycleBin();
              }}
              className="w-full p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Recycle Bin</div>
                  <p className="text-[11px] text-slate-400">30-day auto retention for deleted ledgers</p>
                </div>
              </div>
              {recycleBinCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white font-mono">
                  {recycleBinCount} items
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">Empty</span>
              )}
            </button>

            {/* Settings & App Lock */}
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="w-full p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Store Settings & App Lock</div>
                  <p className="text-[11px] text-slate-400">Shop profile, APK 4-digit PIN lock & backup</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Section: Quick Actions & Sign Out */}
        <div className="pt-2 flex items-center gap-2">
          {/* Theme Toggle Pill */}
          <button
            onClick={toggleTheme}
            className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-400" />
                <span>Dark Mode</span>
              </>
            )}
          </button>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex-1 py-2.5 px-3 rounded-2xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-xs font-bold text-rose-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
