/* eslint-disable react-refresh/only-export-components */
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useStorefrontAI } from '../hooks/useStorefrontAI';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';


const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const storefrontAdvisorState = useStorefrontAI(user);

  const [intendedDestination, setIntendedDestination] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isChatBotOpen, setIsChatBotOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);

  const [cartItems, setCartItems] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('zbuild_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [compareCount, setCompareCount] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = localStorage.getItem('compareList');
      return saved ? JSON.parse(saved).length : 0;
    } catch { return 0; }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zbuild_cart', JSON.stringify(cartItems));
    }
  }, [cartItems]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleCompareUpdate = () => {
      try {
        const saved = localStorage.getItem('compareList');
        setCompareCount(saved ? JSON.parse(saved).length : 0);
      } catch { setCompareCount(0); }
    };
    window.addEventListener('compareListUpdated', handleCompareUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === 'compareList') handleCompareUpdate();
    });
    return () => {
      window.removeEventListener('compareListUpdated', handleCompareUpdate);
      window.removeEventListener('storage', handleCompareUpdate);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleAIBatchAdd = (e) => {
      const items = e.detail; 
      if (Array.isArray(items) && items.length > 0) {
        setCartItems(prev => {
          let next = [...prev];
          items.forEach(item => {
            const product = item.product;
            const quantity = item.quantity;
            const existingItem = next.find(i => i.id === product.id);
            if (existingItem) {
              next = next.map(i => i.id === product.id ? { ...i, quantity: i.quantity + quantity, weight: i.weight || parseFloat(product.weight) || 0 } : i);
            } else {
              next.push({
                id: product.id,
                name: product.title || product.name,
                price: product.discountPrice || product.basePrice || product.price,
                quantity: quantity,
                image: product.image || product.img,
                weight: parseFloat(product.weight) || 0,
                variant: 'Default'
              });
            }
          });
          return next;
        });
        addToast(`Trợ lý AI đã tự động thêm ${items.length} mặt hàng vào giỏ!`, 'success');
      }
    };
    window.addEventListener('AI_ADD_TO_CART_BATCH', handleAIBatchAdd);
    return () => window.removeEventListener('AI_ADD_TO_CART_BATCH', handleAIBatchAdd);
  }, [addToast]);

  useEffect(() => {
    const healCartItems = async () => {
      let needsHeal = false;
      const healedItems = await Promise.all(cartItems.map(async (item) => {
        if (item.weight === undefined || item.weight === null) {
          try {
            const docRef = doc(db, 'products', item.id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              const weightVal = parseFloat(data.weight) || 0;
              needsHeal = true;
              return { ...item, weight: weightVal };
            }
          } catch (err) {
            console.error("Error healing cart item weight:", err);
          }
        }
        return item;
      }));
      
      if (needsHeal) {
        setCartItems(healedItems);
      }
    };

    if (cartItems.length > 0) {
      const hasMissingWeight = cartItems.some(item => item.weight === undefined || item.weight === null);
      if (hasMissingWeight) {
        healCartItems();
      }
    }
  }, [cartItems]);


  const updateQuantity = (id, delta, isAbsolute = false) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = isAbsolute ? delta : item.quantity + delta;
        return { ...item, quantity: Math.max(isAbsolute ? 0 : 1, newQty) };
      }
      return item;
    }));
  };

  const removeItem = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const handleAddToCart = (product, quantity = 1) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + quantity, weight: item.weight || parseFloat(product.weight) || 0 } : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.title || product.name,
        price: product.discountPrice || product.basePrice || product.price,
        quantity: quantity,
        image: product.image || product.img,
        weight: parseFloat(product.weight) || 0,
        variant: 'Default'
      }];
    });
    addToast(`Đã thêm ${product.title || product.name} vào giỏ hàng`, 'success');
  };


  const handleOrderComplete = (data) => {
    setOrderData(data);
    setCartItems([]);
    navigate('/order-confirmation');
  };

  const handleLoginRequired = (destination) => {
    setIntendedDestination(destination);
    navigate('/login');
  };

  return (
    <AppContext.Provider value={{
      cartItems, setCartItems, updateQuantity, removeItem, clearCart, handleAddToCart,
      compareCount, setCompareCount,
      intendedDestination, setIntendedDestination, handleLoginRequired,
      orderData, setOrderData, handleOrderComplete,
      editingProduct, setEditingProduct,
      selectedOrder, setSelectedOrder,
      isChatBotOpen, setIsChatBotOpen,
      detailProduct, setDetailProduct,
      storefrontAdvisorState
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
