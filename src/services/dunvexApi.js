/**
 * Dunvex API Service
 * Fetches customer debt/order/payment data from Dunvex backend
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getDunvexBaseUrl } from '../utils/dunvexSync';

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
