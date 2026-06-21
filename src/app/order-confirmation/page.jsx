'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import OrderConfirmation from '../../components/OrderConfirmation';
import { useAppContext } from '../../context/AppContext';

export default function OrderConfirmationPage() {
  const router = useRouter();
  const { orderData } = useAppContext();

  return (
    <OrderConfirmation 
      orderData={orderData} 
      onNavigate={(path) => router.push(path)} 
    />
  );
}
