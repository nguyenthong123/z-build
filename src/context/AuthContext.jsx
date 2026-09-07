import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { apiGetSettings, apiSaveSettings } from '../services/sqliteApi';

const AuthContext = createContext(null);

const getRootAdmins = () => {
  const envEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const list = envEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const defaults = ['nbt1024@gmail.com', 'tranthanh.datnguon@gmail.com', 'thachcao.taman@gmail.com'];
  defaults.forEach(d => {
    if (!list.includes(d)) list.push(d);
  });
  return list;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const rootAdmins = getRootAdmins();
  const [adminEmails, setAdminEmails] = useState(rootAdmins);
  const [loading, setLoading] = useState(true);

  // Sync / fetch admin list from SQLite primary backend
  const fetchAdmins = useCallback(async () => {
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

      // Merge with rootAdmins
      const merged = Array.from(new Set([...rootAdmins, ...sqliteEmails.map(e => e.toLowerCase().trim())]));
      setAdminEmails(merged);

      // If SQLite was empty, initialize it with the merged list
      if (!sqliteEmails || sqliteEmails.length === 0) {
        await apiSaveSettings('admins', { emails: merged });
      }
    } catch (e) {
      console.warn("SQLite admins fetch notice:", e.message);
    }
  }, [rootAdmins]);

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

  useEffect(() => {
    fetchAdmins();

    if (!user) {
      return;
    }

    // Secondary listener to Firestore for backward compatibility & live sync
    const adminDocRef = doc(db, 'settings', 'admins');
    const unsubscribe = onSnapshot(adminDocRef, (adminDoc) => {
      try {
        if (adminDoc.exists()) {
          const remoteEmails = adminDoc.data().emails || [];
          setAdminEmails(prev => {
            const combined = Array.from(new Set([...prev, ...remoteEmails.map(e => e.toLowerCase().trim())]));
            // Also sync to SQLite if new emails arrived
            apiSaveSettings('admins', { emails: combined }).catch(() => {});
            return combined;
          });
        }
      } catch (error) {
        console.warn("Firestore admin sync warning:", error);
      }
    }, () => {});

    return () => unsubscribe();
  }, [user, fetchAdmins]);

  const isAdmin = Boolean(user && adminEmails.some(e => e.toLowerCase().trim() === (user.email || '').toLowerCase().trim()));

  return (
    <AuthContext.Provider value={{ user, isAdmin, adminEmails, setAdminEmails, fetchAdmins, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
