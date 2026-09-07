import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { apiGetSettings, apiSaveSettings } from '../services/sqliteApi';

const AuthContext = createContext(null);

const DEFAULT_ADMIN_EMAILS = [
  'nbt1024@gmail.com', 
  'tranthanh.datnguon@gmail.com', 
  'thachcao.taman@gmail.com'
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [adminEmails, setAdminEmails] = useState(DEFAULT_ADMIN_EMAILS);
  const [loading, setLoading] = useState(true);
  const isFetchingAdmins = useRef(false);

  // Sync / fetch admin list from SQLite primary backend
  const fetchAdmins = useCallback(async () => {
    if (isFetchingAdmins.current) return;
    isFetchingAdmins.current = true;
    try {
      const data = await apiGetSettings('admins');
      let sqliteEmails = [];
      if (data && Array.isArray(data.emails)) {
        sqliteEmails = data.emails;
      } else if (data && typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed.emails)) sqliteEmails = parsed.emails;
          else if (Array.isArray(parsed)) sqliteEmails = parsed;
        } catch {}
      }

      // Merge with default admins
      const merged = Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...sqliteEmails.map(e => e.toLowerCase().trim())]));
      
      setAdminEmails(prev => {
        const prevSorted = [...prev].sort().join(',');
        const newSorted = [...merged].sort().join(',');
        if (prevSorted === newSorted) return prev;
        return merged;
      });
    } catch (e) {
      console.warn("SQLite admins fetch notice:", e.message);
    } finally {
      isFetchingAdmins.current = false;
    }
  }, []);

  // 1. Auth state listener (runs once on mount)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || 'User',
          photoURL: firebaseUser.photoURL || null
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch admin list once on mount
  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // 3. Optional Firestore live sync for logged-in users (only when user state changes)
  useEffect(() => {
    if (!user) return;

    const adminDocRef = doc(db, 'settings', 'admins');
    const unsubscribe = onSnapshot(adminDocRef, (adminDoc) => {
      try {
        if (adminDoc.exists()) {
          const remoteEmails = adminDoc.data().emails || [];
          setAdminEmails(prev => {
            const combined = Array.from(new Set([...prev, ...remoteEmails.map(e => e.toLowerCase().trim())]));
            const prevSorted = [...prev].sort().join(',');
            const newSorted = [...combined].sort().join(',');
            if (prevSorted === newSorted) return prev;
            return combined;
          });
        }
      } catch (error) {
        console.warn("Firestore admin sync warning:", error);
      }
    }, () => {});

    return () => unsubscribe();
  }, [user?.uid]);

  const isAdmin = Boolean(
    user && 
    user.email && 
    adminEmails.some(e => e.toLowerCase().trim() === user.email.toLowerCase().trim())
  );

  const contextValue = useMemo(() => ({
    user,
    isAdmin,
    adminEmails,
    setAdminEmails,
    fetchAdmins,
    loading
  }), [user, isAdmin, adminEmails, fetchAdmins, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
