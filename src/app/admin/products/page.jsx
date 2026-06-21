'use client';
import { useRouter } from 'next/navigation';
import AdminProductList from '../../../components/AdminProductList';
import { useAppContext } from '../../../context/AppContext';
export default function Page() {
  const router = useRouter();
  const { setEditingProduct } = useAppContext();
  return <AdminProductList 
    onBack={() => router.push('/')} 
    onAddProduct={() => { setEditingProduct(null); router.push('/admin/add-product'); }} 
    onEditProduct={(product) => { setEditingProduct(product); router.push('/admin/add-product'); }}
    onPreviewProduct={(product) => router.push(`/product/${product.slug || product.id}`)}
  />;
}
