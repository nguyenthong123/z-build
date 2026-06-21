'use client';
import { useRouter } from 'next/navigation';
import AdminAddProduct from '../../../components/AdminAddProduct';
import { useAppContext } from '../../../context/AppContext';
export default function Page() {
  const router = useRouter();
  const { editingProduct, setEditingProduct } = useAppContext();
  
  return <AdminAddProduct 
    onBack={() => router.push('/admin/products')} 
    editData={editingProduct}
    onSave={() => { setEditingProduct(null); router.push('/admin/products'); }} 
  />;
}
