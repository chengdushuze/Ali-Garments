import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Building,
  CreditCard,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Image,
  QrCode,
  Key,
  ShieldCheck,
  FileSpreadsheet,
  Clock,
  HardDriveDownload,
  Lock,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import { getFullBackupData, restoreFullBackupData } from '../services/storage';
import { apiFetch } from '../services/apiClient';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onDownloadAllExcel,
  customers,
  transactionsMap,
  appLockConfig = { enabled: false, pin: '', autoLockMinutes: 0 },
  onSaveAppLockConfig,
  onTriggerAppLock
}) {
  const [activeTab, setActiveTab] = useState('company'); // 'company', 'payments', 'backup', 'app_lock'
  const [formData, setFormData] = useState({ ...settings });

  // App Lock Form State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPinCheck, setCurrentPinCheck] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [appLockMsg, setAppLockMsg] = useState({ type: '', text: '' });
  const [showPin, setShowPin] = useState(false);
  const [backupInfo, setBackupInfo] = useState({
    cloudTime: null,
    cloudDetails: null,
    localTime: typeof window !== 'undefined' ? localStorage.getItem('ali_garments_last_backup_time') : null,
    isLoading: false,
  });

  const fetchCloudBackupInfo = async () => {
    setBackupInfo(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await apiFetch('/api/admin/backup');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.backup) {
        setBackupInfo(prev => ({
          ...prev,
          cloudTime: data.backup.lastBackupTime || null,
          cloudDetails: data.backup.details || null,
          isLoading: false,
        }));
      } else {
        setBackupInfo(prev => ({ ...prev, isLoading: false }));
      }
    } catch (e) {
      console.warn('Could not fetch cloud backup info:', e);
      setBackupInfo(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'backup') {
      fetchCloudBackupInfo();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Logo file size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleChange('logoUrl', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      handleChange('qrCodeUrl', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleTestD1Connection = async () => {
    setTestStatus({ loading: true, message: 'Connecting to Cloudflare D1...' });

    if (!formData.d1AccountId || !formData.d1DatabaseId || !formData.d1ApiToken) {
      setTestStatus({
        loading: false,
        success: false,
        message: 'Please provide Account ID, Database ID, and API Token first.'
      });
      return;
    }

    try {
      const initRes = await initD1Tables(formData);
      if (initRes.success) {
        setTestStatus({
          loading: false,
          success: true,
          message: 'Connected successfully! D1 database tables verified & initialized.'
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: initRes.message || 'Connection failed. Please verify credentials.'
        });
      }
    } catch (e) {
      setTestStatus({
        loading: false,
        success: false,
        message: `Error: ${e.message}`
      });
    }
  };

  const handleSave = () => {
    onSaveSettings(formData);
    onClose();
  };

  // Full JSON Backup
  const handleDownloadBackup = async () => {
    const backup = await getFullBackupData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ALI_Garments_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem('ali_garments_last_backup_time', nowIso);
    } catch (e) {}
    setBackupInfo(prev => ({ ...prev, localTime: nowIso }));
  };

  // Restore JSON Backup
  const handleRestoreBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        await restoreFullBackupData(json);
        alert('Backup restored successfully! Reloading...');
        window.location.reload();
      } catch (err) {
        alert(`Failed to restore backup: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/75 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 md:rounded-3xl max-w-2xl w-full h-full md:h-auto md:max-h-[90vh] shadow-2xl border-0 md:border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header (Clean, Mobile App-Friendly with Back/Close) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600" />
              <span>App Settings • ترتیبات</span>
            </h3>
            <p className="text-xs text-slate-500">
              Customize Company Profile, Invoicing, Payments & App Lock
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Settings"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (Clean pills, no raw DB credentials shown in app) */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50/50 dark:bg-slate-950/30 overflow-x-auto text-xs font-medium shrink-0">
          <button
            onClick={() => setActiveTab('company')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              activeTab === 'company'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Company & Logo</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              activeTab === 'payments'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payment Info & QR</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              activeTab === 'backup'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Backup & Export</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('app_lock');
              setAppLockMsg({ type: '', text: '' });
              setIsChangingPin(false);
              setNewPin('');
              setConfirmPin('');
              setCurrentPinCheck('');
            }}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              activeTab === 'app_lock'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Lock className="w-4 h-4 text-emerald-500" />
            <span>App Lock (APK)</span>
          </button>
        </div>

        {/* Tab Body (Full scrolling on mobile, padded for bottom button) */}
        <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto pb-24 md:pb-6">
          {/* TAB 1: COMPANY & LOGO */}
          {activeTab === 'company' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Shop / Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.shopName}
                    onChange={e => handleChange('shopName', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={e => handleChange('currency', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Tagline / Business Subtitle
                </label>
                <input
                  type="text"
                  value={formData.shopTagline}
                  onChange={e => handleChange('shopTagline', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Primary Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone1}
                    onChange={e => handleChange('phone1', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Secondary Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone2}
                    onChange={e => handleChange('phone2', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Shop Address & Market
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => handleChange('address', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  NTN / TRN Tax ID
                </label>
                <input
                  type="text"
                  value={formData.ntn}
                  onChange={e => handleChange('ntn', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              {/* Logo Upload */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Custom Invoice & App Logo
                </label>
                <div className="flex items-center gap-4">
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Current Logo"
                      className="w-16 h-16 rounded-xl object-contain border p-1 bg-white"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                      <Image className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    <p className="text-[10px] text-slate-400">PNG, JPG or SVG (Max 2MB)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PAYMENTS & QR */}
          {activeTab === 'payments' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meezan Bank / HBL"
                  value={formData.bankName}
                  onChange={e => handleChange('bankName', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Account Title
                  </label>
                  <input
                    type="text"
                    value={formData.accountTitle}
                    onChange={e => handleChange('accountTitle', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={e => handleChange('accountNumber', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  IBAN Number
                </label>
                <input
                  type="text"
                  placeholder="PK12MEZN000..."
                  value={formData.iban}
                  onChange={e => handleChange('iban', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    JazzCash Account
                  </label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={formData.jazzCash}
                    onChange={e => handleChange('jazzCash', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    EasyPaisa Account
                  </label>
                  <input
                    type="text"
                    placeholder="0321-7654321"
                    value={formData.easyPaisa}
                    onChange={e => handleChange('easyPaisa', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Payment QR Code Upload */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Payment QR Code (Displays on Invoices)
                </label>
                <div className="flex items-center gap-4">
                  {formData.qrCodeUrl ? (
                    <img
                      src={formData.qrCodeUrl}
                      alt="Current QR Code"
                      className="w-16 h-16 rounded-xl object-contain border p-1 bg-white"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                      <QrCode className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrUpload}
                      className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    <p className="text-[10px] text-slate-400">Raast / Bank / JazzCash QR code</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP & EXPORT */}
          {activeTab === 'backup' && (
            <div className="space-y-4 text-xs">
              {/* Last Backup Time Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 text-white shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white uppercase tracking-wider">
                        Backup Status & Timestamps
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Tracks automated Cloud D1 snapshots & manual offline JSON exports
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={fetchCloudBackupInfo}
                    disabled={backupInfo.isLoading}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${backupInfo.isLoading ? 'animate-spin' : ''}`} />
                    <span>{backupInfo.isLoading ? 'Checking...' : 'Refresh'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Cloud D1 Backup Status */}
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                      ☁️ Cloud D1 Last Backup Time
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400 block whitespace-nowrap">
                      {backupInfo.cloudTime
                        ? new Date(backupInfo.cloudTime).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'No automated snapshot recorded'}
                    </span>
                    {backupInfo.cloudDetails && (
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                        {backupInfo.cloudDetails}
                      </span>
                    )}
                  </div>

                  {/* Local JSON Backup Status */}
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                      💾 Local JSON Last Export Time
                    </span>
                    <span className="text-xs font-mono font-bold text-teal-300 block whitespace-nowrap">
                      {backupInfo.localTime
                        ? new Date(backupInfo.localTime).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'No offline export recorded yet'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Full system state preserved on disk
                    </span>
                  </div>
                </div>
              </div>

              {/* One-Click Excel All Data */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    One-Click Complete Ledger Excel (.xlsx)
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    Export all customer accounts, balances & timestamped transaction history into structured multi-tab Excel workbook.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDownloadAllExcel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex-shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download XLS</span>
                </button>
              </div>

              {/* JSON Backup Download */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    Full JSON System Backup
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    Download an offline backup file containing all settings, customers, invoices and transactions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white flex-shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Export JSON</span>
                </button>
              </div>

              {/* Restore JSON Backup */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Restore from JSON Backup
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Select a previous backup JSON file to restore your entire ledger and configuration.
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreBackup}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300"
                />
              </div>
            </div>
          )}

          {/* TAB 5: APP LOCK (APK & Mobile Security) */}
          {activeTab === 'app_lock' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>APK & Device Security • App Lock Protection</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  App Lock secures your ALI Garments Khata on this device. Whenever the app opens or resumes from background, a 4-digit PIN is required to unlock your accounts and customer ledgers.
                </p>
              </div>

              {appLockMsg.text && (
                <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  appLockMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}>
                  {appLockMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{appLockMsg.text}</span>
                </div>
              )}

              {/* Status Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    appLockConfig.enabled
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">
                      {appLockConfig.enabled ? 'App Lock is Active' : 'App Lock is Disabled'}
                    </h4>
                    <p className="text-slate-500 text-[11px]">
                      {appLockConfig.enabled
                        ? 'Protected with 4-digit PIN on this phone / browser.'
                        : 'Anyone with this device can open ledgers directly.'}
                    </p>
                  </div>
                </div>

                {appLockConfig.enabled && onTriggerAppLock && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onTriggerAppLock();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
                  >
                    Lock Now
                  </button>
                )}
              </div>

              {/* Configure or Change PIN Form */}
              {(!appLockConfig.enabled || isChangingPin) ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-500" />
                    <span>{isChangingPin ? 'Change Security PIN' : 'Set Up New 4-Digit PIN'}</span>
                  </h4>

                  {isChangingPin && (
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Current PIN
                      </label>
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={4}
                        placeholder="••••"
                        value={currentPinCheck}
                        onChange={e => setCurrentPinCheck(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tracking-widest text-center text-lg"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        New 4-Digit PIN
                      </label>
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={4}
                        placeholder="••••"
                        value={newPin}
                        onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tracking-widest text-center text-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Confirm 4-Digit PIN
                      </label>
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={4}
                        placeholder="••••"
                        value={confirmPin}
                        onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tracking-widest text-center text-lg"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPin ? 'Hide PIN Digits' : 'Show PIN Digits'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {isChangingPin && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingPin(false);
                            setAppLockMsg({ type: '', text: '' });
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isChangingPin && currentPinCheck !== appLockConfig.pin) {
                            setAppLockMsg({ type: 'error', text: 'Current PIN is incorrect.' });
                            return;
                          }
                          if (newPin.length !== 4) {
                            setAppLockMsg({ type: 'error', text: 'PIN must be exactly 4 numeric digits.' });
                            return;
                          }
                          if (newPin !== confirmPin) {
                            setAppLockMsg({ type: 'error', text: 'New PIN and Confirm PIN do not match.' });
                            return;
                          }
                          const updated = {
                            enabled: true,
                            pin: newPin,
                            autoLockMinutes: appLockConfig.autoLockMinutes || 0,
                          };
                          onSaveAppLockConfig(updated);
                          setIsChangingPin(false);
                          setNewPin('');
                          setConfirmPin('');
                          setCurrentPinCheck('');
                          setAppLockMsg({ type: 'success', text: 'App Lock PIN successfully saved and activated!' });
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        {isChangingPin ? 'Update PIN' : 'Enable App Lock'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* App Lock Options when already enabled */
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Auto-Lock Delay When Minimized
                    </label>
                    <select
                      value={appLockConfig.autoLockMinutes || 0}
                      onChange={e => {
                        const updated = {
                          ...appLockConfig,
                          autoLockMinutes: Number(e.target.value),
                        };
                        onSaveAppLockConfig(updated);
                        setAppLockMsg({ type: 'success', text: 'Auto-lock policy updated.' });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium"
                    >
                      <option value={0}>Immediately when minimizing or leaving app</option>
                      <option value={1}>After 1 minute in background</option>
                      <option value={5}>After 5 minutes in background</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPin(true);
                        setAppLockMsg({ type: '', text: '' });
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Change 4-Digit PIN
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSaveAppLockConfig({ enabled: false, pin: '', autoLockMinutes: 0 });
                        setAppLockMsg({ type: 'success', text: 'App Lock has been disabled.' });
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold"
                    >
                      Turn Off App Lock
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            Save Settings & Changes
          </button>
        </div>
      </div>
    </div>
  );
}
