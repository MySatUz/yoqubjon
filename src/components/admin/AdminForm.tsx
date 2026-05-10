'use client';

import React, { useState } from 'react';
import { uploadTest } from '@/app/admin/actions';
import { FileText, Image as ImageIcon, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function AdminForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; testId?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const response = await uploadTest(formData);
    
    setResult(response);
    setLoading(false);
    if (response.success) {
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 space-y-8">
      {/* Test Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Test Title</label>
          <input 
            name="title" 
            type="text" 
            required 
            placeholder="e.g., March SAT Math Practice"
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900"
          />
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <input 
            id="isFree" 
            name="isFree" 
            type="checkbox" 
            value="true"
            className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500" 
          />
          <label htmlFor="isFree" className="text-sm font-black text-slate-700">Set as Free Test</label>
        </div>
      </div>

      {/* File Uploads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">LaTeX File (.tex)</label>
          <div className="relative group">
            <input 
              name="texFile" 
              type="file" 
              accept=".tex" 
              required
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl group-hover:border-blue-400 group-hover:bg-blue-50 transition-all text-center">
              <FileText className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-500">Select main.tex</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Images (.png, .jpg)</label>
          <div className="relative group">
            <input 
              name="images" 
              type="file" 
              multiple 
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl group-hover:border-blue-400 group-hover:bg-blue-50 transition-all text-center">
              <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-500">Select all PNGs</span>
            </div>
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-5 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-black text-lg transition-all transform active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            Processing LaTeX...
          </>
        ) : (
          <>
            <Upload className="w-6 h-6" />
            Upload and Create Test
          </>
        )}
      </button>

      {result?.success && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-700 font-bold animate-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          Test uploaded successfully!
        </div>
      )}

      {result?.error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 font-bold">
          <AlertCircle className="w-5 h-5 text-red-500" />
          Error: {result.error}
        </div>
      )}
    </form>
  );
}
