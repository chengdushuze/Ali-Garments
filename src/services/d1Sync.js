import { getSettings, getSyncQueue, clearSyncQueue, addToSyncQueue } from './storage';

const MAX_CHUNK_BYTES = 1800000; // ~1.8 MB safety threshold for 2MB SQLite limit

/**
 * Executes a query against Cloudflare D1 via Vercel serverless proxy or direct endpoint
 */
export async function executeD1Query(sql, params = [], customSettings = null) {
  const settings = customSettings || (await getSettings());

  const accountId = settings.d1AccountId?.trim();
  const databaseId = settings.d1DatabaseId?.trim();
  const apiToken = settings.d1ApiToken?.trim();

  // If credentials are not configured, treat as local-only mode
  if (!accountId || !databaseId || !apiToken) {
    return {
      success: false,
      isConfigured: false,
      message: 'Cloudflare D1 is not configured. Running in high-speed local cache mode.'
    };
  }

  const directCfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const isNative = typeof window !== 'undefined' && (
    window.Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'file:' ||
    window.location.protocol === 'capacitor:' ||
    window.location.hostname === 'localhost' && !window.location.port.includes('3000')
  );

  let response;
  try {
    if (isNative) {
      // Direct Cloudflare API call in native mobile environment
      response = await fetch(directCfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params })
      });
    } else {
      // Try Vercel Serverless proxy first
      const endpoint = settings.d1ProxyUrl || '/api/d1';
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cf-account-id': accountId,
          'x-cf-database-id': databaseId,
          'x-cf-api-token': apiToken
        },
        body: JSON.stringify({ sql, params })
      });

      // If proxy returned 404 (e.g. static preview or local dev without serverless), fallback to direct
      if (response.status === 404 || response.status === 405) {
        response = await fetch(directCfUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql, params })
        });
      }
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
    // Network offline or failed fetch
    return {
      success: false,
      isOffline: true,
      error: error.message,
      message: 'Network offline or server unreachable. Changes preserved in local memory.'
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
export async function syncCustomerToD1(customer, transactions) {
  const settings = await getSettings();
  if (!settings.d1AccountId || !settings.d1DatabaseId || !settings.d1ApiToken) {
    // Just local cache
    return { success: true, localOnly: true };
  }

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
      // If quota exceeded or offline, queue it!
      await addToSyncQueue({ type: 'sync_customer', customer, transactions });
      return custRes;
    }

    // Upsert the chunk row(s)
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
        await addToSyncQueue({ type: 'sync_customer', customer, transactions });
        return chunkRes;
      }
    }

    return {
      success: true,
      message: `Successfully saved to Cloudflare D1 (${chunks.length} row used, ${Math.round(byteSize / 1024)} KB)`
    };
  } catch (err) {
    console.error('Error syncing customer to D1:', err);
    await addToSyncQueue({ type: 'sync_customer', customer, transactions });
    return { success: false, error: err.message, message: 'Saved locally; sync queued.' };
  }
}

/**
 * Invoices are created and kept strictly in local storage (browser/app)
 * to save Cloudflare D1 query and write limits/credits.
 */
export async function syncInvoiceToD1(invoice) {
  // Intentionally local-only to save D1 write limits & credits as requested.
  return { success: true, localOnly: true, message: 'Invoice saved locally in app (Zero D1 credits used)' };
}

/**
 * Pulls all customers and their 1-row transaction chunks from Cloudflare D1
 * using only 2 high-efficiency queries (minimizes D1 credits/quota usage).
 */
export async function pullAllFromD1(customSettings = null) {
  const settings = customSettings || (await getSettings());
  if (!settings.d1AccountId || !settings.d1DatabaseId || !settings.d1ApiToken) {
    return { success: false, message: 'D1 credentials not configured.' };
  }

  try {
    const res = await executeD1Query(`
      SELECT customer_id, name, phone, address, category, balance, current_chunk, total_transactions, created_at, updated_at FROM customers ORDER BY name ASC;
      SELECT customer_id, chunk_index, transactions_json, byte_size, count, updated_at FROM customer_chunks;
    `, [], settings);

    if (!res.success || !res.data) {
      return res;
    }

    const custRows = res.data[0]?.results || [];
    const chunkRows = res.data[1]?.results || [];

    const chunksByCust = {};
    for (const chunk of chunkRows) {
      if (!chunksByCust[chunk.customer_id]) {
        chunksByCust[chunk.customer_id] = [];
      }
      chunksByCust[chunk.customer_id].push(chunk);
    }

    const customers = [];
    const transactionsMap = {};

    for (const row of custRows) {
      const custChunks = chunksByCust[row.customer_id] || [];
      custChunks.sort((a, b) => a.chunk_index - b.chunk_index);

      let allTxs = [];
      for (const c of custChunks) {
        try {
          const parsed = JSON.parse(c.transactions_json || '[]');
          allTxs = allTxs.concat(parsed);
        } catch (e) {
          console.error('Error parsing chunk txs for ' + row.customer_id, e);
        }
      }

      const customerObj = {
        id: row.customer_id,
        name: row.name,
        phone: row.phone,
        address: row.address,
        category: row.category,
        balance: row.balance,
        totalTransactions: row.total_transactions,
        createdAt: row.created_at,
        lastTransactionAt: row.updated_at
      };

      customers.push(customerObj);
      transactionsMap[row.customer_id] = allTxs;
    }

    return {
      success: true,
      customers,
      transactionsMap,
      message: `Successfully loaded ${customers.length} customer ledgers from D1`
    };
  } catch (err) {
    console.error('Error pulling from D1:', err);
    return { success: false, error: err.message };
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

  let successCount = 0;
  const remaining = [];

  for (const item of queue) {
    let res = null;
    if (item.type === 'sync_customer') {
      res = await syncCustomerToD1(item.customer, item.transactions);
    }

    if (res && res.success) {
      successCount++;
    } else {
      if (item.type !== 'sync_invoice') {
        remaining.push(item);
      }
      if (res && res.isQuotaExceeded) {
        // Quota still exceeded, stop queue processing for now
        break;
      }
    }
  }

  if (remaining.length === 0) {
    await clearSyncQueue();
  }

  return {
    success: true,
    processedCount: successCount,
    remainingCount: remaining.length
  };
}

/**
 * Removes a customer and their chunk row from Cloudflare D1
 */
export async function deleteCustomerFromD1(customerId) {
  const settings = await getSettings();
  if (!settings.d1AccountId || !settings.d1DatabaseId || !settings.d1ApiToken) {
    return { success: true, localOnly: true };
  }

  const sql = `
    DELETE FROM customer_chunks WHERE customer_id = ?;
    DELETE FROM customers WHERE customer_id = ?;
  `;
  return await executeD1Query(sql, [customerId, customerId]);
}

/**
 * Syncs a deleted item to Cloudflare D1 Recycle Bin with 30-day auto-purge
 */
export async function syncRecycleBinItemToD1(binItem) {
  const settings = await getSettings();
  if (!settings.d1AccountId || !settings.d1DatabaseId || !settings.d1ApiToken) {
    return { success: true, localOnly: true };
  }

  // 1. Insert into recycle_bin
  // 2. Automatically purge any items older than 30 days across all devices
  const sql = `
    DELETE FROM recycle_bin WHERE expires_at <= CURRENT_TIMESTAMP;
    INSERT INTO recycle_bin (bin_id, item_type, customer_id, title, item_json, deleted_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bin_id) DO UPDATE SET
      item_json = excluded.item_json,
      expires_at = excluded.expires_at;
  `;

  return await executeD1Query(sql, [
    binItem.id,
    binItem.type,
    binItem.customerId || null,
    binItem.title,
    JSON.stringify(binItem.data || {}),
    binItem.deletedAt,
    binItem.expiresAt
  ]);
}

/**
 * Removes an item from D1 Recycle Bin (upon restore or permanent purge)
 */
export async function deleteRecycleBinItemFromD1(binId) {
  const settings = await getSettings();
  if (!settings.d1AccountId || !settings.d1DatabaseId || !settings.d1ApiToken) {
    return { success: true, localOnly: true };
  }

  const sql = `
    DELETE FROM recycle_bin WHERE bin_id = ?;
    DELETE FROM recycle_bin WHERE expires_at <= CURRENT_TIMESTAMP;
  `;
  return await executeD1Query(sql, [binId]);
}

/**
 * Empties all items from D1 Recycle Bin
 */
export async function clearD1RecycleBin() {
  const settings = await getSettings();
  if (!settings.d1AccountId || !settings.d1DatabaseId || !settings.d1ApiToken) {
    return { success: true, localOnly: true };
  }

  return await executeD1Query('DELETE FROM recycle_bin;');
}

/**
 * Pulls all valid Recycle Bin items from D1 and automatically purges items older than 30 days
 */
export async function pullRecycleBinFromD1(customSettings = null) {
  const settings = customSettings || (await getSettings());
  if (!settings.d1AccountId || !settings.d1DatabaseId || !settings.d1ApiToken) {
    return { success: false, message: 'D1 not configured' };
  }

  try {
    // Purge expired items (> 30 days old) and select remaining active items
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
