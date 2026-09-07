/**
 * SQLite & n8n Service API for Zbuild
 * Connects directly to SQLite backend on VPS / Local, completely replacing Firestore
 */

// API Base URL (VPS n8n / SQLite backend with full CORS & SSL)
const API_BASE = import.meta.env.VITE_API_BASE || 'https://34-133-127-214.nip.io/api/zbuild';
const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_BASE || 'https://34-133-127-214.nip.io/webhook';

// In-memory cache map & TTL (60s)
const apiCache = new Map();
const CACHE_TTL_MS = 60000;

function getCached(key) {
  const item = apiCache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL_MS) {
    apiCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  apiCache.set(key, { data, time: Date.now() });
}

export function clearApiCache(prefix = '') {
  if (!prefix) {
    apiCache.clear();
  } else {
    for (const key of apiCache.keys()) {
      if (key.startsWith(prefix)) apiCache.delete(key);
    }
  }
}

// Clear product cache on update events
if (typeof window !== 'undefined') {
  window.addEventListener('PRODUCTS_CHANGED', () => clearApiCache('product'));
  window.addEventListener('AI_PRODUCTS_UPDATED', () => clearApiCache('product'));
}

// Helper for HTTP requests
async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API Error ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`Fetch error at ${url}:`, err);
    throw err;
  }
}

// ==========================================
// 1. SẢN PHẨM (PRODUCTS)
// ==========================================

export async function apiGetProducts(params = {}) {
  const qs = new URLSearchParams();
  if (params.category && params.category !== 'All') qs.append('category', params.category);
  if (params.search) qs.append('search', params.search);
  if (params.status) qs.append('status', params.status);
  if (params.limit) qs.append('limit', params.limit);

  const queryStr = qs.toString() ? `?${qs.toString()}` : '';
  const cacheKey = `products_${queryStr}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(`${API_BASE}/products${queryStr}`);
  const result = data.products || [];
  setCached(cacheKey, result);
  return result;
}

export async function apiGetProduct(idOrSlug) {
  if (!idOrSlug) return null;
  const cacheKey = `product_${idOrSlug}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(`${API_BASE}/products/${encodeURIComponent(idOrSlug)}`);
  const result = data.product || null;
  if (result) setCached(cacheKey, result);
  return result;
}

export async function apiSaveProduct(product) {
  clearApiCache('product');
  if (product.id) {
    return await fetchJson(`${API_BASE}/products/${encodeURIComponent(product.id)}`, {
      method: 'PUT',
      body: JSON.stringify(product)
    });
  } else {
    return await fetchJson(`${API_BASE}/products`, {
      method: 'POST',
      body: JSON.stringify(product)
    });
  }
}

export async function apiDeleteProduct(productId) {
  clearApiCache('product');
  return await fetchJson(`${API_BASE}/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE'
  });
}

export async function apiBatchDeleteProducts(productIds) {
  clearApiCache('product');
  return await fetchJson(`${API_BASE}/products/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids: productIds })
  });
}

// ==========================================
// 2. KHÁCH HÀNG (CUSTOMERS)
// ==========================================

export async function apiGetCustomers() {
  const data = await fetchJson(`${API_BASE}/customers`);
  return data.customers || [];
}

export async function apiSaveCustomer(customer) {
  return await fetchJson(`${API_BASE}/customers`, {
    method: 'POST',
    body: JSON.stringify(customer)
  });
}

export async function apiDeleteCustomer(customerId) {
  return await fetchJson(`${API_BASE}/customers/${encodeURIComponent(customerId)}`, {
    method: 'DELETE'
  });
}

// ==========================================
// 3. ĐƠN HÀNG (ORDERS)
// ==========================================

export async function apiGetOrders(userId = null) {
  const queryStr = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const data = await fetchJson(`${API_BASE}/orders${queryStr}`);
  return data.orders || [];
}

export async function apiCreateOrder(orderData) {
  try {
    return await fetchJson(`${N8N_WEBHOOK_BASE}/zbuild-order`, {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  } catch {
    return await fetchJson(`${API_BASE}/orders`, {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }
}

export async function apiUpdateOrder(orderId, updateData) {
  return await fetchJson(`${API_BASE}/orders/${encodeURIComponent(orderId)}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  });
}

export async function apiDeleteOrder(orderId) {
  return await fetchJson(`${API_BASE}/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE'
  });
}

// ==========================================
// 4. CÀI ĐẶT (SETTINGS)
// ==========================================

export async function apiGetSettings(key = 'main') {
  try {
    const data = await fetchJson(`${API_BASE}/settings/${encodeURIComponent(key)}`);
    return data.value || {};
  } catch {
    return {};
  }
}

export async function apiSaveSettings(key, value) {
  return await fetchJson(`${API_BASE}/settings/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: JSON.stringify({ value })
  });
}

// ==========================================
// 5. ĐỒNG BỘ TỪ DUNVEX QUA SQLITE & n8n
// ==========================================

export async function apiDunvexSyncProducts(mode = 'sync_existing') {
  try {
    return await fetchJson(`${N8N_WEBHOOK_BASE}/zbuild-sync-products`, {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
  } catch {
    return await fetchJson(`${API_BASE}/sync/dunvex-products`, {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
  }
}

export async function apiDunvexSyncCustomers() {
  try {
    return await fetchJson(`${N8N_WEBHOOK_BASE}/zbuild-sync-customers`, {
      method: 'POST'
    });
  } catch {
    return await fetchJson(`${API_BASE}/sync/dunvex-customers`, {
      method: 'POST'
    });
  }
}

export async function apiTriggerAiEnrich({ productId, title, specs = '', category = '', instructions = '', productInfo = '', tavilyApiKey = '' } = {}) {
  try {
    return await fetchJson(`${N8N_WEBHOOK_BASE}/zbuild-ai-enrich`, {
      method: 'POST',
      body: JSON.stringify({ productId, title, specs, category, instructions, productInfo, tavilyApiKey })
    });
  } catch {
    return await fetchJson(`${API_BASE}/ai/enrich`, {
      method: 'POST',
      body: JSON.stringify({ productId, title, specs, category, instructions, productInfo, tavilyApiKey })
    });
  }
}

export async function apiTriggerAiBulkEnrich({ status = 'Draft', limit = 5, productIds = [], instructions = '', tavilyApiKey = '' } = {}) {
  try {
    return await fetchJson(`${N8N_WEBHOOK_BASE}/dong-bo-sp-ai`, {
      method: 'POST',
      body: JSON.stringify({ status, limit, productIds, instructions, tavilyApiKey })
    });
  } catch {
    return await fetchJson(`${API_BASE}/ai/bulk-enrich`, {
      method: 'POST',
      body: JSON.stringify({ status, limit, productIds, instructions, tavilyApiKey })
    });
  }
}

export async function apiSendAdminAiMessage({ message, history = [], productIds = [], instructions = '' } = {}) {
  try {
    return await fetchJson(`${N8N_WEBHOOK_BASE}/zbuild-admin-chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history, productIds, instructions })
    });
  } catch {
    return await fetchJson(`${API_BASE}/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history, productIds, instructions })
    });
  }
}

