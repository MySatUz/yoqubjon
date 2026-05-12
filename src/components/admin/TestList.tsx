'use client';

import React, { useState } from 'react';
import { deleteTest } from '@/app/admin/actions';
import { Trash2, Loader2 } from 'lucide-react';

interface TestListProps {
  tests: {
    id: string;
    title: string;
    isFree: boolean;
    createdAt: Date;
    _count: { questions: number };
  }[];
}

export default function TestList({ tests }: TestListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this test? All questions and results will be lost.')) return;
    
    setDeletingId(id);
    const res = await deleteTest(id);
    if (!res.success) {
      alert('Failed to delete test: ' + res.error);
    }
    setDeletingId(null);
  };

  return (
    <div className="mt-12 space-y-6">
      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Existing Tests</h2>
      
      {tests.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 font-bold">
          No tests uploaded yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {tests.map((test) => (
            <div key={test.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between group hover:border-blue-200 transition-all">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900">{test.title}</span>
                  {test.isFree && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full">Free</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-bold">
                  {test._count.questions} questions • Uploaded {new Date(test.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <button 
                onClick={() => handleDelete(test.id)}
                disabled={deletingId === test.id}
                className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
              >
                {deletingId === test.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
