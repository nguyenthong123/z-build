const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const Fuse = require('fuse.js');

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
  const snapshot = await getDocs(collection(db, "products"));
  const loadedProducts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    tag: doc.data().category || 'NỔI BẬT',
    name: doc.data().title,
    price: doc.data().discountPrice || doc.data().basePrice,
    oldPrice: doc.data().basePrice
  })).filter(p => p.status === 'active' || (p.status !== 'Draft' && p.status !== 'Inactive'));
  
  console.log(`Active products loaded: ${loadedProducts.length}`);
  
  // Search query: "sơn"
  const searchQuery = "sơn";
  const fuse = new Fuse(loadedProducts, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'tag', weight: 1.5 },
      { name: 'category', weight: 1.5 },
      { name: 'description', weight: 1 },
      { name: 'sku', weight: 1 }
    ],
    threshold: 0.4,
    ignoreLocation: true
  });
  
  const results = fuse.search(searchQuery);
  console.log(`\n=== Fuse.js search results for "${searchQuery}" (Total: ${results.length}): ===`);
  results.forEach((r, idx) => {
    console.log(`${idx+1}: [${r.item.category}] ${r.item.name} (Score: ${r.score})`);
  });
}
run().catch(console.error);
