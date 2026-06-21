'use client';
import { useRouter } from 'next/navigation';
import AdminAffiliateManagement from '../../../components/AdminAffiliateManagement';
import { useAuth } from '../../../context/AuthContext';
export default function Page() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return <AdminAffiliateManagement onBack={() => router.push('/admin/dashboard')} />;
}
