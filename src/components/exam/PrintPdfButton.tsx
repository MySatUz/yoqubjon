'use client';

import { Download } from 'lucide-react';
import { buttonClass } from '@/components/ui/Button';

export default function PrintPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonClass({ className: 'print:hidden' })}
    >
      <Download className="h-4 w-4" />
      Download PDF
    </button>
  );
}
