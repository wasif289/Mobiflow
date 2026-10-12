'use client';
import { useParams } from 'next/navigation';
import DocDetail from '@/components/DocDetail';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <DocDetail kind="sale" id={id} />;
}
