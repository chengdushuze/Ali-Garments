import { getSettings, getSyncQueue, clearSyncQueue, addToSyncQueue } from './storage';
import { apiFetch, getStoredToken } from './apiClient';

const MAX_CHUNK_BYTES = 1800000; // ~1.8 MB safety threshold for 2MB SQLite limit

/**
 * Executes a query against Cloudflare D1 via Cloudflare Pages Function proxy (/api/d1) or direct REST endpoint
 */
export async function executeD1Query(sql, params = [], customSettings = null) {
  const settings = customSettings || (await getSettings());

  // Check if browser/device is offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: false,
      isOffline: true,
      message: 'Device is offline. Changes saved in high-speed local memory.'
    };
  }

  const endpoint = settings.d1ProxyUrl || '/api/d1';
  const accountId = settings.d1AccountId?.trim();
  const databaseId = settings.d1DatabaseId?.trim();
  const apiToken = settings.d1ApiToken?.trim();

  try {
    // 1. Try Cloudflare Pages /api/d1 endpoint (Native env.DB binding)
    const headers = { 'Content-Type': 'application/json' };
    const authToken = getStoredToken();
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (accountId) headers['x-cf-account-id'] = accountId;
    if (databaseId) headers['x-cf-database-id'] = databaseId;
    if (apiToken) headers['x-cf-api-token'] = apiToken;

    let response = await apiFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql, params })
    }).catch(err => {
      console.warn('Proxy fetch failed, attempting fallback...', err);
      return null;
    });

    // 2. Direct Cloudflare REST fallback if proxy fails and direct credentials are provided
    if ((!response || response.status === 404 || response.status === 405 || !response.ok) && accountId && databaseId && apiToken) {
      const directCfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
      response = await fetch(directCfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params })
      }).catch(() => null);
    }

    if (!response) {
      return {
        success: false,
        isOffline: true,
        message: 'Network offline or server unreachable. Saved in local cache.'
      };
    }

    const data = await response.json().catch(() => ({}));

    if (response.status === 429 || data.isQuotaExceeded || (data.error && /quota|limit/i.test(data.error))) {
      return {
        success: false,
        isQuotaExceeded: true,
        status: response.status,
        message: 'Cloudflare D1 daily quota limit reached. Data safely kept in local cache; auto-sync when limit resets.'
      };
    }

    if (!response.ok || !data.success) {
      return {
        success: false,
        status: response.status,
        error: data.error || response.statusText,
        message: `D1 Error: ${data.error || response.statusText}`
      };
    }

    return {
      success: true,
      data: data.result || data
    };
  } catch (error) {
    return {
      success: false,
      isOffline: true,
      error: error.message,
      message: 'Network offline. Changes preserved in local memory.'
    };
  }
}

/**
 * Initializes Cloudflare D1 tables if not present
 */
export async function initD1Tables(customSettings = null) {
  const initSql = `
    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      category TEXT DEFAULT 'customer',
      balance REAL DEFAULT 0.0,
      current_chunk INTEGER DEFAULT 0,
      total_transactions INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_chunks (
      customer_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      transactions_json TEXT NOT NULL DEFAULT '[]',
      byte_size INTEGER DEFAULT 0,
      count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (customer_id, chunk_index)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recycle_bin (
      bin_id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      customer_id TEXT,
      title TEXT NOT NULL,
      item_json TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recycle_expires ON recycle_bin(expires_at);
  `;

  return await executeD1Query(initSql, [], customSettings);
}

/**
 * Smart single-row chunking:
 * Encodes all customer transactions into 1 single D1 row until approaching ~1.8MB,
 * then gracefully creates chunk_index 1, 2, etc.
 * Conserves D1 daily query/write limits!
 */
export async function syncCustomerToD1(customer, transactions, bypassQueue = false) {
  try {
    const now = new Date().toISOString();
    const jsonStr = JSON.stringify(transactions || []);
    const byteSize = new Blob([jsonStr]).size;

    // Check if it fits in 1 row (under 1.8MB)
    let chunks = [];
    if (byteSize <= MAX_CHUNK_BYTES) {
      chunks.push({
        index: 0,
        data: jsonStr,
        byteSize,
        count: (transactions || []).length
      });
    } else {
      // Chunking into ~1.8MB segments
      const txList = [...(transactions || [])];
      let currentChunkList = [];
      let currentBytes = 0;
      let chunkIdx = 0;

      for (const tx of txList) {
        const itemStr = JSON.stringify(tx);
        const itemBytes = new Blob([itemStr]).size;
        if (currentBytes + itemBytes > MAX_CHUNK_BYTES && currentChunkList.length > 0) {
          chunks.push({
            index: chunkIdx,
            data: JSON.stringify(currentChunkList),
            byteSize: currentBytes,
            count: currentChunkList.length
          });
          chunkIdx++;
          currentChunkList = [];
          currentBytes = 0;
        }
        currentChunkList.push(tx);
        currentBytes += itemBytes;
      }

      if (currentChunkList.length > 0) {
        chunks.push({
          index: chunkIdx,
          data: JSON.stringify(currentChunkList),
          byteSize: currentBytes,
          count: currentChunkList.length
        });
      }
    }

    // Upsert customer summary row
    const customerSql = `
      INSERT INTO customers (customer_id, name, phone, address, category, balance, current_chunk, total_transactions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(customer_id) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        address = excluded.address,
        category = excluded.category,
        balance = excluded.balance,
        current_chunk = excluded.current_chunk,
        total_transactions = excluded.total_transactions,
        updated_at = excluded.updated_at;
    `;

    const custRes = await executeD1Query(customerSql, [
      customer.id,
      customer.name,
      customer.phone || '',
      customer.address || '',
      customer.category || 'customer',
      Number(customer.balance || 0),
      chunks.length - 1,
      Number(customer.totalTransactions || transactions.length || 0),
      customer.createdAt || now,
      now
    ]);

    if (!custRes.success) {
      if (!bypassQueue) {
        await addToSyncQueue({ type: 'sync_customer', customer, transactions });
      }
      return custRes;
    }

    // Upsert chunk rows
    for (const chunk of chunks) {
      const chunkSql = `
        INSERT INTO customer_chunks (customer_id, chunk_index, transactions_json, byte_size, count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(customer_id, chunk_index) DO UPDATE SET
          transactions_json = excluded.transactions_json,
          byte_size = excluded.byte_size,
          count = excluded.count,
          updated_at = excluded.updated_at;
      `;

      const chunkRes = await executeD1Query(chunkSql, [
        customer.id,
        chunk.index,
        chunk.data,
        chunk.byteSize,
        chunk.count,
        now
      ]);

      if (!chunkRes.success) {
        if (!bypassQueue) {
          await addToSyncQueue({ type: 'sync_customer', customer, transactions });
        }
        return chunkRes;
      }
    }

    return {
      success: true,
      message: `Successfully saved to Cloudflare D1 (${chunks.length} row used, ${Math.round(byteSize / 1024)} KB)`
    };
  } catch (err) {
    console.error('Error syncing customer to D1:', err);
    if (!bypassQueue) {
      await addToSyncQueue({ type: 'sync_customer', customer, transactions });
    }
    return { success: false, error: err.message, message: 'Saved locally; sync queued.' };
  }
}

/**
 * Invoices are created and kept strictly in local storage
 */
export async function syncInvoiceToD1(invoice) {
  return { success: true, localOnly: true, message: 'Invoice saved locally in app' };
}

/**
 * Safe parser for customer rows and transaction chunks
 */
function parseCustomerRowsAndChunks(custRows, chunkRows) {
  const chunksByCust = {};
  for (const chunk of chunkRows || []) {
    if (!chunk || !chunk.customer_id) continue;
    if (!chunksByCust[chunk.customer_id]) {
      chunksByCust[chunk.customer_id] = [];
    }
    chunksByCust[chunk.customer_id].push(chunk);
  }

  const customers = [];
  const transactionsMap = {};

  for (const row of custRows || []) {
    if (!row || !row.customer_id) continue;
    const custId = String(row.customer_id);
    const custChunks = chunksByCust[custId] || [];
    custChunks.sort((a, b) => Number(a.chunk_index || 0) - Number(b.chunk_index || 0));

    let allTxs = [];
    for (const c of custChunks) {
      try {
        const rawJson = c.transactions_json;
        const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson || '[]') : (rawJson || []);
        if (Array.isArray(parsed)) {
          for (const tx of parsed) {
            if (!tx) continue;
            allTxs.push({
              id: tx.id || `tx_${Math.random().toString(36).substring(2, 9)}`,
              amount: Number(tx.amount || 0),
              type: tx.type === 'get' ? 'get' : 'give',
              description: String(tx.description || ''),
              billNumber: String(tx.billNumber || ''),
              paymentMethod: String(tx.paymentMethod || 'cash'),
              date: tx.date || tx.dateTime || new Date().toISOString(),
              dateTime: tx.dateTime || tx.date || new Date().toISOString(),
            });
          }
        }
      } catch (e) {
        console.error('Error parsing chunk txs for ' + custId, e);
      }
    }

    const customerObj = {
      id: custId,
      name: String(row.name || 'Unnamed Party').trim(),
      phone: String(row.phone || '').trim(),
      address: String(row.address || '').trim(),
      category: String(row.category || 'customer').trim(),
      balance: Number(row.balance || 0),
      totalTransactions: Number(row.total_transactions || allTxs.length || 0),
      createdAt: row.created_at || new Date().toISOString(),
      lastTransactionAt: row.updated_at || row.created_at || new Date().toISOString()
    };

    customers.push(customerObj);
    transactionsMap[custId] = allTxs;
  }

  return {
    success: true,
    customers,
    transactionsMap,
    message: `Successfully loaded ${customers.length} customer ledgers from D1`
  };
}

/**
 * Pulls all customers and chunks from D1
 */
export async function pullAllFromD1(customSettings = null) {
  const settings = customSettings || (await getSettings());

  try {
    // 1. Fetch customer directory
    const custRes = await executeD1Query(
      'SELECT customer_id, name, phone, address, category, balance, current_chunk, total_transactions, created_at, updated_at FROM customers ORDER BY name ASC;',
      [],
      settings
    );

    // 2. Fetch all transaction chunks
    const chunkRes = await executeD1Query(
      'SELECT customer_id, chunk_index, transactions_json, byte_size, count, updated_at FROM customer_chunks;',
      [],
      settings
    );

    let custRows = custRes.data?.[0]?.results || custRes.data?.results || (Array.isArray(custRes.data) ? custRes.data : []);
    let chunkRows = chunkRes.data?.[0]?.results || chunkRes.data?.results || (Array.isArray(chunkRes.data) ? chunkRes.data : []);

    // Fallback: If separate queries didn't yield results, attempt combined multi-statement batch
    if ((!Array.isArray(custRows) || custRows.length === 0) && custRes.error) {
      const batchRes = await executeD1Query(`
        SELECT customer_id, name, phone, address, category, balance, current_chunk, total_transactions, created_at, updated_at FROM customers ORDER BY name ASC;
        SELECT customer_id, chunk_index, transactions_json, byte_size, count, updated_at FROM customer_chunks;
      `, [], settings);

      if (batchRes && batchRes.success && Array.isArray(batchRes.data)) {
        custRows = batchRes.data[0]?.results || [];
        chunkRows = batchRes.data[1]?.results || [];
      }
    }

    return parseCustomerRowsAndChunks(custRows, chunkRows);
  } catch (err) {
    console.error('Error pulling from D1:', err);
    return { success: false, error: err.message, customers: [], transactionsMap: {} };
  }
}

/**
 * Flushes all pending changes in the sync queue to Cloudflare D1
 */
export async function processSyncQueue() {
  const queue = await getSyncQueue();
  if (!queue || queue.length === 0) {
    return { success: true, processedCount: 0 };
  }

  console.log(`[SyncEngine] Processing ${queue.length} pending offline items...`);
  let successCount = 0;
  const remaining = [];

  for (const item of queue) {
    let res = null;
    if (item.type === 'sync_customer') {
      res = await syncCustomerToD1(item.customer, item.transactions, true);
    } else if (item.type === 'delete_customer') {
      res = await deleteCustomerFromD1(item.customerId, true);
    } else if (item.type === 'sync_recycle_bin') {
      res = await syncRecycleBinItemToD1(item.binItem, true);
    } else if (item.type === 'delete_recycle_bin') {
      res = await deleteRecycleBinItemFromD1(item.binId, true);
    }

    if (res && res.success) {
      successCount++;
    } else {
      remaining.push(item);
      if (res && res.isQuotaExceeded) {
        break;
      }
    }
  }

  // Update remaining queue
  await clearSyncQueue();
  for (const r of remaining) {
    await addToSyncQueue(r);
  }
  const queueRemaining = remaining.length;

  console.log(`[SyncEngine] Flushed ${successCount} items to D1. Remaining in offline queue: ${queueRemaining}`);

  return {
    success: true,
    processedCount: successCount,
    remainingCount: queueRemaining
  };
}

/**
 * Removes a customer and their chunk row from Cloudflare D1
 */
export async function deleteCustomerFromD1(customerId, bypassQueue = false) {
  const sql = `
    DELETE FROM customer_chunks WHERE customer_id = ?;
    DELETE FROM customers WHERE customer_id = ?;
  `;
  const res = await executeD1Query(sql, [customerId, customerId]);
  if (!res.success && !bypassQueue) {
    await addToSyncQueue({ type: 'delete_customer', customerId });
  }
  return res;
}

/**
 * Syncs a deleted item to Cloudflare D1 Recycle Bin with 30-day auto-purge
 */
export async function syncRecycleBinItemToD1(binItem, bypassQueue = false) {
  const sql = `
    DELETE FROM recycle_bin WHERE expires_at <= CURRENT_TIMESTAMP;
    INSERT INTO recycle_bin (bin_id, item_type, customer_id, title, item_json, deleted_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bin_id) DO UPDATE SET
      item_json = excluded.item_json,
      expires_at = excluded.expires_at;
  `;

  const res = await executeD1Query(sql, [
    binItem.id,
    binItem.type,
    binItem.customerId || null,
    binItem.title,
    JSON.stringify(binItem.data || {}),
    binItem.deletedAt,
    binItem.expiresAt
  ]);

  if (!res.success && !bypassQueue) {
    await addToSyncQueue({ type: 'sync_recycle_bin', binItem });
  }
  return res;
}

/**
 * Removes an item from D1 Recycle Bin (upon restore or permanent purge)
 */
export async function deleteRecycleBinItemFromD1(binId, bypassQueue = false) {
  const sql = `
    DELETE FROM recycle_bin WHERE bin_id = ?;
    DELETE FROM recycle_bin WHERE expires_at <= CURRENT_TIMESTAMP;
  `;
  const res = await executeD1Query(sql, [binId]);
  if (!res.success && !bypassQueue) {
    await addToSyncQueue({ type: 'delete_recycle_bin', binId });
  }
  return res;
}

/**
 * Empties all items from D1 Recycle Bin
 */
export async function clearD1RecycleBin() {
  return await executeD1Query('DELETE FROM recycle_bin;');
}

/**
 * Pulls all valid Recycle Bin items from D1 and automatically purges items older than 30 days
 */
export async function pullRecycleBinFromD1(customSettings = null) {
  const settings = customSettings || (await getSettings());

  try {
    const sql = `
      DELETE FROM recycle_bin WHERE expires_at <= CURRENT_TIMESTAMP;
      SELECT bin_id, item_type, customer_id, title, item_json, deleted_at, expires_at FROM recycle_bin ORDER BY deleted_at DESC;
    `;
    const res = await executeD1Query(sql, [], settings);

    if (!res.success || !res.data) {
      return res;
    }

    const selectResult = res.data[1]?.results || res.data[0]?.results || [];
    const items = selectResult.map(row => {
      let data = {};
      try {
        data = JSON.parse(row.item_json || '{}');
      } catch (e) {}

      return {
        id: row.bin_id,
        type: row.item_type,
        customerId: row.customer_id,
        customerName: data.customerName || data.name || '',
        title: row.title,
        data,
        deletedAt: row.deleted_at,
        expiresAt: row.expires_at
      };
    });

    return {
      success: true,
      items
    };
  } catch (err) {
    console.error('Error pulling recycle bin from D1:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Synchronizes store settings to Cloudflare D1
 */
export async function syncSettingsToD1(settings, customSettings = null) {
  try {
    const s = settings || (await getSettings());
    const now = new Date().toISOString();
    const safeSettings = { ...s };
    delete safeSettings.d1ApiToken; // Do not leak API token into database value
    const sql = `
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at;
    `;
    return await executeD1Query(sql, ['app_settings', JSON.stringify(safeSettings), now], customSettings);
  } catch (err) {
    console.error('Error syncing settings to D1:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Ensures all user unsaved data (offline sync queue, modified customers, pending transactions, settings)
 * are thoroughly synchronized to Cloudflare D1 before user logout.
 */
export async function saveUserUnsavedDataBeforeLogout(customers = [], transactionsMap = {}, pendingCustomerIds = []) {
  const result = {
    flushedCount: 0,
    customersSaved: 0,
    remainingUnsaved: 0,
    isOffline: false,
    error: null
  };

  try {
    // 1. If device is offline, detect immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const q = await getSyncQueue();
      result.isOffline = true;
      result.remainingUnsaved = (q?.length || 0) + (pendingCustomerIds?.length || 0);
      return result;
    }

    // 2. Sync pending customer changes if any customer ID was specifically queued or modified
    if (Array.isArray(pendingCustomerIds) && pendingCustomerIds.length > 0) {
      for (const custId of pendingCustomerIds) {
        const cust = customers.find(c => c.id === custId);
        if (cust) {
          const txs = transactionsMap[custId] || [];
          const res = await syncCustomerToD1(cust, txs, false);
          if (res?.success) {
            result.customersSaved++;
          }
        }
      }
    }

    // 3. Process the entire offline sync queue to D1
    const queueRes = await processSyncQueue();
    result.flushedCount = queueRes?.processedCount || 0;

    // 4. Backup current store settings to D1
    const settings = await getSettings();
    if (settings) {
      await syncSettingsToD1(settings).catch(() => {});
    }

    // 5. Final check of remaining queue items
    const remaining = await getSyncQueue();
    result.remainingUnsaved = remaining?.length || 0;
    return result;
  } catch (err) {
    console.error('[SyncEngine] Error saving unsaved data before logout:', err);
    result.error = err.message;
    const remaining = await getSyncQueue();
    result.remainingUnsaved = remaining?.length || 0;
    return result;
  }
}
