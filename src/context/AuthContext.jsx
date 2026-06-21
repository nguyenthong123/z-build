/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [adminEmails, setAdminEmails] = useState((process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'nbt1024@gmail.com').split(','));
  const [loading, setLoading] = useState(true);

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
    if (!user) {
      setAdminEmails(['nbt1024@gmail.com']);
      return;
    }

    const adminDocRef = doc(db, 'settings', 'admins');
    
    const unsubscribe = onSnapshot(adminDocRef, (adminDoc) => {
      try {
        let currentEmails = ['nbt1024@gmail.com'];
        
        if (adminDoc.exists()) {
          const remoteEmails = adminDoc.data().emails || [];
          if (!remoteEmails.includes('nbt1024@gmail.com')) {
            const updated = [...remoteEmails, 'nbt1024@gmail.com'];
            updateDoc(adminDocRef, { emails: updated }).catch(() => {});
            currentEmails = updated;
          } else {
            currentEmails = remoteEmails;
          }
        } else {
          setDoc(adminDocRef, { emails: currentEmails }).catch(() => {});
        }
        setAdminEmails(currentEmails);
      } catch (error) {
        console.error("Error syncing admins:", error);
      }
    }, (error) => {
      console.error("Admin listener error, using defaults:", error);
      setAdminEmails(['nbt1024@gmail.com']);
    });
    
    return () => unsubscribe();
  }, [user]);

  const isAdmin = user && adminEmails.some(e => e.toLowerCase().trim() === user.email.toLowerCase().trim());

  return (
    <AuthContext.Provider value={{ user, isAdmin, adminEmails, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
