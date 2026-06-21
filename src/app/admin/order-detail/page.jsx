'use client';
import { useRouter } from 'next/navigation';
import OrderDetail from '../../../components/OrderDetail';
import { useAppContext } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
export default function Page() {
  const router = useRouter();
  const { selectedOrder, setSelectedOrder } = useAppContext();
  const { addToast } = useToast();
  return <OrderDetail
    order={selectedOrder}
    onBack={() => router.push('/admin/orders')}
    isAdmin={true}
    onCancelSuccess={(orderId) => {
      setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: 'cancelled' } : prev);
      addToast('Đơn hàng đã được hủy thành công', 'success');
    }}
  />;
}
