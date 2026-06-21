'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import OrderHistory from '../../components/OrderHistory';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { setSelectedOrder } = useAppContext();

  return (
    <OrderHistory 
      user={user} 
      onBack={() => router.push('/')} 
      onViewOrderDetail={(order) => { 
        setSelectedOrder(order); 
        router.push(`/order/${order.id}`); 
      }} 
    />
  );
}
