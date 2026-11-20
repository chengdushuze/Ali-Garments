import React from 'react';
import { Cloud, CloudOff, RefreshCw, Database, AlertCircle } from 'lucide-react';

export default function SyncStatusPill({ syncState, onSyncNow }) {
  const { isConfigured, isSyncing, pendingCount, isQuotaExceeded, isOffline, lastSyncTime } = syncState;

  if (!isConfigured) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <Database className="w-3.5 h-3.5 text-slate-500" />
        <span>Local Cache</span>
      </div>
    );
  }

  if (isQuotaExceeded) {
    return (
      <button
        onClick={onSyncNow}
        title="D1 daily quota reached. Data stored safely in cache; tap to retry sync."
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-colors"
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
        <span>Quota Hold • Saved in Cache {pendingCount > 0 && `(${pendingCount})`}</span>
      </button>
    );
  }

  if (isOffline) {
    return (
      <button
        onClick={onSyncNow}
        title="Offline. Changes saved in local memory."
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200"
      >
        <CloudOff className="w-3.5 h-3.5 text-slate-400" />
        <span>Offline • In Cache {pendingCount > 0 && `(${pendingCount})`}</span>
      </button>
    );
  }

  if (isSyncing) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
        <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
        <span>Syncing to D1...</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <button
        onClick={onSyncNow}
        title="Click to sync pending changes to Cloudflare D1"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
        <span>Sync Pending ({pendingCount})</span>
      </button>
    );
  }

  return (
    <button
      onClick={onSyncNow}
      title={`Cloudflare D1 Connected. Last synced: ${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Recently'}`}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
    >
      <Cloud className="w-3.5 h-3.5 text-emerald-600" />
      <span>D1 Synced</span>
    </button>
  );
}
