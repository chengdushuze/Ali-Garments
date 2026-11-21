import localforage from 'localforage';

// Configure localforage for IndexedDB caching
localforage.config({
  name: 'ALIGarmentsKhata',
  storeName: 'khata_cache',
  description: 'Local cache for ALI Garments Khata & Ledger app'
});

const DEFAULT_SETTINGS = {
  shopName: 'ALI Garments',
  shopTagline: 'Wholesale & Retail Premium Quality Fabrics & Garments',
  phone1: '+92 300 1234567',
  phone2: '+92 321 7654321',
  address: 'Shop # 14-16, Cloth Market, Faisalabad, Pakistan',
  ntn: 'NTN-786014-9',
  currency: 'Rs.',
  logoUrl: '', // Base64 or URL
  d1ProxyUrl: '/api/d1',
  bankName: 'Meezan Bank Limited',
  accountTitle: 'ALI GARMENTS',
  accountNumber: '02010108923456',
  iban: 'PK12MEZN0002010108923456',
  jazzCash: '0300-1234567',
  easyPaisa: '0321-7654321',
  qrCodeUrl: '',
  theme: 'light',
  terms: '1. Sold goods are not returnable without bill.\n2. Payment terms 15 days net.\n3. In case of dispute, Faisalabad jurisdiction applies.'
};

export async function getSettings() {
  try {
    const saved = await localforage.getItem('app_settings');
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  } catch (e) {
    console.error('Error reading settings from cache:', e);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings) {
  try {
    await localforage.setItem('app_settings', settings);
    return true;
  } catch (e) {
    console.error('Error saving settings to cache:', e);
    return false;
  }
}

export async function getCustomers() {
  try {
    const list = await localforage.getItem('customers');
    return list || [];
  } catch (e) {
    console.error('Error reading customers cache:', e);
    return [];
  }
}

export async function saveCustomers(customers) {
  try {
    await localforage.setItem('customers', customers);
    return true;
  } catch (e) {
    console.error('Error saving customers cache:', e);
    return false;
  }
}

export async function getCustomerTransactions(customerId) {
  try {
    const txs = await localforage.getItem(`txs_${customerId}`);
    return txs || [];
  } catch (e) {
    console.error(`Error reading transactions for ${customerId}:`, e);
    return [];
  }
}

export async function saveCustomerTransactions(customerId, transactions) {
  try {
    await localforage.setItem(`txs_${customerId}`, transactions);
    return true;
  } catch (e) {
    console.error(`Error saving transactions for ${customerId}:`, e);
    return false;
  }
}

export async function getInvoices() {
  try {
    const list = await localforage.getItem('invoices');
    return list || [];
  } catch (e) {
    return [];
  }
}

export async function saveInvoice(invoice) {
  try {
    const invoices = (await getInvoices()) || [];
    const updated = [invoice, ...invoices.filter(i => i.id !== invoice.id)];
    await localforage.setItem('invoices', updated);
    return updated;
  } catch (e) {
    console.error('Error saving invoice:', e);
    return [];
  }
}

export async function deleteInvoice(invoiceId) {
  try {
    const invoices = (await getInvoices()) || [];
    const updated = invoices.filter(i => i.id !== invoiceId);
    await localforage.setItem('invoices', updated);
    return updated;
  } catch (e) {
    console.error('Error deleting invoice:', e);
    return [];
  }
}

// ===============================================================
// Recycle Bin (30-Day Auto Expiration)
// ===============================================================

export async function getRecycleBin() {
  try {
    const list = await localforage.getItem('recycle_bin');
    if (!list || !Array.isArray(list)) return [];

    const now = new Date().getTime();
    // Filter items still within the 30-day window
    const valid = list.filter(item => {
      const exp = new Date(item.expiresAt).getTime();
      return exp > now;
    });

    if (valid.length !== list.length) {
      // Auto-purge expired items from storage
      await localforage.setItem('recycle_bin', valid);
    }
    return valid;
  } catch (e) {
    console.error('Error reading recycle bin cache:', e);
    return [];
  }
}

export async function saveRecycleBin(items) {
  try {
    await localforage.setItem('recycle_bin', items);
    return true;
  } catch (e) {
    console.error('Error saving recycle bin cache:', e);
    return false;
  }
}

export async function addToRecycleBin(item) {
  try {
    const current = await getRecycleBin();
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const binItem = {
      id: item.id || `rb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: item.type || 'transaction', // 'customer' | 'transaction' | 'invoice'
      customerId: item.customerId || null,
      customerName: item.customerName || '',
      title: item.title || 'Deleted Item',
      data: item.data || {},
      deletedAt: item.deletedAt || now.toISOString(),
      expiresAt: item.expiresAt || expires.toISOString()
    };

    const updated = [binItem, ...current.filter(i => i.id !== binItem.id)];
    await localforage.setItem('recycle_bin', updated);
    return binItem;
  } catch (e) {
    console.error('Error adding item to recycle bin:', e);
    return null;
  }
}

export async function removeFromRecycleBin(binId) {
  try {
    const current = await getRecycleBin();
    const updated = current.filter(i => i.id !== binId);
    await localforage.setItem('recycle_bin', updated);
    return updated;
  } catch (e) {
    console.error('Error removing item from recycle bin:', e);
    return [];
  }
}

export async function clearLocalRecycleBin() {
  try {
    await localforage.setItem('recycle_bin', []);
    return true;
  } catch (e) {
    return false;
  }
}

export async function getSyncQueue() {
  try {
    const queue = await localforage.getItem('sync_queue');
    return queue || [];
  } catch (e) {
    return [];
  }
}

export async function addToSyncQueue(item) {
  try {
    const queue = (await getSyncQueue()) || [];
    queue.push({
      ...item,
      queuedAt: new Date().toISOString()
    });
    await localforage.setItem('sync_queue', queue);
    return queue;
  } catch (e) {
    console.error('Error adding to sync queue:', e);
    return [];
  }
}

export async function clearSyncQueue() {
  try {
    await localforage.setItem('sync_queue', []);
    return true;
  } catch (e) {
    return false;
  }
}

export async function getFullBackupData() {
  const settings = await getSettings();
  const customers = await getCustomers();
  const invoices = await getInvoices();
  const transactionsMap = {};

  for (const c of customers) {
    transactionsMap[c.id] = await getCustomerTransactions(c.id);
  }

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    appName: 'ALI Garments Khata',
    settings,
    customers,
    invoices,
    transactions: transactionsMap
  };
}

export async function restoreFullBackupData(backupData) {
  if (!backupData || !backupData.customers) {
    throw new Error('Invalid backup file format');
  }

  if (backupData.settings) await saveSettings(backupData.settings);
  if (backupData.customers) await saveCustomers(backupData.customers);
  if (backupData.invoices) await localforage.setItem('invoices', backupData.invoices);
  if (backupData.transactions) {
    for (const [custId, txs] of Object.entries(backupData.transactions)) {
      await saveCustomerTransactions(custId, txs);
    }
  }
  return true;
}


const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000; // 5 days security login lifespan

export async function getCachedAuthUser() {
  try {
    const user = await localforage.getItem('cached_auth_user');
    if (!user) return null;

    // Strict 5-day session expiry enforcement
    const loginTime = user.cachedAt || user.loginTime || 0;
    if (loginTime > 0 && Date.now() - loginTime > FIVE_DAYS_MS) {
      console.warn('Session expired after 5 days. Forcing re-login for security.');
      await clearCachedAuthUser();
      return null;
    }

    return user;
  } catch (e) {
    return null;
  }
}

export async function setCachedAuthUser(user) {
  try {
    const userWithTimestamp = {
      ...user,
      cachedAt: Date.now(),
      loginTime: Date.now(),
    };
    await localforage.setItem('cached_auth_user', userWithTimestamp);
    return true;
  } catch (e) {
    return false;
  }
}

export async function clearCachedAuthUser() {
  try {
    await localforage.removeItem('cached_auth_user');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Completely purges all cached business and personal data from the local device
 * upon user logout or session termination, preventing unauthorized device access.
 */
export async function clearAllLocalDeviceData() {
  try {
    await localforage.clear();
  } catch (e) {
    console.error('Error clearing IndexedDB / localforage:', e);
  }

  try {
    // Preserve only app lock settings if user wants PIN preserved across logins,
    // or clear everything if strict mode:
    const appLockSettings = localStorage.getItem('ag_app_lock_config');
    localStorage.clear();
    sessionStorage.clear();
    if (appLockSettings) {
      localStorage.setItem('ag_app_lock_config', appLockSettings);
    }
  } catch (e) {
    console.error('Error clearing localStorage/sessionStorage:', e);
  }

  return true;
}

// App Lock settings
export function getAppLockConfig() {
  try {
    const raw = localStorage.getItem('ag_app_lock_config');
    if (!raw) return { enabled: false, pin: '', autoLockMinutes: 0 };
    return JSON.parse(raw);
  } catch (e) {
    return { enabled: false, pin: '', autoLockMinutes: 0 };
  }
}

export function saveAppLockConfig(config) {
  try {
    localStorage.setItem('ag_app_lock_config', JSON.stringify(config));
    return true;
  } catch (e) {
    return false;
  }
}
