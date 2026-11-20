import React from 'react';
import { AlertTriangle, Trash2, X, RefreshCw, Clock } from 'lucide-react';

export default function DeleteConsentModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete Item?',
  itemName = '',
  itemType = 'transaction', // 'transaction' | 'customer' | 'invoice' | 'permanent'
  details = null,
  isPermanent = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden">
        {/* Header Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-2xl ${
            isPermanent 
              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400' 
              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
          }`}>
            {isPermanent ? <AlertTriangle className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {title}
        </h3>

        {/* Target Name */}
        {itemName && (
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Target {itemType.charAt(0).toUpperCase() + itemType.slice(1)}
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
              {itemName}
            </p>
            {details && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {details}
              </p>
            )}
          </div>
        )}

        {/* Explanation & 30-day Policy Notice */}
        {!isPermanent ? (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 mb-6 text-xs text-emerald-800 dark:text-emerald-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>30-Day Recycle Bin Safety Guarantee</span>
            </div>
            <p className="leading-relaxed">
              This item will <strong>not</strong> be lost. It will be moved to the shared <strong>Recycle Bin</strong> for <strong>30 days</strong> and can be restored at any time on any synced device.
            </p>
            <p className="text-[11px] opacity-80">
              After 30 days, expired items are automatically and permanently purged.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 mb-6 text-xs text-rose-800 dark:text-rose-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>Permanent Deletion Warning</span>
            </div>
            <p className="leading-relaxed">
              This action cannot be undone. This item will be permanently erased immediately across all synced devices.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${
              isPermanent
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
            }`}
          >
            {isPermanent ? 'Permanently Delete' : 'Move to Recycle Bin'}
          </button>
        </div>
      </div>
    </div>
  );
}
