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
  CheckCircle2
} from 'lucide-react';
import DeleteConsentModal from './DeleteConsentModal';

export default function RecycleBinModal({
  isOpen,
  onClose,
  items = [],
  onRestore,
  onPermanentDelete,
  onEmptyBin,
  onRefreshFromD1,
  currency = 'Rs.'
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'customer' | 'transaction' | 'invoice'
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [consentTarget, setConsentTarget] = useState(null);
  const [isEmptyConsentOpen, setIsEmptyConsentOpen] = useState(false);

  if (!isOpen) return null;

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
                <span>30-Day Auto Retention • Synced across all devices</span>
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
            {items.length > 0 && (
              <button
                onClick={() => setIsEmptyConsentOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
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
              const isCustomer = item.type === 'customer';
              const isTx = item.type === 'transaction';
              const isInv = item.type === 'invoice';

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon by Type */}
                    <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${
                      isCustomer
                        ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400'
                        : isTx
                        ? item.data?.type === 'give'
                          ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400'
                          : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400'
                        : 'bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400'
                    }`}>
                      {isCustomer ? (
                        <User className="w-4 h-4" />
                      ) : isTx ? (
                        item.data?.type === 'give' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {item.type}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                      </div>

                      {item.customerName && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Party: <span className="font-semibold text-slate-800 dark:text-slate-200">{item.customerName}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                        <span>Deleted: {new Date(item.deletedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className={`font-semibold flex items-center gap-1 ${
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
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      title="Restore item back to active ledgers"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => setConsentTarget(item)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title="Delete permanently"
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
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Item Permanent Consent Modal */}
      {consentTarget && (
        <DeleteConsentModal
          isOpen={Boolean(consentTarget)}
          onClose={() => setConsentTarget(null)}
          onConfirm={() => onPermanentDelete(consentTarget.id)}
          title="Delete Permanently?"
          itemName={consentTarget.title}
          itemType={consentTarget.type}
          details={`Deleted on ${new Date(consentTarget.deletedAt).toLocaleDateString()}`}
          isPermanent={true}
        />
      )}

      {/* Empty All Bin Consent Modal */}
      {isEmptyConsentOpen && (
        <DeleteConsentModal
          isOpen={isEmptyConsentOpen}
          onClose={() => setIsEmptyConsentOpen(false)}
          onConfirm={() => {
            onEmptyBin();
            setIsEmptyConsentOpen(false);
          }}
          title="Empty Entire Recycle Bin?"
          itemName={`All ${items.length} deleted items`}
          itemType="permanent"
          details="All items in the Recycle Bin will be permanently purged immediately across all devices."
          isPermanent={true}
        />
      )}
    </div>
  );
}
