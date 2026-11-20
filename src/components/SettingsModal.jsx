import React, { useState } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import { executeD1Query, initD1Tables } from '../services/d1Sync';
import { getFullBackupData, restoreFullBackupData } from '../services/storage';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onDownloadAllExcel,
  customers,
  transactionsMap
}) {
  const [activeTab, setActiveTab] = useState('d1'); // 'd1', 'company', 'payments', 'backup'
  const [formData, setFormData] = useState({ ...settings });
  const [testStatus, setTestStatus] = useState(null); // { loading, success, message }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              App Settings & Cloudflare D1
            </h3>
            <p className="text-xs text-slate-500">
              Configure Cloudflare D1 Database, Invoicing, Logo & Payments
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50/50 dark:bg-slate-950/30 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('d1')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'd1'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Cloudflare D1 Database</span>
          </button>

          <button
            onClick={() => setActiveTab('company')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
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
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
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
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Backup & Export</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* TAB 1: CLOUDFLARE D1 */}
          {activeTab === 'd1' && (
            <div className="space-y-4 text-xs">
              {/* Architecture Info Box */}
              <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Ultra Quota-Saving Single-Row Engine Active</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Each customer uses exactly <strong>1 single row</strong> in Cloudflare D1 for all their transactions until hitting the ~1.8MB limit! This preserves 99% of your D1 daily read/write free limits.
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  <strong>Zero-Wait Cache:</strong> Data is read instantly from local IndexedDB cache memory. If the D1 daily limit is reached, your app never stops working: data stays safely in cache and syncs when limits reset.
                </p>
              </div>

              {/* Required Keys Box */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  Required Cloudflare D1 Keys
                </h4>

                {/* 1. Account ID */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    1. Cloudflare Account ID *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 7f3b890a12c45d67890ef1234567890a"
                    value={formData.d1AccountId}
                    onChange={e => handleChange('d1AccountId', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Found in Cloudflare Dashboard URL or right sidebar of your Account overview.
                  </p>
                </div>

                {/* 2. D1 Database ID */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    2. D1 Database ID *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                    value={formData.d1DatabaseId}
                    onChange={e => handleChange('d1DatabaseId', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Found in Workers & Pages &rarr; D1 &rarr; Select Database &rarr; Database ID.
                  </p>
                </div>

                {/* 3. API Token */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    3. Cloudflare API Token (with D1 Edit Permissions) *
                  </label>
                  <input
                    type="password"
                    placeholder="Cloudflare API Token with D1:Edit permission"
                    value={formData.d1ApiToken}
                    onChange={e => handleChange('d1ApiToken', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Create in Cloudflare Profile &rarr; API Tokens &rarr; Create Token &rarr; D1 Edit permission.
                  </p>
                </div>

                {/* Test Connection Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestD1Connection}
                    disabled={testStatus?.loading}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
                  >
                    {testStatus?.loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                        <span>Testing Connection & Initializing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 text-emerald-500" />
                        <span>Test Connection & Verify Tables</span>
                      </>
                    )}
                  </button>

                  {testStatus && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl flex items-center gap-2 ${
                        testStatus.success
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                      }`}
                    >
                      {testStatus.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      )}
                      <span>{testStatus.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMPANY & LOGO */}
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
