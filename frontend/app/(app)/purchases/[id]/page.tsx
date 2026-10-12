'use client';
import { useParams } from 'next/navigation';
import PurchaseDetail from '@/components/PurchaseDetail';
 
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PurchaseDetail id={id} />;
}
