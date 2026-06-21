'use client';
import { useRouter } from 'next/navigation';
import AdminCouponManagement from '../../../components/AdminCouponManagement';
export default function Page() {
  const router = useRouter();
  return <AdminCouponManagement onBack={() => router.push('/admin/dashboard')} />;
}
