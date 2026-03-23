import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const WishlistContext = createContext();

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
};

export const WishlistProvider = ({ children }) => {
  const [wishlist, setWishlist] = useState([]);
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Load wishlist from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('zbuild-wishlist');
    if (saved) {
      try { setWishlist(JSON.parse(saved)); } catch (e) {}
    }
    setLoaded(true);
  }, []);

  // Sync with Firestore when user changes
  const syncWithUser = useCallback(async (currentUser) => {
    setUser(currentUser);
    if (!currentUser) return;

    try {
      const ref = doc(db, 'wishlists', currentUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const firestoreList = snap.data().items || [];
        // Merge: local + firestore (deduplicate by id)
        const localList = JSON.parse(localStorage.getItem('zbuild-wishlist') || '[]');
        const merged = [...firestoreList];
        localList.forEach(item => {
          if (!merged.find(m => m.id === item.id)) merged.push(item);
        });
        setWishlist(merged);
        // Save merged back
        await setDoc(ref, { items: merged, updatedAt: new Date().toISOString() });
        localStorage.setItem('zbuild-wishlist', JSON.stringify(merged));
      } else {
        // No firestore data, push local to firestore
        const localList = JSON.parse(localStorage.getItem('zbuild-wishlist') || '[]');
        if (localList.length > 0) {
          await setDoc(ref, { items: localList, updatedAt: new Date().toISOString() });
        }
      }
    } catch (err) {
      console.error('Wishlist sync error:', err);
    }
  }, []);

  // Save whenever wishlist changes
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('zbuild-wishlist', JSON.stringify(wishlist));

    // Also save to Firestore if logged in
    if (user) {
      const ref = doc(db, 'wishlists', user.uid);
      setDoc(ref, { items: wishlist, updatedAt: new Date().toISOString() }).catch(console.error);
    }
  }, [wishlist, user, loaded]);

  const addToWishlist = (product) => {
    setWishlist(prev => {
      if (prev.find(p => p.id === product.id)) return prev;
      return [...prev, {
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        category: product.category,
        addedAt: new Date().toISOString()
      }];
    });
  };

  const removeFromWishlist = (productId) => {
    setWishlist(prev => prev.filter(p => p.id !== productId));
  };

  const toggleWishlist = (product) => {
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const isInWishlist = (productId) => wishlist.some(p => p.id === productId);

  const clearWishlist = () => setWishlist([]);

  return (
    <WishlistContext.Provider value={{
      wishlist,
      addToWishlist,
      removeFromWishlist,
      toggleWishlist,
      isInWishlist,
      clearWishlist,
      syncWithUser,
      wishlistCount: wishlist.length
    }}>
      {children}
    </WishlistContext.Provider>
  );
};
