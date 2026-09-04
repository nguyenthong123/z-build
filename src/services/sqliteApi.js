/**
 * SQLite & n8n Service API for Zbuild
 * Connects directly to SQLite backend on VPS / Local, completely replacing Firestore
 */

// API Base URL (VPS n8n / SQLite backend with full CORS & SSL)
const API_BASE = import.meta.env.VITE_API_BASE || 'https://34-133-127-214.nip.io/api/zbuild';
const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_BASE || 'https://34-133-127-214.nip.io/webhook';

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
  const data = await fetchJson(`${API_BASE}/products${queryStr}`);
  return data.products || [];
}

export async function apiGetProduct(idOrSlug) {
  if (!idOrSlug) return null;
  const data = await fetchJson(`${API_BASE}/products/${encodeURIComponent(idOrSlug)}`);
  return data.product || null;
}

export async function apiSaveProduct(product) {
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
  return await fetchJson(`${API_BASE}/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE'
  });
}

export async function apiBatchDeleteProducts(productIds) {
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
  return await fetchJson(`${API_BASE}/orders`, {
    method: 'POST',
    body: JSON.stringify(orderData)
  });
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

export async function apiDunvexSyncProducts() {
  return await fetchJson(`${API_BASE}/sync/dunvex-products`, {
    method: 'POST'
  });
}

export async function apiDunvexSyncCustomers() {
  return await fetchJson(`${API_BASE}/sync/dunvex-customers`, {
    method: 'POST'
  });
}

export async function apiTriggerAiEnrich({ productId, title, specs, category, tavilyApiKey }) {
  return await fetchJson(`${API_BASE}/ai/enrich`, {
    method: 'POST',
    body: JSON.stringify({ productId, title, specs, category, tavilyApiKey })
  });
}

export async function apiTriggerAiBulkEnrich({ status = 'Draft', limit = 5, productIds = [], instructions = '', tavilyApiKey = '' } = {}) {
  return await fetchJson(`${API_BASE}/ai/bulk-enrich`, {
    method: 'POST',
    body: JSON.stringify({ status, limit, productIds, instructions, tavilyApiKey })
  });
}

