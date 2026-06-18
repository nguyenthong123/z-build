import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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
    const fetchAdmins = async () => {
      try {
        const adminDocRef = doc(db, 'settings', 'admins');
        const adminDoc = await getDoc(adminDocRef);
        
        let currentEmails = ['trunghieu.nd01@gmail.com', 'nbt1024@gmail.com'];
        
        if (adminDoc.exists()) {
          const remoteEmails = adminDoc.data().emails || [];
          if (!remoteEmails.includes('nbt1024@gmail.com')) {
            const updated = [...remoteEmails, 'nbt1024@gmail.com'];
            await updateDoc(adminDocRef, { emails: updated });
            currentEmails = updated;
          } else {
            currentEmails = remoteEmails;
          }
        } else {
          await setDoc(adminDocRef, { emails: currentEmails });
        }
        setAdminEmails(currentEmails);
      } catch (error) {
        console.error("Error fetching admins:", error);
      }
    };
    fetchAdmins();
  }, []);

  const isAdmin = user && adminEmails.some(e => e.toLowerCase().trim() === user.email.toLowerCase().trim());

  return (
    <AuthContext.Provider value={{ user, isAdmin, adminEmails, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
