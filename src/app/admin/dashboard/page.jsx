'use client';
import { useRouter } from 'next/navigation';
import AdminDashboard from '../../../components/AdminDashboard';
export default function Page() {
  const router = useRouter();
  return <AdminDashboard onBack={() => router.push('/')} />;
}
