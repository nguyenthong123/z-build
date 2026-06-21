/* eslint-disable react-refresh/only-export-components */
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useStorefrontAI } from '../hooks/useStorefrontAI';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const router = useRouter();
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
              next = next.map(i => i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i);
            } else {
              next.push({
                id: product.id,
                name: product.title || product.name,
                price: product.discountPrice || product.basePrice || product.price,
                quantity: quantity,
                image: product.image || product.img,
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

  const updateQuantity = (id, delta) => {
    setCartItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
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
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.title || product.name,
        price: product.discountPrice || product.basePrice || product.price,
        quantity: quantity,
        image: product.image || product.img,
        variant: 'Default'
      }];
    });
    addToast(`Đã thêm ${product.title || product.name} vào giỏ hàng`, 'success');
  };

  const handleOrderComplete = (data) => {
    setOrderData(data);
    setCartItems([]);
    router.push('/order-confirmation');
  };

  const handleLoginRequired = (destination) => {
    setIntendedDestination(destination);
    router.push('/login');
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
