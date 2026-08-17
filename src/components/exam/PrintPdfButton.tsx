'use client';

import { Download } from 'lucide-react';

export default function PrintPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 print:hidden"
    >
      <Download className="h-4 w-4" />
      Download PDF
    </button>
  );
}
