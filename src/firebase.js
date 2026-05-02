import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== 'REPLACE_ME') 
    ? import.meta.env.VITE_FIREBASE_API_KEY 
    : "AIzaSyDFDyDOZlplNltgcYA3VydZT0WA4ogOIMo",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN !== 'REPLACE_ME')
    ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    : "z-build-dunvex.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_PROJECT_ID !== 'REPLACE_ME')
    ? import.meta.env.VITE_FIREBASE_PROJECT_ID
    : "z-build-dunvex",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET !== 'REPLACE_ME')
    ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
    : "z-build-dunvex.firebasestorage.app",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID !== 'REPLACE_ME')
    ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    : "1057831056165",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID && import.meta.env.VITE_FIREBASE_APP_ID !== 'REPLACE_ME')
    ? import.meta.env.VITE_FIREBASE_APP_ID
    : "1:1057831056165:web:60f13cee942d02ba7220cc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Messaging and get a reference to the service
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export { auth, db, googleProvider, messaging };
