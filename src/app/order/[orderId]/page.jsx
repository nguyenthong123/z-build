'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import OrderDetail from '../../../components/OrderDetail';
import { useAppContext } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';

export default function OrderDetailPage() {
  const router = useRouter();
  const { selectedOrder, setSelectedOrder, setCartItems } = useAppContext();
  const { addToast } = useToast();

  return (
    <OrderDetail 
      order={selectedOrder} 
      onBack={() => router.push('/orders')} 
      onCancelSuccess={(orderId) => {
        setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: 'cancelled' } : prev);
        addToast('Đơn hàng đã được hủy thành công', 'success');
      }}
      onEditOrder={(items) => {
        setCartItems(items);
        router.push('/cart');
        addToast('Đã khôi phục giỏ hàng, bạn có thể chỉnh sửa và đặt lại', 'info');
      }}
      onReturnSuccess={(orderId, reason) => {
        setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: 'return_requested', returnReason: reason } : prev);
        addToast('Đã gửi yêu cầu trả hàng', 'success');
      }}
    />
  );
}
