import React from 'react';
import { prisma } from '@/lib/prisma';
import AdminForm from '@/components/admin/AdminForm';
import TestList from '@/components/admin/TestList';

export const dynamic = 'force-dynamic';

export default async function AdminUploadPage() {
  const tests = await prisma.test.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { questions: true }
      }
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Admin Test Manager</h1>
          <p className="text-slate-500 font-medium">Upload .tex files and images to create new practice modules.</p>
        </div>

        {/* Upload Form */}
        <AdminForm />

        {/* Existing Tests List */}
        <TestList tests={tests} />
      </div>
    </div>
  );
}
