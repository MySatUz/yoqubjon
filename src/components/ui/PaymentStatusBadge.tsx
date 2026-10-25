import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

/**
 * The one status → tone map for manual payment requests, shared by the
 * student's subscription page and the admin queue (each used to carry its own
 * copy). `pendingLabel` differs by audience: "Pending review" reads better to
 * the student who is waiting, "Pending" to the admin working the queue.
 */
export function PaymentStatusBadge({ status, pendingLabel = 'Pending' }: { status: string; pendingLabel?: string }) {
  if (status === 'APPROVED') {
    return (
      <Badge tone="success">
        <CheckCircle2 />
        Approved
      </Badge>
    );
  }

  if (status === 'REJECTED') {
    return (
      <Badge tone="danger">
        <XCircle />
        Rejected
      </Badge>
    );
  }

  return (
    <Badge tone="warning">
      <Clock3 />
      {pendingLabel}
    </Badge>
  );
}
