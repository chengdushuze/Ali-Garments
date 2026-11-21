import React, { useState, useEffect, useCallback } from 'react';
import SplashScreen from './components/SplashScreen';
import LoadingScreen from './components/LoadingScreen';
import LoginView from './components/LoginView';
import AdminPanelModal from './components/AdminPanelModal';
import UserItemsManager from './components/UserItemsManager';
import Navbar from './components/Navbar';
import DashboardStats from './components/DashboardStats';
import CustomerList from './components/CustomerList';
import CustomerDetail from './components/CustomerDetail';
import TransactionModal from './components/TransactionModal';
import AddCustomerModal from './components/AddCustomerModal';
import InvoiceBuilder from './components/InvoiceBuilder';
import SettingsModal from './components/SettingsModal';
import DeleteConsentModal from './components/DeleteConsentModal';
import RecycleBinModal from './components/RecycleBinModal';
import PhoneBottomNav from './components/PhoneBottomNav';
import AppLockScreen from './components/AppLockScreen';
import { apiFetch, clearStoredToken } from './services/apiClient';
import {
  getSettings,
  saveSettings,
  getCustomers,
  saveCustomers,
  getCustomerTransactions,
  saveCustomerTransactions,
  getSyncQueue,
  getRecycleBin,
  addToRecycleBin,
  removeFromRecycleBin,
  clearLocalRecycleBin,
  saveRecycleBin,
  getCachedAuthUser,
  setCachedAuthUser,
  clearCachedAuthUser,
  clearAllLocalDeviceData,
  getAppLockConfig,
  saveAppLockConfig
} from './services/storage';
import {
  syncCustomerToD1,
  processSyncQueue,
  pullAllFromD1,
  deleteCustomerFromD1,
  syncRecycleBinItemToD1,
  deleteRecycleBinItemFromD1,
  clearD1RecycleBin,
  pullRecycleBinFromD1
} from './services/d1Sync';
import { downloadAllDataExcel } from './services/excelService';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [settings, setSettings] = useState({});
  const [customers, setCustomers] = useState([]);
  const [transactionsMap, setTransactionsMap] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Check Closed Multi-User Authentication Status (Offline-First for APK & Mobile)
  useEffect(() => {
    async function verifyAuth() {
      const cached = await getCachedAuthUser();
      const isNative = typeof window !== 'undefined' && (
        window.Capacitor?.isNativePlatform?.() ||
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'file:'
      );

      // If offline on startup, restore verified cached session without network error
      if (!navigator.onLine) {
        if (cached) {
          setCurrentUser(cached);
        } else {
          setCurrentUser(null);
        }
        setIsAuthChecking(false);
        return;
      }

      try {
        const res = await apiFetch('/api/me');
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.user) {
          setCurrentUser(data.user);
          await setCachedAuthUser(data.user);
        } else {
          // If 401 Unauthorized but running offline/native with cached account
          if (cached && isNative) {
            setCurrentUser(cached);
          } else {
            setCurrentUser(null);
            clearStoredToken();
            await clearCachedAuthUser();
          }
        }
      } catch (err) {
        // Network unreachable (offline)
        console.warn('Network unreachable, loading cached offline profile:', err);
        if (cached) {
          setCurrentUser(cached);
        } else {
          setCurrentUser(null);
        }
      } finally {
        setIsAuthChecking(false);
      }
    }
    verifyAuth();
  }, []);

  // App Lock State (for Android APK and mobile devices)
  const [appLockConfig, setAppLockConfig] = useState(() => getAppLockConfig());
  const [isAppLocked, setIsAppLocked] = useState(() => {
    const c = getAppLockConfig();
    return Boolean(c && c.enabled && c.pin);
  });

  const handleSaveAppLockConfig = (newConfig) => {
    setAppLockConfig(newConfig);
    saveAppLockConfig(newConfig);
  };

  // Auto-lock when user backgrounds or leaves the app on mobile APK
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const config = getAppLockConfig();
        if (config?.enabled && config?.pin) {
          sessionStorage.setItem('ag_app_background_time', String(Date.now()));
        }
      } else if (document.visibilityState === 'visible') {
        const config = getAppLockConfig();
        if (config?.enabled && config?.pin) {
          const bgTime = Number(sessionStorage.getItem('ag_app_background_time') || 0);
          const lockTimeoutMs = (config.autoLockMinutes || 0) * 60 * 1000;
          if (Date.now() - bgTime >= lockTimeoutMs) {
            setIsAppLocked(true);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Real-time Active Session Watcher: Kicks out suspended users immediately & syncs role changes
  useEffect(() => {
    if (!currentUser || currentUser.role === 'super_admin') return;

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch('/api/me');
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 || data.isSuspended) {
          await handleLogout();
        } else if (res.ok && data.user) {
          if (data.user.role !== currentUser.role) {
            setCurrentUser(data.user);
            await setCachedAuthUser(data.user);
          }
        }
      } catch (e) {}
    }, 10000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Complete Local Device Wipe upon Logout (removes all cached business & personal data)
  const handleLogout = async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    clearStoredToken();
    await clearAllLocalDeviceData();
    setCurrentUser(null);
    setCustomers([]);
    setTransactionsMap({});
    setRecycleBinItems([]);
    setInvoices([]);
    setSelectedCustomer(null);
    setIsAdminPanelOpen(false);
    setIsRecycleBinOpen(false);
    setIsSettingsOpen(false);
  };

  // Sync state
  const [syncState, setSyncState] = useState({
    isConfigured: false,
    isSyncing: false,
    pendingCount: 0,
    isQuotaExceeded: false,
    isOffline: false,
    lastSyncTime: null
  });

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState('give');
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState(null);
  const [invoiceTxIds, setInvoiceTxIds] = useState([]);
  const [mobileTab, setMobileTab] = useState('parties'); // 'parties' or 'stats' for Phone Menu

  // Recycle Bin & Consent state
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [recycleBinItems, setRecycleBinItems] = useState([]);
  const [deleteConsent, setDeleteConsent] = useState({
    isOpen: false,
    title: '',
    itemName: '',
    itemType: 'transaction',
    details: '',
    isPermanent: false,
    onConfirm: () => {}
  });

  // Load Initial Data from Cache
  useEffect(() => {
    async function loadData() {
      const savedSettings = await getSettings();
      setSettings(savedSettings);

      // Set initial theme
      const currentTheme = savedSettings.theme || 'light';
      setTheme(currentTheme);
      if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      let loadedCustomers = await getCustomers();
      const txMap = {};

      // Seed all 132 customer ledgers if empty or demo data
      if (!loadedCustomers || loadedCustomers.length < 10) {
        const { default: seedCustomers } = await import('./data/seedData.json');
        if (seedCustomers && seedCustomers.length > 0) {
          loadedCustomers = seedCustomers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '0335-4311792',
            address: c.address || 'Cloth Market, Faisalabad',
            category: c.category || 'wholesale',
            balance: c.balance || 0,
            totalTransactions: c.totalTransactions || c.transactions?.length || 0,
            lastTransactionAt: c.lastTransactionAt,
            createdAt: c.createdAt
          }));
          await saveCustomers(loadedCustomers);

          for (const c of seedCustomers) {
            await saveCustomerTransactions(c.id, c.transactions || []);
            txMap[c.id] = c.transactions || [];
          }
        }
      } else {
        for (const c of loadedCustomers) {
          txMap[c.id] = await getCustomerTransactions(c.id);
        }
      }

      setCustomers(loadedCustomers);
      setTransactionsMap(txMap);
      if (loadedCustomers.length > 0) {
        setSelectedCustomer(loadedCustomers[0]);
      }

      // Load Recycle Bin (auto-purges expired >30 days)
      let initialBin = await getRecycleBin();
      setRecycleBinItems(initialBin);

      // Check D1 setup
      const isD1Configured = Boolean(
        savedSettings.d1AccountId && savedSettings.d1DatabaseId && savedSettings.d1ApiToken
      );

      // Pull latest Recycle Bin items from D1 across devices
      if (isD1Configured) {
        pullRecycleBinFromD1(savedSettings).then(async (d1BinRes) => {
          if (d1BinRes && d1BinRes.success && d1BinRes.items) {
            // Merge with local
            const idMap = new Map();
            for (const item of d1BinRes.items) idMap.set(item.id, item);
            for (const item of initialBin) {
              if (!idMap.has(item.id)) idMap.set(item.id, item);
            }
            const merged = Array.from(idMap.values());
            setRecycleBinItems(merged);
            await saveRecycleBin(merged);
          }
        });
      }
      const queue = await getSyncQueue();
      setSyncState({
        isConfigured: isD1Configured,
        isSyncing: false,
        pendingCount: queue.length,
        isQuotaExceeded: false,
        isOffline: !navigator.onLine,
        lastSyncTime: null
      });
    }

    loadData();
  }, []);

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    const updated = { ...settings, theme: nextTheme };
    setSettings(updated);
    saveSettings(updated);

    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Sync Now trigger (flushes offline sync_queue to Cloudflare D1)
  const handleSyncNow = useCallback(async () => {
    setSyncState(prev => ({ ...prev, isSyncing: true }));
    try {
      const res = await processSyncQueue();

      // Pull from D1 if available
      const pullRes = await pullAllFromD1();
      if (pullRes && pullRes.success && pullRes.customers && pullRes.customers.length > 0) {
        setCustomers(pullRes.customers);
        setTransactionsMap(pullRes.transactionsMap);
        await saveCustomers(pullRes.customers);
        for (const [cId, txs] of Object.entries(pullRes.transactionsMap)) {
          await saveCustomerTransactions(cId, txs);
        }
      }

      // Pull and sync Recycle Bin from D1 across devices
      const d1BinRes = await pullRecycleBinFromD1();
      if (d1BinRes && d1BinRes.success && d1BinRes.items) {
        setRecycleBinItems(d1BinRes.items);
        await saveRecycleBin(d1BinRes.items);
      }

      const queue = await getSyncQueue();

      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        pendingCount: queue.length,
        isOffline: !navigator.onLine,
        isQuotaExceeded: Boolean(res?.isQuotaExceeded),
        lastSyncTime: new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error during D1 sync:', err);
      const queue = await getSyncQueue();
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        pendingCount: queue.length,
        isOffline: !navigator.onLine
      }));
    }
  }, []);

  // Automatic Internet Connection Listener:
  // When device reconnects to internet, immediately send all offline changes to Cloudflare D1!
  useEffect(() => {
    const onOnline = () => {
      console.log('⚡ [Connection Restored] Device reconnected to internet! Auto-syncing offline changes to D1...');
      setSyncState(prev => ({ ...prev, isOffline: false }));
      handleSyncNow();
    };

    const onOffline = () => {
      console.log('🔌 [Connection Lost] Device is offline. Operating in high-speed local cache mode.');
      setSyncState(prev => ({ ...prev, isOffline: true }));
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Periodic Background Sync: checks every 30 seconds if online and there are pending changes
    const periodicTimer = setInterval(async () => {
      if (navigator.onLine) {
        const queue = await getSyncQueue();
        if (queue && queue.length > 0) {
          console.log(`🔄 [Auto-Sync] Found ${queue.length} pending offline items. Flushing to D1...`);
          handleSyncNow();
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(periodicTimer);
    };
  }, [handleSyncNow]);

  // Save Settings
  const handleSaveSettings = async (newSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
    const isConfigured = Boolean(
      newSettings.d1AccountId && newSettings.d1DatabaseId && newSettings.d1ApiToken
    );
    setSyncState(prev => ({ ...prev, isConfigured }));
  };

  // Add Customer
  const handleAddCustomer = async (custData) => {
    const newId = `cust_${Date.now()}`;
    const newCustomer = {
      id: newId,
      name: custData.name,
      phone: custData.phone,
      address: custData.address,
      category: custData.category,
      balance: custData.balance || 0,
      lastTransactionAt: custData.openingBalance ? new Date().toISOString() : null,
      createdAt: new Date().toISOString()
    };

    let initialTxs = [];
    if (custData.openingBalance && custData.openingBalance > 0) {
      initialTxs = [
        {
          id: `tx_${Date.now()}`,
          type: custData.balanceType || 'give',
          amount: custData.openingBalance,
          dateTime: new Date().toISOString(),
          description: 'Opening Balance (ابتدائی بقایا)',
          billNumber: 'INIT',
          paymentMethod: 'Adjustment',
          balanceAfter: custData.balance
        }
      ];
    }

    const updatedCustomers = [newCustomer, ...customers];
    const updatedTxMap = { ...transactionsMap, [newId]: initialTxs };

    setCustomers(updatedCustomers);
    setTransactionsMap(updatedTxMap);
    setSelectedCustomer(newCustomer);

    // Save locally
    await saveCustomers(updatedCustomers);
    await saveCustomerTransactions(newId, initialTxs);

    // Sync to D1
    syncCustomerToD1(newCustomer, initialTxs).then(res => {
      if (res && res.isQuotaExceeded) {
        setSyncState(prev => ({ ...prev, isQuotaExceeded: true, pendingCount: prev.pendingCount + 1 }));
      }
    });
  };

  // Add Transaction
  const handleSaveTransaction = async (txData) => {
    const customer = customers.find(c => c.id === txData.customerId);
    if (!customer) return;

    const currentTxs = transactionsMap[customer.id] || [];
    const currentBalance = Number(customer.balance || 0);
    const delta = txData.type === 'give' ? txData.amount : -txData.amount;
    const newBalance = currentBalance + delta;

    const newTx = {
      id: `tx_${Date.now()}`,
      type: txData.type,
      amount: txData.amount,
      dateTime: txData.dateTime || new Date().toISOString(),
      description: txData.description,
      billNumber: txData.billNumber,
      paymentMethod: txData.paymentMethod,
      notes: txData.notes,
      balanceAfter: newBalance
    };

    const updatedTxs = [newTx, ...currentTxs];
    const updatedCustomer = {
      ...customer,
      balance: newBalance,
      lastTransactionAt: newTx.dateTime
    };

    const updatedCustomers = customers.map(c => (c.id === customer.id ? updatedCustomer : c));
    const updatedTxMap = { ...transactionsMap, [customer.id]: updatedTxs };

    // Update state immediately (Zero latency)
    setCustomers(updatedCustomers);
    setTransactionsMap(updatedTxMap);
    setSelectedCustomer(updatedCustomer);

    // Save locally to IndexedDB cache
    await saveCustomers(updatedCustomers);
    await saveCustomerTransactions(customer.id, updatedTxs);

    // Sync to Cloudflare D1
    syncCustomerToD1(updatedCustomer, updatedTxs).then(res => {
      if (res && res.isQuotaExceeded) {
        setSyncState(prev => ({ ...prev, isQuotaExceeded: true, pendingCount: prev.pendingCount + 1 }));
      }
    });
  };

  // -------------------------------------------------------------
  // RECYCLE BIN & DELETION CONSENT LOGIC (30-DAY AUTO RETENTION)
  // -------------------------------------------------------------

  // 1. Transaction Deletion Consent Prompt
  const handleRequestDeleteTransaction = (customer, tx) => {
    setDeleteConsent({
      isOpen: true,
      title: 'Move Transaction to Recycle Bin?',
      itemName: `${tx.type === 'give' ? 'Debit (You Gave)' : 'Credit (You Got)'}: ${settings.currency || 'Rs.'} ${Number(tx.amount || 0).toLocaleString()}`,
      itemType: 'transaction',
      details: `${tx.description || 'Ledger Entry'} • Party: ${customer.name}`,
      isPermanent: false,
      onConfirm: () => executeDeleteTransaction(customer.id, tx.id)
    });
  };

  // Execute Move Transaction to Recycle Bin
  const executeDeleteTransaction = async (customerId, txId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const currentTxs = transactionsMap[customerId] || [];
    const targetTx = currentTxs.find(t => t.id === txId);
    if (!targetTx) return;

    const delta = targetTx.type === 'give' ? -Number(targetTx.amount || 0) : Number(targetTx.amount || 0);
    const newBalance = Number(customer.balance || 0) + delta;

    const updatedTxs = currentTxs.filter(t => t.id !== txId);
    const updatedCustomer = {
      ...customer,
      balance: newBalance,
      totalTransactions: updatedTxs.length
    };

    const updatedCustomers = customers.map(c => (c.id === customer.id ? updatedCustomer : c));
    const updatedTxMap = { ...transactionsMap, [customerId]: updatedTxs };

    setCustomers(updatedCustomers);
    setTransactionsMap(updatedTxMap);
    setSelectedCustomer(updatedCustomer);

    await saveCustomers(updatedCustomers);
    await saveCustomerTransactions(customerId, updatedTxs);

    // Save to local Recycle Bin (30-day auto expiration)
    const binItem = await addToRecycleBin({
      type: 'transaction',
      customerId: customer.id,
      customerName: customer.name,
      title: `${targetTx.type === 'give' ? 'Debit' : 'Credit'} ${settings.currency || 'Rs.'} ${Number(targetTx.amount || 0).toLocaleString()} - ${targetTx.description || 'Transaction'}`,
      data: {
        tx: targetTx,
        customerSnapshot: { id: customer.id, name: customer.name }
      }
    });

    if (binItem) {
      setRecycleBinItems(prev => [binItem, ...prev.filter(i => i.id !== binItem.id)]);
      // Sync to D1 Recycle Bin & auto-purge expired across devices
      syncRecycleBinItemToD1(binItem);
    }

    // Sync updated customer single row chunk to D1
    syncCustomerToD1(updatedCustomer, updatedTxs);
  };

  // 2. Customer Deletion Consent Prompt
  const handleRequestDeleteCustomer = (customer) => {
    const custTxs = transactionsMap[customer.id] || [];
    setDeleteConsent({
      isOpen: true,
      title: 'Move Party to Recycle Bin?',
      itemName: customer.name,
      itemType: 'customer',
      details: `Balance: ${settings.currency || 'Rs.'} ${Number(customer.balance || 0).toLocaleString()} • ${custTxs.length} Transactions`,
      isPermanent: false,
      onConfirm: () => executeDeleteCustomer(customer.id)
    });
  };

  // Execute Move Customer to Recycle Bin
  const executeDeleteCustomer = async (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const customerTxs = transactionsMap[customerId] || [];

    // Remove from active state
    const updatedCustomers = customers.filter(c => c.id !== customerId);
    const updatedTxMap = { ...transactionsMap };
    delete updatedTxMap[customerId];

    setCustomers(updatedCustomers);
    setTransactionsMap(updatedTxMap);
    if (selectedCustomer?.id === customerId) {
      setSelectedCustomer(updatedCustomers.length > 0 ? updatedCustomers[0] : null);
    }

    await saveCustomers(updatedCustomers);

    // Save to local Recycle Bin (30-day auto expiration)
    const binItem = await addToRecycleBin({
      type: 'customer',
      customerId: customer.id,
      customerName: customer.name,
      title: `Party: ${customer.name} (${customerTxs.length} entries, Bal: ${settings.currency || 'Rs.'} ${Number(customer.balance || 0).toLocaleString()})`,
      data: {
        customer,
        transactions: customerTxs
      }
    });

    if (binItem) {
      setRecycleBinItems(prev => [binItem, ...prev.filter(i => i.id !== binItem.id)]);
      syncRecycleBinItemToD1(binItem);
    }

    // Remove customer & chunk from D1
    deleteCustomerFromD1(customerId);
  };

  // 3. Restore Item from Recycle Bin
  const handleRestoreRecycleBinItem = async (binItem) => {
    if (!binItem) return;

    if (binItem.type === 'customer') {
      const restoredCust = binItem.data.customer;
      const restoredTxs = binItem.data.transactions || [];

      const updatedCustomers = [restoredCust, ...customers.filter(c => c.id !== restoredCust.id)];
      const updatedTxMap = { ...transactionsMap, [restoredCust.id]: restoredTxs };

      setCustomers(updatedCustomers);
      setTransactionsMap(updatedTxMap);
      setSelectedCustomer(restoredCust);

      await saveCustomers(updatedCustomers);
      await saveCustomerTransactions(restoredCust.id, restoredTxs);

      // Re-sync customer and chunk to D1
      syncCustomerToD1(restoredCust, restoredTxs);

      // Remove from Recycle Bin
      await removeFromRecycleBin(binItem.id);
      deleteRecycleBinItemFromD1(binItem.id);
      setRecycleBinItems(prev => prev.filter(i => i.id !== binItem.id));
    } else if (binItem.type === 'transaction') {
      const restoredTx = binItem.data.tx;
      const custId = binItem.customerId || binItem.data.customerSnapshot?.id;
      const customer = customers.find(c => c.id === custId);

      if (customer) {
        const currentTxs = transactionsMap[custId] || [];
        const delta = restoredTx.type === 'give' ? Number(restoredTx.amount || 0) : -Number(restoredTx.amount || 0);
        const newBalance = Number(customer.balance || 0) + delta;

        const updatedTxs = [restoredTx, ...currentTxs];
        const updatedCust = {
          ...customer,
          balance: newBalance,
          totalTransactions: updatedTxs.length
        };

        const updatedCustomers = customers.map(c => (c.id === custId ? updatedCust : c));
        const updatedTxMap = { ...transactionsMap, [custId]: updatedTxs };

        setCustomers(updatedCustomers);
        setTransactionsMap(updatedTxMap);
        if (selectedCustomer?.id === custId) {
          setSelectedCustomer(updatedCust);
        }

        await saveCustomers(updatedCustomers);
        await saveCustomerTransactions(custId, updatedTxs);

        syncCustomerToD1(updatedCust, updatedTxs);

        await removeFromRecycleBin(binItem.id);
        deleteRecycleBinItemFromD1(binItem.id);
        setRecycleBinItems(prev => prev.filter(i => i.id !== binItem.id));
      }
    }
  };

  // 4. Permanent Delete from Recycle Bin
  const handlePermanentDeleteFromBin = async (binId) => {
    await removeFromRecycleBin(binId);
    deleteRecycleBinItemFromD1(binId);
    setRecycleBinItems(prev => prev.filter(i => i.id !== binId));
  };

  // 5. Empty Entire Recycle Bin
  const handleEmptyRecycleBin = async () => {
    await clearLocalRecycleBin();
    clearD1RecycleBin();
    setRecycleBinItems([]);
  };

  // 6. Refresh Recycle Bin from D1 (auto-purging expired >30 days)
  const handleRefreshRecycleBin = async () => {
    const res = await pullRecycleBinFromD1();
    if (res && res.success && res.items) {
      setRecycleBinItems(res.items);
      await saveRecycleBin(res.items);
    }
  };

  // Open Invoice Builder
  const handleOpenInvoiceForCustomer = (cust, txIds = []) => {
    setInvoiceCustomer(cust);
    setInvoiceTxIds(txIds);
    setIsInvoiceOpen(true);
  };

  // Download All Data Excel
  const handleDownloadAllExcel = () => {
    downloadAllDataExcel(customers, transactionsMap, settings);
  };

  // If verifying authentication session, show custom loading screen
  if (isAuthChecking) {
    return <LoadingScreen message="Verifying Cloudflare Edge Session..." />;
  }

  // If not authenticated, show closed-portal Login Page (Mobile-first, No public signup)
  if (!currentUser) {
    return <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Splash Screen */}
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      {/* Header Navigation */}
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNewCustomer={() => setIsNewCustomerOpen(true)}
        onOpenInvoiceBuilder={() => {
          setInvoiceCustomer(selectedCustomer || customers[0]);
          setInvoiceTxIds([]);
          setIsInvoiceOpen(true);
        }}
        onOpenRecycleBin={() => setIsRecycleBinOpen(true)}
        recycleBinCount={recycleBinItems.length}
        onDownloadAllExcel={handleDownloadAllExcel}
        syncState={syncState}
        onSyncNow={handleSyncNow}
        settings={settings}
        currentUser={currentUser}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        onLogout={handleLogout}
      />

      {/* Offline Mode Banner */}
      {syncState.isOffline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center justify-center gap-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span>⚡ Offline Mode Active • Changes saved locally and will auto-sync to Cloudflare D1 when connected.</span>
          {syncState.pendingCount > 0 && (
            <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {syncState.pendingCount} pending
            </span>
          )}
        </div>
      )}

      {/* Main Content Area (Responsive on all screen sizes, overflow-x-hidden, padding-bottom for Phone Menu) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 pb-24 md:pb-8 overflow-x-hidden">
        {/* On Desktop: Always show stats. On Mobile/Phone: Show stats when Analytics tab active */}
        <div className={`transition-all duration-300 ${mobileTab === 'stats' ? 'block' : 'hidden md:block'}`}>
          <DashboardStats
            customers={customers}
            transactionsMap={transactionsMap}
            currency={settings.currency || 'Rs.'}
            onOpenNewCustomer={() => setIsNewCustomerOpen(true)}
            onDownloadAllExcel={handleDownloadAllExcel}
          />
        </div>

        {/* Master-Detail Ledger Grid (Phone: CustomerList or CustomerDetail depending on selection; Desktop: side-by-side) */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start ${mobileTab === 'stats' ? 'hidden md:grid' : 'grid'}`}>
          {/* Left Column: Customer Directory (4 cols on lg, full on mobile if no detail view) */}
          <div className={`lg:col-span-5 h-[580px] sm:h-[620px] lg:h-[calc(100vh-270px)] lg:min-h-[600px] ${selectedCustomer ? 'hidden lg:block' : 'block'}`}>
            <CustomerList
              customers={customers}
              onSelectCustomer={cust => setSelectedCustomer(cust)}
              selectedCustomerId={selectedCustomer?.id}
              onOpenNewCustomer={() => setIsNewCustomerOpen(true)}
              currency={settings.currency || 'Rs.'}
            />
          </div>

          {/* Right Column: Customer Ledger Details & Transactions (7 cols on lg) */}
          <div className={`lg:col-span-7 h-[580px] sm:h-[620px] lg:h-[calc(100vh-270px)] lg:min-h-[600px] ${selectedCustomer ? 'block' : 'hidden lg:block'}`}>
            {selectedCustomer ? (
              <CustomerDetail
                customer={selectedCustomer}
                transactions={transactionsMap[selectedCustomer.id] || []}
                onBack={() => setSelectedCustomer(null)}
                onOpenAddTransaction={(cust, type) => {
                  setSelectedCustomer(cust);
                  setTxModalType(type);
                  setIsTxModalOpen(true);
                }}
                onOpenInvoiceForCustomer={handleOpenInvoiceForCustomer}
                onRequestDeleteTransaction={handleRequestDeleteTransaction}
                onRequestDeleteCustomer={handleRequestDeleteCustomer}
                settings={settings}
                currency={settings.currency || 'Rs.'}
              />
            ) : (
              <div className="h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-serif text-2xl font-bold">
                  AG
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Select a Party to View Ledger
                </h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Pick any customer or supplier from the list to view all timestamped transactions, download custom XLS, or send WhatsApp reminders.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Note */}
      <footer className="no-print py-4 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          ALI Garments Khata • Made With ❤️ By <strong>Chengdu Shuze International</strong>
        </p>
      </footer>

      {/* MODALS */}
      {/* 1. Transaction Modal (You Gave / You Got) */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        customer={selectedCustomer}
        initialType={txModalType}
        onSave={handleSaveTransaction}
        currency={settings.currency || 'Rs.'}
      />

      {/* 2. Add Customer Modal */}
      <AddCustomerModal
        isOpen={isNewCustomerOpen}
        onClose={() => setIsNewCustomerOpen(false)}
        onSave={handleAddCustomer}
        currency={settings.currency || 'Rs.'}
      />

      {/* 3. Invoice Builder Modal */}
      <InvoiceBuilder
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        customer={invoiceCustomer}
        customers={customers}
        selectedTxIds={invoiceTxIds}
        transactionsMap={transactionsMap}
        settings={settings}
        onInvoiceCreated={inv => {
          console.log('Invoice created:', inv);
        }}
        currency={settings.currency || 'Rs.'}
      />

      {/* 4. Settings Modal (D1 Database, Company, Logo, QR, Backup, App Lock) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onDownloadAllExcel={handleDownloadAllExcel}
        customers={customers}
        transactionsMap={transactionsMap}
        appLockConfig={appLockConfig}
        onSaveAppLockConfig={handleSaveAppLockConfig}
        onTriggerAppLock={() => setIsAppLocked(true)}
      />

      {/* 5. Recycle Bin Modal (30-Day Auto Retention & Multi-Device Sync) */}
      <RecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        items={recycleBinItems}
        onRestore={handleRestoreRecycleBinItem}
        onPermanentDelete={handlePermanentDeleteFromBin}
        onEmptyBin={handleEmptyRecycleBin}
        onRefreshFromD1={handleRefreshRecycleBin}
        currentUser={currentUser}
        currency={settings.currency || 'Rs.'}
      />

      {/* 6. Universal Delete Consent Modal */}
      <DeleteConsentModal
        isOpen={deleteConsent.isOpen}
        onClose={() => setDeleteConsent(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConsent.onConfirm}
        title={deleteConsent.title}
        itemName={deleteConsent.itemName}
        itemType={deleteConsent.itemType}
        details={deleteConsent.details}
        isPermanent={deleteConsent.isPermanent}
      />

      {/* 7. Admin User Management & Audit Modal */}
      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        currentUser={currentUser}
      />

      {/* 8. Phone & Android Bottom Navigation Menu */}
      <PhoneBottomNav
        activeTab={mobileTab}
        onSelectTab={(tab) => setMobileTab(tab)}
        onOpenInvoice={() => {
          setInvoiceCustomer(selectedCustomer || customers[0]);
          setInvoiceTxIds([]);
          setIsInvoiceOpen(true);
        }}
        onOpenExcel={handleDownloadAllExcel}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'super_admin'}
        isSuperAdmin={currentUser?.role === 'super_admin'}
        selectedCustomer={selectedCustomer}
        onBackToParties={() => {
          setSelectedCustomer(null);
          setMobileTab('parties');
        }}
      />

      {/* 9. Secure App Lock Overlay (Mobile APK & Browser Protection) */}
      <AppLockScreen
        isLocked={isAppLocked}
        onUnlock={() => {
          setIsAppLocked(false);
          sessionStorage.removeItem('ag_app_background_time');
        }}
        configuredPin={appLockConfig.pin}
        currentUser={currentUser}
      />
    </div>
  );
}
