import React, { useState } from 'react';
import {
  Trash2,
  X,
  RotateCcw,
  Clock,
  Search,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';

export default function RecycleBinModal({
  isOpen,
  onClose,
  items = [],
  onRestore,
  onPermanentDelete,
  onEmptyBin,
  onRefreshFromD1,
  currentUser,
  currency = 'Rs.'
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'customer' | 'transaction' | 'invoice'
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Deletion Auth State
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'single', item } or { type: 'empty_all' }
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');
  const [showDeleteAdminPassword, setShowDeleteAdminPassword] = useState(false);
  const [isVerifyingDelete, setIsVerifyingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Non-Admin Permission Warning Popup State
  const [showNonAdminWarning, setShowNonAdminWarning] = useState(false);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Filter items
  const filtered = items.filter(item => {
    if (activeTab !== 'all' && item.type !== activeTab) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.customerName?.toLowerCase().includes(q) ||
      item.type?.toLowerCase().includes(q)
    );
  });

  const getDaysRemaining = (expiresAt) => {
    if (!expiresAt) return 30;
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const handleRefresh = async () => {
    if (!onRefreshFromD1) return;
    setIsRefreshing(true);
    try {
      await onRefreshFromD1();
    } finally {
      setIsRefreshing(false);
    }
  };

  const initiatePermanentDelete = (item) => {
    if (!isAdmin) {
      setShowNonAdminWarning(true);
      return;
    }
    setDeleteTarget({ type: 'single', item });
    setDeleteAdminPassword('');
    setShowDeleteAdminPassword(false);
    setDeleteError('');
  };

  const initiateEmptyBin = () => {
    if (!isAdmin) {
      setShowNonAdminWarning(true);
      return;
    }
    setDeleteTarget({ type: 'empty_all' });
    setDeleteAdminPassword('');
    setShowDeleteAdminPassword(false);
    setDeleteError('');
  };

  const handleConfirmPermanentDelete = async (e) => {
    e.preventDefault();
    if (!deleteAdminPassword) {
      setDeleteError('Please enter your account password to authorize permanent deletion.');
      return;
    }

    setIsVerifyingDelete(true);
    setDeleteError('');

    try {
      // Strictly verify admin password via backend
      const res = await apiFetch('/api/admin/verify-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deleteAdminPassword,
          action: 'recycle_bin_delete',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setDeleteError(data.error || 'Incorrect password. Permanent deletion was not authorized.');
        return;
      }

      // Password verified successfully: execute deletion
      if (deleteTarget.type === 'single' && deleteTarget.item) {
        await onPermanentDelete(deleteTarget.item.id);
      } else if (deleteTarget.type === 'empty_all') {
        await onEmptyBin();
      }

      setDeleteTarget(null);
      setDeleteAdminPassword('');
    } catch (err) {
      setDeleteError('Failed to verify credentials with server. Please try again.');
    } finally {
      setIsVerifyingDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Recycle Bin
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>30-Day Auto Retention • Permanent delete restricted to Administrators</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefreshFromD1 && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh Recycle Bin from Cloudflare D1"
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            {/* Empty Bin is strictly visible only to Admin and Super Admin */}
            {items.length > 0 && isAdmin && (
              <button
                onClick={initiateEmptyBin}
                className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors whitespace-nowrap cursor-pointer"
              >
                Empty Bin
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search deleted items, parties, invoices..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'customer', label: 'Customers' },
              { id: 'transaction', label: 'Transactions' },
              { id: 'invoice', label: 'Invoices' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Items List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-600 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Trash2 className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {items.length === 0 ? 'Recycle Bin is empty' : 'No matching deleted items found'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Any customer, transaction, or invoice deleted in the app will be safely kept here for 30 days before automatic removal.
              </p>
            </div>
          ) : (
            filtered.map(item => {
              const daysLeft = getDaysRemaining(item.expiresAt);
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
                      {item.type === 'customer' ? (
                        <User className="w-4 h-4 text-emerald-600" />
                      ) : item.type === 'invoice' ? (
                        <FileText className="w-4 h-4 text-indigo-500" />
                      ) : item.direction === 'give' ? (
                        <ArrowUpRight className="w-4 h-4 text-rose-500" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.type}
                        </span>
                        {item.amount && (
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                            {currency} {Number(item.amount).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        {item.customerName && (
                          <span>Party: <strong className="text-slate-700 dark:text-slate-300">{item.customerName}</strong></span>
                        )}
                        <span>Deleted: {new Date(item.deletedAt).toLocaleDateString()}</span>
                        <span className={`inline-flex items-center gap-1 font-semibold ${
                          daysLeft <= 5
                            ? 'text-rose-600 dark:text-rose-400'
                            : daysLeft <= 15
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left until auto-removal
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => onRestore(item)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      title="Restore item back to active ledgers"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                      <span className="whitespace-nowrap">Restore</span>
                    </button>
                    <button
                      onClick={() => initiatePermanentDelete(item)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                      title={isAdmin ? "Delete permanently" : "Admin required for permanent deletion"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Automatic 30-Day Expiration Policy enforced across all synced devices
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </div>

      {/* Website Custom Popup: Permanent Delete Security Authorization Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">
                    Permanent Deletion Authorization
                  </h4>
                  <p className="text-xs text-slate-400">
                    Administrator Security Verification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteAdminPassword('');
                  setDeleteError('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Irreversible Action Warning
              </p>
              <p className="leading-relaxed text-slate-300">
                {deleteTarget.type === 'single'
                  ? `You are about to permanently erase "${deleteTarget.item?.title}" across all devices and Cloudflare D1 database.`
                  : `You are about to permanently purge ALL ${items.length} items from the Recycle Bin across all devices.`}
              </p>
            </div>

            <form onSubmit={handleConfirmPermanentDelete} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Enter Your Password to Authorize:
                </label>
                <div className="relative">
                  <input
                    type={showDeleteAdminPassword ? 'text' : 'password'}
                    value={deleteAdminPassword}
                    onChange={e => {
                      setDeleteAdminPassword(e.target.value);
                      setDeleteError('');
                    }}
                    placeholder="Enter account password..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeleteAdminPassword(!showDeleteAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showDeleteAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {deleteError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteAdminPassword('');
                    setDeleteError('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingDelete}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isVerifyingDelete ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm & Delete Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Website Custom Popup: Non-Admin Permission Warning Modal */}
      {showNonAdminWarning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-base">
                Administrator Privileges Required
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Permanent deletion from the Recycle Bin is strictly reserved for Administrators and Super Admin.
              </p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
              You can freely <strong>Restore</strong> this item back to active ledgers at any time. Expired items will be automatically cleaned up after 30 days.
            </p>
            <button
              type="button"
              onClick={() => setShowNonAdminWarning(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}