/**
 * Dunvex API Service
 * Fetches customer debt/order/payment data from Dunvex backend
 */
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { getDunvexBaseUrl } from '../utils/dunvexSync';

// Cache product images
let _productCache = null;

/** Tải tất cả sản phẩm từ Firestore và index theo dunvexId + tên */
export async function loadProductImageMap() {
  if (_productCache) return _productCache;
  try {
    const snap = await getDocs(collection(db, 'products'));
    const map = {};
    const list = [];
    snap.forEach(doc => {
      const d = doc.data();
      const img = d.images?.[0] || d.image || d.mainImage || d.thumbnail || '';
      const entry = { id: doc.id, dunvexId: d.dunvexId || '', title: d.title || '', image: img };
      list.push(entry);
      if (d.dunvexId) map[d.dunvexId] = img;
    });
    _productCache = { byId: map, list };
    return _productCache;
  } catch (e) {
    console.warn('Failed to load product images:', e);
    return { byId: {}, list: [] };
  }
}

/** Tìm ảnh sản phẩm: ưu tiên dunvexId, fallback fuzzy theo tên */
export function findProductImage(cache, itemId, itemName) {
  const { byId, list } = cache || { byId: {}, list: [] };
  // Ưu tiên match bằng dunvexId
  if (itemId && byId[itemId]) return byId[itemId];
  // Fuzzy match tên
  if (itemName && list.length) {
    const name = itemName.toLowerCase().replace(/\s+/g, ' ').trim();
    // try exact match first
    let match = list.find(p => p.title.toLowerCase() === name);
    if (match?.image) return match.image;
    // try includes
    match = list.find(p => p.title.toLowerCase().includes(name) || name.includes(p.title.toLowerCase()));
    if (match?.image) return match.image;
    // try first 3 words
    const words = name.split(' ').slice(0, 3).join(' ');
    if (words.length > 2) {
      match = list.find(p => p.title.toLowerCase().includes(words));
      if (match?.image) return match.image;
    }
  }
  return null;
}

async function getDunvexConfig() {
  const docRef = doc(db, 'storeSettings', 'main');
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists() || !docSnap.data().openClawConfig) {
    throw new Error('Chưa cấu hình kết nối Dunvex');
  }
  const config = docSnap.data().openClawConfig;
  const baseUrl = getDunvexBaseUrl(config);
  if (!baseUrl) throw new Error('Không xác định được Dunvex URL');
  const apiKey = config.dunvexApiKey || config.apiKey || config.botApiKey;
  if (!apiKey) throw new Error('Thiếu API Key');
  return { baseUrl, apiKey, ownerId: config.ownerId };
}

async function dunvexGet(path) {
  const { baseUrl, apiKey, ownerId } = await getDunvexConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'x-api-key': apiKey, 'x-owner-id': ownerId },
  });
  if (!res.ok) throw new Error(`Lỗi API: ${res.status}`);
  const data = await res.json();
  return data.data || data || [];
}

/** Tìm customer theo SĐT */
export async function fetchCustomerByPhone(phone) {
  const customers = await dunvexGet(`/api/data/customers?where=phone:==:${encodeURIComponent(phone)}`);
  if (Array.isArray(customers) && customers.length > 0) return customers[0];
  // Thử không có số 0 đầu
  if (phone.startsWith('0')) {
    const short = phone.substring(1);
    const alt = await dunvexGet(`/api/data/customers?where=phone:==:${encodeURIComponent(short)}`);
    if (Array.isArray(alt) && alt.length > 0) return alt[0];
  }
  return null;
}

/** Lấy đơn hàng theo customerId */
export async function fetchOrdersByCustomerId(customerId) {
  const orders = await dunvexGet(`/api/data/orders?where=customerId:==:${encodeURIComponent(customerId)}&limit=500`);
  return (orders || []).filter(o => o.status !== 'Đơn nháp');
}

/** Lấy thanh toán theo customerId */
export async function fetchPaymentsByCustomerId(customerId) {
  return await dunvexGet(`/api/data/payments?where=customerId:==:${encodeURIComponent(customerId)}&limit=500`);
}
