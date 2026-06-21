'use client';
import { useRouter } from 'next/navigation';
import AdminCustomerManagement from '../../../components/AdminCustomerManagement';
export default function Page() {
  const router = useRouter();
  return <AdminCustomerManagement onBack={() => router.push('/')} />;
}
