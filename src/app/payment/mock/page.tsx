import { notFound } from 'next/navigation';
import { areMockPaymentsEnabled } from '@/lib/mock-payments';
import MockPaymentClient from './MockPaymentClient';

export default function MockPaymentPage() {
  if (!areMockPaymentsEnabled()) {
    notFound();
  }

  return <MockPaymentClient />;
}
