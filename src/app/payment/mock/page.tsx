import { notFound } from 'next/navigation';
import MockPaymentClient from './MockPaymentClient';

export default function MockPaymentPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <MockPaymentClient />;
}
