const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDFDyDOZlplNltgcYA3VydZT0WA4ogOIMo",
  authDomain: "z-build-dunvex.firebaseapp.com",
  projectId: "z-build-dunvex",
  storageBucket: "z-build-dunvex.firebasestorage.app",
  messagingSenderId: "1057831056165",
  appId: "1:1057831056165:web:60f13cee942d02ba7220cc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const docRef = doc(db, 'settings', 'admins');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log("Current admins in Firestore:", snap.data());
  } else {
    console.log("Document settings/admins does not exist!");
  }
}

run().catch(console.error);
