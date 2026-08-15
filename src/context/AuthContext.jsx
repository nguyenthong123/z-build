/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

const getRootAdmins = () => {
  const envEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const list = envEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!list.includes('nbt1024@gmail.com')) {
    list.push('nbt1024@gmail.com');
  }
  return list;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const rootAdmins = getRootAdmins();
  const [adminEmails, setAdminEmails] = useState(rootAdmins);
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
      setAdminEmails(rootAdmins);
      return;
    }

    const adminDocRef = doc(db, 'settings', 'admins');
    
    const unsubscribe = onSnapshot(adminDocRef, (adminDoc) => {
      try {
        let currentEmails = [...rootAdmins];
        
        if (adminDoc.exists()) {
          const remoteEmails = adminDoc.data().emails || [];
          
          // Check if any root admins are missing from the remote list
          const missingRoots = rootAdmins.filter(e => !remoteEmails.map(re => re.toLowerCase().trim()).includes(e));
          if (missingRoots.length > 0) {
            const updated = [...remoteEmails, ...missingRoots];
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
      setAdminEmails(rootAdmins);
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
