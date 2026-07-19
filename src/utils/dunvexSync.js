import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

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
      console.warn("Dunvex sync skipped: Missing config in adminSettings");
      return { success: false, message: "Missing config" };
    }

    const config = docSnap.data().openClawConfig;
    if (!config.apiUrl || (!config.dunvexApiKey && !config.apiKey && !config.botApiKey) || !config.ownerId) {
      console.warn("Dunvex sync skipped: Incomplete config");
      return { success: false, message: "Incomplete config" };
    }

    let base = config.apiUrl.replace(/\/api\/products\/?$/, '');
    base = base.replace(/\/+$/, '');
    const customersUrl = `${base}/api/customers`;

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
