import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from 'fs';

const.env.local = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value.length) acc[key.trim()] = value.join('=').trim();
  return acc;
}, {});

const firebaseConfig = {
  apiKey:.env.local.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:.env.local.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:.env.local.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:.env.local.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:.env.local.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:.env.local.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'products'));
  const products = snap.docs.map(doc => doc.data().title);
  console.log(JSON.stringify(products, null, 2));
  process.exit(0);
}
run();
