'use client';
import { useParams } from 'next/navigation';
<<<<<<< HEAD
import PurchaseDetail from '@/components/PurchaseDetail';
 
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PurchaseDetail id={id} />;
=======
import DocDetail from '@/components/DocDetail';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <DocDetail kind="purchase" id={id} />;
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
}
