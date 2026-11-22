import React, { useState, useEffect } from 'react';
import {
  X,
  Building,
  CreditCard,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Image,
  QrCode,
  ShieldCheck,
  FileSpreadsheet,
  Clock,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  LogOut,
  Layers
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
  appLockConfig = { enabled: false, pin: '', autoLockMinutes: 10 },
  onSaveAppLockConfig,
  onTriggerAppLock,
  currentUser,
  onLogout
}) {
  const [formData, setFormData] = useState({ ...settings });

  // Custom Redesigned Section Picker Popup State
  const [isSectionPickerOpen, setIsSectionPickerOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState('sec-company');

  const SECTIONS = [
    {
      id: 'sec-company',
      title: 'Company Profile & Logo',
      urdu: 'کمپنی تفصیل اور لوگو',
      desc: 'Shop name, currency, tagline, phone & invoice logo',
      icon: Building,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
    },
    {
      id: 'sec-payments',
      title: 'Payment Info & QR Code',
      urdu: 'بینک اور کیو آر کوڈ',
      desc: 'Bank accounts, IBAN, Raast ID, JazzCash & invoice QR',
      icon: CreditCard,
      color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800',
    },
    {
      id: 'sec-applock',
      title: 'App Lock & PIN Security',
      urdu: 'ایپ لاک اور پن کوڈ سیکیورٹی',
      desc: '4-digit security PIN, auto-lock policies & protection',
      icon: Lock,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
    },
    {
      id: 'sec-backup',
      title: 'Data Backup & Excel Export',
      urdu: 'بیک اپ اور ایکسل ایکسپورٹ',
      desc: 'Cloud D1 snapshots, Excel workbooks & JSON export',
      icon: Download,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
    },
  ];

  // App Lock Form State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPinCheck, setCurrentPinCheck] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [appLockMsg, setAppLockMsg] = useState({ type: '', text: '' });
  const [showPin, setShowPin] = useState(false);

  // App Lock Consent Verification (Required to disable App Lock)
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentVerificationType, setConsentVerificationType] = useState('pin'); // 'pin' or 'password'
  const [consentPin, setConsentPin] = useState('');
  const [consentPassword, setConsentPassword] = useState('');
  const [consentError, setConsentError] = useState('');
  const [isVerifyingConsent, setIsVerifyingConsent] = useState(false);

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
    if (isOpen) {
      setFormData({ ...settings });
      fetchCloudBackupInfo();
      setAppLockMsg({ type: '', text: '' });
      setIsChangingPin(false);
      setShowConsentModal(false);
    }
  }, [isOpen, settings]);

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

  const handleSave = () => {
    onSaveSettings(formData);
    onClose();
  };

  // Smooth scroll to a section on the same screen
  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

  // Verify Consent to Disable App Lock
  const handleVerifyConsentAndDisableAppLock = async (e) => {
    e.preventDefault();
    setConsentError('');

    if (consentVerificationType === 'pin') {
      if (!consentPin) {
        setConsentError('Please enter your current 4-digit PIN');
        return;
      }
      if (consentPin !== appLockConfig.pin) {
        setConsentError('Current PIN is incorrect');
        return;
      }
      // Verified with current PIN
      onSaveAppLockConfig({ enabled: false, pin: '', autoLockMinutes: 0 });
      setShowConsentModal(false);
      setConsentPin('');
      setConsentPassword('');
      setAppLockMsg({ type: 'success', text: 'App Lock has been successfully disabled' });
    } else {
      // Verify via Account Password
      if (!consentPassword) {
        setConsentError('Please enter your account password');
        return;
      }

      setIsVerifyingConsent(true);
      try {
        const res = await apiFetch('/api/admin/verify-admin-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: consentPassword,
            action: 'disable_app_lock'
          })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          onSaveAppLockConfig({ enabled: false, pin: '', autoLockMinutes: 0 });
          setShowConsentModal(false);
          setConsentPin('');
          setConsentPassword('');
          setAppLockMsg({ type: 'success', text: 'App Lock has been successfully disabled' });
        } else {
          setConsentError(data.error || 'Incorrect account password');
        }
      } catch (err) {
        setConsentError('Verification failed. Check network connection');
      } finally {
        setIsVerifyingConsent(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/75 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 md:rounded-3xl max-w-2xl w-full h-full md:h-auto md:max-h-[92vh] shadow-2xl border-0 md:border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col font-sans">
        {/* Top Status Bar Spacer & Crisp Divider Line (Separates Android status bar from app layout) */}
        <div className="w-full bg-slate-100 dark:bg-slate-950 border-b border-slate-300 dark:border-slate-800 h-10 sm:h-2 flex items-center justify-between px-3.5 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ALI Garments Settings</span>
          </div>
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="py-3 px-4 sm:px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-950/50 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600" />
              <span>Settings • ترتیبات</span>
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Made with ❤️ by{' '}
              <a
                href="https://www.chengdushuze.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                CHENGDU SHUZE INTERNATIONAL
              </a>
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

        {/* Quick-Jump Section Navigation (Custom Interactive Trigger Button - No OS Cursive Dialog) */}
        <div className="px-4 py-2.5 bg-slate-100/95 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 font-sans">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>Jump to:</span>
          </div>

          <button
            type="button"
            onClick={() => setIsSectionPickerOpen(true)}
            className="flex-1 max-w-sm flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
          >
            <span className="flex items-center gap-2 truncate font-sans">
              <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                {(() => {
                  const curr = SECTIONS.find(s => s.id === activeSectionId) || SECTIONS[0];
                  const Icon = curr.icon;
                  return <Icon className="w-3.5 h-3.5" />;
                })()}
              </span>
              <span className="truncate">
                {(SECTIONS.find(s => s.id === activeSectionId) || SECTIONS[0]).title}
              </span>
            </span>
            <ChevronDown className="w-4 h-4 text-emerald-600 shrink-0" />
          </button>
        </div>

        {/* Unified Scrollable Container: ALL 4 SECTIONS VISIBLE TOGETHER */}
        <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto pb-28 md:pb-8">
          
          {/* ========================================================= */}
          {/* SECTION 1: COMPANY PROFILE & LOGO                         */}
          {/* ========================================================= */}
          <section id="sec-company" className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Company Profile & Logo • کمپنی تفصیل
                </h4>
                <p className="text-[11px] text-slate-500">
                  Shop branding, phone numbers, and invoice header details
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Shop / Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.shopName || ''}
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
                    value={formData.currency || 'Rs.'}
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
                  value={formData.shopTagline || ''}
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
                    value={formData.phone1 || ''}
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
                    value={formData.phone2 || ''}
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
                  value={formData.address || ''}
                  onChange={e => handleChange('address', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Logo Upload & Preview */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Custom Logo (App & Invoices)
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
                      className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">PNG, JPG or SVG (Max 2MB)</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* SECTION 2: PAYMENT INFO & QR CODE                         */}
          {/* ========================================================= */}
          <section id="sec-payments" className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 border border-teal-200 dark:border-teal-800">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Payment Info & QR Code • بینک اور کیو آر
                </h4>
                <p className="text-[11px] text-slate-500">
                  Bank accounts, Raast ID, JazzCash and QR code on invoices
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Meezan Bank / HBL"
                    value={formData.bankName || ''}
                    onChange={e => handleChange('bankName', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Account Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ALI GARMENTS"
                    value={formData.accountTitle || ''}
                    onChange={e => handleChange('accountTitle', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Account Number / IBAN
                </label>
                <input
                  type="text"
                  placeholder="PK00MEZN0000000000000000"
                  value={formData.accountNumber || ''}
                  onChange={e => handleChange('accountNumber', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Raast ID
                  </label>
                  <input
                    type="text"
                    placeholder="03354311792"
                    value={formData.raastId || ''}
                    onChange={e => handleChange('raastId', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    JazzCash / EasyPaisa Number
                  </label>
                  <input
                    type="text"
                    placeholder="03354311792"
                    value={formData.jazzCash || ''}
                    onChange={e => handleChange('jazzCash', e.target.value)}
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
                      className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Raast / Bank / JazzCash QR code</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* SECTION 3: APP LOCK & PIN SECURITY                        */}
          {/* ========================================================= */}
          <section id="sec-applock" className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  App Lock & PIN Security • ایپ لاک سیکیورٹی
                </h4>
                <p className="text-[11px] text-slate-500">
                  PIN security lock for Android APK & browser protection
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
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
                      {appLockConfig.enabled ? 'App Lock is Active (محفوظ)' : 'App Lock is Disabled'}
                    </h4>
                    <p className="text-slate-500 text-[11px]">
                      {appLockConfig.enabled
                        ? 'Protected with 4-digit PIN on this device.'
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
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all active:scale-95 whitespace-nowrap cursor-pointer shadow-xs"
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
                          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isChangingPin && currentPinCheck !== appLockConfig.pin) {
                            setAppLockMsg({ type: 'error', text: 'Current PIN is incorrect' });
                            return;
                          }
                          if (newPin.length !== 4) {
                            setAppLockMsg({ type: 'error', text: 'PIN must be exactly 4 numeric digits' });
                            return;
                          }
                          if (newPin !== confirmPin) {
                            setAppLockMsg({ type: 'error', text: 'New PIN and Confirm PIN do not match' });
                            return;
                          }
                          const updated = {
                            enabled: true,
                            pin: newPin,
                            autoLockMinutes: typeof appLockConfig.autoLockMinutes === 'number' ? appLockConfig.autoLockMinutes : 10,
                          };
                          onSaveAppLockConfig(updated);
                          setIsChangingPin(false);
                          setNewPin('');
                          setConfirmPin('');
                          setCurrentPinCheck('');
                          setAppLockMsg({ type: 'success', text: 'App Lock PIN successfully saved and activated' });
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
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Auto-Lock Timeout When Leaving Tab
                    </label>
                    <select
                      value={typeof appLockConfig.autoLockMinutes === 'number' ? appLockConfig.autoLockMinutes : 10}
                      onChange={e => {
                        const updated = {
                          ...appLockConfig,
                          autoLockMinutes: Number(e.target.value),
                        };
                        onSaveAppLockConfig(updated);
                        setAppLockMsg({ type: 'success', text: 'Auto-lock policy updated' });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium"
                    >
                      <option value={10}>After 10 minutes away from tab (Standard / Recommended)</option>
                      <option value={5}>After 5 minutes away from tab</option>
                      <option value={15}>After 15 minutes away from tab</option>
                      <option value={30}>After 30 minutes away from tab</option>
                      <option value={0}>Immediately when leaving tab</option>
                    </select>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
                      Unlocked for unlimited time while you stay on this tab. If you switch tabs or leave for 10 minutes, you will be prompted for your PIN upon return.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPin(true);
                        setAppLockMsg({ type: '', text: '' });
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Change 4-Digit PIN
                    </button>

                    {/* Turn Off App Lock: Requires Consent Verification */}
                    <button
                      type="button"
                      onClick={() => {
                        setConsentError('');
                        setConsentPin('');
                        setConsentPassword('');
                        setConsentVerificationType('pin');
                        setShowConsentModal(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer transition-all active:scale-95"
                    >
                      Turn Off App Lock
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ========================================================= */}
          {/* SECTION 4: DATA BACKUP & EXPORT                           */}
          {/* ========================================================= */}
          <section id="sec-backup" className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200 dark:border-indigo-800">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Data Backup & Excel Export • بیک اپ اور ایکسل
                </h4>
                <p className="text-[11px] text-slate-500">
                  Cloud D1 snapshots, Excel spreadsheets and offline JSON backups
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
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
                        Tracks automated Cloud D1 snapshots & offline JSON exports
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
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex-shrink-0 cursor-pointer active:scale-95 transition-all"
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
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white flex-shrink-0 cursor-pointer active:scale-95 transition-all"
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
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300 cursor-pointer"
                />
              </div>
            </div>
          </section>

          {/* End-of-Settings Attribution (Made with ❤️ by CHENGDU SHUZE INTERNATIONAL) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/60 dark:to-slate-950/60 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              ALI Garments Accounting & Cloud Khata System
            </p>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Made with ❤️ by{' '}
              <a
                href="https://www.chengdushuze.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                CHENGDU SHUZE INTERNATIONAL
              </a>
            </p>
          </div>

          {/* End-of-Settings Logout Button */}
          {onLogout && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Logout of Account • لاگ آؤٹ</span>
              </button>
            </div>
          )}

        </div>

        {/* Modal Sticky Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
          >
            Save Settings & Changes
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONSENT MODAL: REQUIRED TO REMOVE / DISABLE APP LOCK      */}
      {/* ========================================================= */}
      {showConsentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-900">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Disable App Lock?
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Consent verification required
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              To remove App Lock protection, please verify your identity using your current App Lock PIN or account password.
            </p>

            {/* Toggle Verification Type */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setConsentVerificationType('pin');
                  setConsentError('');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  consentVerificationType === 'pin'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500'
                }`}
              >
                Use Current PIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setConsentVerificationType('password');
                  setConsentError('');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  consentVerificationType === 'password'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500'
                }`}
              >
                Use Account Password
              </button>
            </div>

            <form onSubmit={handleVerifyConsentAndDisableAppLock} className="space-y-3 pt-1">
              {consentVerificationType === 'pin' ? (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Enter Current 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    autoFocus
                    placeholder="••••"
                    value={consentPin}
                    onChange={e => setConsentPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono tracking-widest text-center text-xl font-bold"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Enter Account Password
                  </label>
                  <input
                    type="password"
                    autoFocus
                    placeholder="Account password"
                    value={consentPassword}
                    onChange={e => setConsentPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              )}

              {consentError && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{consentError}</span>
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConsentModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingConsent}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-rose-600/25 flex items-center justify-center gap-1.5"
                >
                  {isVerifyingConsent ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Confirm & Turn Off</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Redesigned Section Picker Modal (Replaces Android Native Cursive Select Dialog) */}
      {isSectionPickerOpen && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsSectionPickerOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in zoom-in-95 duration-200 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white font-sans">
                    Jump to Section • سیکشن منتخب کریں
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                    Choose a section to scroll directly
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSectionPickerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const isSelected = activeSectionId === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setActiveSectionId(sec.id);
                      setIsSectionPickerOpen(false);
                      scrollToSection(sec.id);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer font-sans active:scale-[0.99] ${
                      isSelected
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-xl border shrink-0 ${sec.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white font-sans">
                          {sec.title}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-sans mt-0.5">
                          {sec.urdu} • {sec.desc}
                        </p>
                      </div>
                    </div>

                    {/* Clean Sans-serif Radio Indicator */}
                    <div className="ml-3 shrink-0">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500'
                          : 'border-slate-300 dark:border-slate-600 bg-transparent'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSectionPickerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Close • بند کریں
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
