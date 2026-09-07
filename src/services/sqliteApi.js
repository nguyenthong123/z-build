/**
 * SQLite & n8n Service API for Zbuild
 * Connects directly to SQLite backend on VPS / Local, completely replacing Firestore
 */

// API Base URL (VPS n8n / SQLite backend on new VPS 34.169.201.51 with full CORS & SSL)
const API_BASE = import.meta.env.VITE_API_BASE || 'https://hon-entertaining-meeting-peter.trycloudflare.com/api/zbuild';
const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_BASE || 'https://rob-gerald-decorating-javascript.trycloudflare.com/webhook';

// In-memory + localStorage persistent cache (5 minutes TTL)
const apiCache = new Map();
const CACHE_TTL_MS = 300000;

function getCached(key) {
  const item = apiCache.get(key);
  if (item && (Date.now() - item.time < CACHE_TTL_MS)) {
    return item.data;
  }
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(`zbuild_cache_${key}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (Date.now() - parsed.time < CACHE_TTL_MS) && parsed.data) {
          apiCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {}
  }
  return null;
}

function setCached(key, data) {
  const item = { data, time: Date.now() };
  apiCache.set(key, item);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`zbuild_cache_${key}`, JSON.stringify(item));
    } catch {}
  }
}

export function clearApiCache(prefix = '') {
  if (!prefix) {
    apiCache.clear();
    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('zbuild_cache_')) localStorage.removeItem(k);
        });
      } catch {}
    }
  } else {
    for (const key of apiCache.keys()) {
      if (key.startsWith(prefix)) apiCache.delete(key);
    }
    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith(`zbuild_cache_${prefix}`)) localStorage.removeItem(k);
        });
      } catch {}
    }
  }
}

// Clear product cache on update events
if (typeof window !== 'undefined') {
  window.addEventListener('PRODUCTS_CHANGED', () => clearApiCache('product'));
  window.addEventListener('AI_PRODUCTS_UPDATED', () => clearApiCache('product'));
}

// Helper for HTTP requests with timeout
async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API Error ${res.status}: ${errText.slice(0, 200)}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Quá thời gian phản hồi (Timeout ${timeoutMs/1000}s)`);
    }
    console.error(`Fetch error at ${url}:`, err.message);
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

  if (params.skipCache) {
    clearApiCache('product');
  } else {
    const cached = getCached(cacheKey);
    // 1. Nếu có dữ liệu trong cache và không yêu cầu skipCache, trả về ngay (0ms) và đồng bộ ngầm
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setTimeout(async () => {
        try {
          const data = await fetchJson(`${API_BASE}/products${queryStr}`, {}, 8000);
          const fresh = Array.isArray(data) ? data : (data?.products || []);
          if (Array.isArray(fresh)) {
            setCached(cacheKey, fresh);
          }
        } catch {}
      }, 150);
      return cached;
    }
  }

  // 2. Gọi trực tiếp API VPS SQLite để lấy dữ liệu sống mới nhất (Là nguồn sự thật chuẩn xác)
  try {
    const data = await fetchJson(`${API_BASE}/products${queryStr}`, {}, 8000);
    const result = Array.isArray(data) ? data : (data?.products || []);
    if (Array.isArray(result)) {
      setCached(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn('Live API products notice:', err.message);
  }

  // 3. Dự phòng static JSON duy nhất khi máy chủ VPS hoàn toàn không phản hồi (offline)
  try {
    const fallbackRes = await fetch('/products.json');
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      const list = Array.isArray(fallbackData) ? fallbackData : (fallbackData?.products || []);
      if (Array.isArray(list) && list.length > 0) {
        setCached(cacheKey, list);
        return list;
      }
    }
  } catch {}

  return [];
}

export async function apiGetProduct(idOrSlug) {
  if (!idOrSlug) return null;
  const cacheKey = `product_${idOrSlug}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson(`${API_BASE}/products/${encodeURIComponent(idOrSlug)}`);
    const result = data?.product || data || null;
    if (result && typeof result === 'object' && result.id) {
      setCached(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn('Get single product error:', err.message);
  }
  return null;
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
  try {
    const data = await fetchJson(`${API_BASE}/customers`);
    return Array.isArray(data) ? data : (data?.customers || []);
  } catch (err) {
    console.warn('apiGetCustomers error:', err.message);
    return [];
  }
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
  try {
    const data = await fetchJson(`${API_BASE}/orders${queryStr}`);
    return Array.isArray(data) ? data : (data?.orders || []);
  } catch (err) {
    console.warn('apiGetOrders error:', err.message);
    return [];
  }
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
  clearApiCache('product');
  // Đối với clean_deleted: ưu tiên gọi thẳng VPS API để thực hiện câu lệnh xóa SQLite chính xác
  if (mode === 'clean_deleted') {
    try {
      const res = await fetchJson(`${API_BASE}/sync/dunvex-products`, {
        method: 'POST',
        body: JSON.stringify({ mode })
      }, 35000);
      clearApiCache('product');
      return res;
    } catch {
      const res = await fetchJson(`${N8N_WEBHOOK_BASE}/zbuild-sync-products`, {
        method: 'POST',
        body: JSON.stringify({ mode })
      }, 35000);
      clearApiCache('product');
      return res;
    }
  }

  try {
    const res = await fetchJson(`${N8N_WEBHOOK_BASE}/zbuild-sync-products`, {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
    clearApiCache('product');
    return res;
  } catch {
    const res = await fetchJson(`${API_BASE}/sync/dunvex-products`, {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
    clearApiCache('product');
    return res;
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
  const payload = { productId, title, specs, category, instructions, productInfo, tavilyApiKey };
  // 1. Thử gọi n8n Webhook trước (Tối ưu token & kiểm soát prompt trên n8n)
  try {
    const res = await fetchJson(`${N8N_WEBHOOK_BASE}/zbuild-ai-enrich`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, 90000);
    return { ...res, engine: 'n8n Webhook' };
  } catch (n8nErr) {
    console.warn('[AI Enrich] n8n error, fallback to VPS AI Backend:', n8nErr.message);
    const res = await fetchJson(`${API_BASE}/ai/enrich`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, 70000);
    return { ...res, engine: 'VPS AI Backend' };
  }
}

export async function apiTriggerAiBulkEnrich({ status = 'Draft', limit = 5, productIds = [], productId = null, title = '', category = '', specs = '', unit = '', weight = '', instructions = '', productInfo = '', tavilyApiKey = '' } = {}) {
  const payload = {
    status,
    limit,
    productIds: productIds && productIds.length > 0 ? productIds : (productId ? [productId] : []),
    productId: productId || (productIds && productIds.length > 0 ? productIds[0] : null),
    title,
    category,
    specs,
    unit,
    weight,
    instructions,
    productInfo,
    tavilyApiKey
  };

  let n8nError = null;
  // 1. Thử gọi n8n Webhook trước (Ưu tiên n8n để tối ưu hóa prompt & token)
  try {
    const res = await fetchJson(`${N8N_WEBHOOK_BASE}/dong-bo-sp-ai`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, 90000);
    return { ...res, engine: 'n8n Webhook' };
  } catch (n8nErr) {
    n8nError = n8nErr.message;
    console.warn('[AI Bulk Enrich] n8n Webhook error, fallback to VPS API:', n8nErr.message);
  }

  // 2. Dự phòng VPS AI API nếu n8n Webhook không phản hồi
  try {
    const res = await fetchJson(`${API_BASE}/ai/bulk-enrich`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, 60000);
    return { ...res, engine: 'VPS AI Backend' };
  } catch (apiErr) {
    console.error('[AI Bulk Enrich] Both n8n Webhook and VPS API failed:', apiErr.message);
    throw new Error(`Không thể kết nối (n8n: ${n8nError} | VPS: ${apiErr.message})`);
  }
}

export async function apiSendAdminAiMessage({ message, history = [], productIds = [], instructions = '' } = {}) {
  try {
    return await fetchJson(`${API_BASE}/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history, productIds, instructions })
    }, 60000);
  } catch {
    return await fetchJson(`${N8N_WEBHOOK_BASE}/zbuild-admin-chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history, productIds, instructions })
    }, 80000);
  }
}

