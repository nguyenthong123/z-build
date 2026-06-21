'use client';
import { useRouter } from 'next/navigation';
import AdminSettings from '../../../components/AdminSettings';
import { useAuth } from '../../../context/AuthContext';
export default function Page() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return <AdminSettings onBack={() => router.push('/admin/dashboard')} />;
}
