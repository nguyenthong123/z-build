'use client';
import { useRouter } from 'next/navigation';
import AdminOrderManagement from '../../../components/AdminOrderManagement';
import { useAppContext } from '../../../context/AppContext';
export default function Page() {
  const router = useRouter();
  const { setSelectedOrder } = useAppContext();
  return <AdminOrderManagement
    onBack={() => router.push('/')}
    onViewOrderDetail={(order) => { setSelectedOrder(order); router.push('/admin/order-detail'); }}
  />;
}
