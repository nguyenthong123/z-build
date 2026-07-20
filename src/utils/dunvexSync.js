import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Extract Dunvex base URL from config.
 * Priority: 1) Webhook URL → 2) dunvexApiUrl → 3) apiUrl (fallback)
 * 
 * Example:
 *   Webhook URL: https://dunvex-build.vercel.app/api/order-webhook?token=xxx
 *   → Base URL:  https://dunvex-build.vercel.app
 */
export function getDunvexBaseUrl(config) {
  // 1. Derive from Webhook URL (most reliable)
  if (config.dunvexWebhookUrl) {
    try {
      const url = new URL(config.dunvexWebhookUrl);
      return url.origin;
    } catch (e) { /* ignore */ }
  }

  // 2. Dedicated Dunvex API URL
  if (config.dunvexApiUrl) {
    try {
      const url = new URL(config.dunvexApiUrl);
      return url.origin;
    } catch (e) { /* ignore */ }
    return config.dunvexApiUrl.replace(/\/+$/, '');
  }

  // 3. Fallback to apiUrl (legacy - may be OpenClaw URL, not Dunvex)
  if (config.apiUrl) {
    let base = config.apiUrl.replace(/\/api\/products\/?$/, '');
    base = base.replace(/\/+$/, '');
    return base;
  }

  return null;
}

/**
 * Syncs a customer to Dunvex. 
 * If email matches an existing customer in Dunvex for this ownerId, Dunvex will update it (UPSERT).
 * Otherwise, Dunvex creates a new customer.
 */
export async function syncCustomerToDunvex({ name, email, phone, address }) {
  try {
    const docRef = doc(db, "storeSettings", "main");
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || !docSnap.data().openClawConfig) {
      console.warn("Dunvex sync skipped: Missing config in storeSettings");
      return { success: false, message: "Missing config" };
    }

    const config = docSnap.data().openClawConfig;
    if (!config.dunvexApiKey && !config.apiKey && !config.botApiKey) {
      console.warn("Dunvex sync skipped: Missing API Key");
      return { success: false, message: "Missing API Key" };
    }
    if (!config.ownerId) {
      console.warn("Dunvex sync skipped: Missing Owner ID");
      return { success: false, message: "Missing Owner ID" };
    }
    if (!config.dunvexWebhookUrl && !config.dunvexApiUrl && !config.apiUrl) {
      console.warn("Dunvex sync skipped: No URL to connect to Dunvex");
      return { success: false, message: "No Dunvex URL configured" };
    }

    const dunvexBase = getDunvexBaseUrl(config);
    if (!dunvexBase) {
      return { success: false, message: "Cannot determine Dunvex base URL" };
    }

    const customersUrl = `${dunvexBase}/api/customers`;

    const response = await fetch(customersUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.dunvexApiKey || config.apiKey || config.botApiKey,
        'x-owner-id': config.ownerId
      },
      body: JSON.stringify({
        name: name || "Chưa cập nhật tên",
        email: email || "",
        phone: phone || "",
        address: address || ""
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Dunvex sync failed: ${response.status} ${errText}`);
      return { success: false, error: errText };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error syncing customer to Dunvex:", error);
    return { success: false, error: error.message };
  }
}
