"use client";

import React from 'react';
import { useExamStore } from '@/store/useExamStore';
import 'katex/dist/katex.min.css';
import Image from 'next/image';
import { renderMathText } from '@/lib/renderMathText';

interface Question {
  id: string;
  content: string;
  options: unknown;
  imageUrl?: string | null;
}

export default function SplitScreen({ questions }: { questions: Question[] }) {
  const { currentQuestionIndex, answers, setAnswer, isCalculatorOpen } = useExamStore();

  if (!questions || questions.length === 0) return null;

  const safeQuestionIndex = Math.min(currentQuestionIndex, questions.length - 1);
  const question = questions[safeQuestionIndex];
  const currentAnswer = answers[question.id];

  // Determine type: if options is null or empty array, it's GRID_IN
  const isMultipleChoice = Array.isArray(question.options) && question.options.length > 0;

  return (
    <div className={`flex-1 flex overflow-hidden bg-white transition-all duration-500 ${isCalculatorOpen ? 'flex-col md:flex-row' : 'flex-col'}`}>
      {/* Question & Options Column */}
      <div className={`flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-10 transition-all duration-500 ${isCalculatorOpen ? 'w-full md:w-[46%] border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/30' : 'w-full'}`}>
        <div className={`${isCalculatorOpen ? 'max-w-2xl' : 'max-w-4xl'} mx-auto w-full flex flex-col min-h-full`}>
          {/* Question Content */}
          <div className="mb-10 flex-grow">
            <div className="prose prose-slate max-w-none">
              <div className={`${isCalculatorOpen ? 'text-base md:text-xl' : 'text-lg md:text-2xl'} font-medium text-slate-800 leading-relaxed mb-6 transition-all duration-500`}>
                {renderMathText(question.content)}
              </div>
            </div>

            {question.imageUrl && (
              <div className={`my-6 rounded-2xl overflow-hidden border border-slate-200 bg-white p-3 shadow-md mx-auto ${isCalculatorOpen ? 'max-w-md' : 'max-w-xl'}`}>
                <Image 
                  src={question.imageUrl} 
                  alt="Question diagram" 
                  width={800}
                  height={480}
                  sizes={isCalculatorOpen ? '(min-width: 768px) 28rem, 70vw' : '(min-width: 768px) 36rem, 80vw'}
                  className={`mx-auto h-auto w-full object-contain ${isCalculatorOpen ? 'max-h-[250px]' : 'max-h-[340px]'}`}
                />
              </div>
            )}
          </div>

          {/* Options / Answer Input */}
          <div className="mt-auto pt-8 border-t border-slate-200/60">
            {isMultipleChoice ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {(question.options as string[]).map((option: string, idx: number) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isSelected = currentAnswer === letter;
                  return (
                    <button
                      key={idx}
                      onClick={() => setAnswer(question.id, letter)}
                      className={`group flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                        isSelected 
                          ? 'border-emerald-600 bg-emerald-50 shadow-lg shadow-emerald-100 ring-4 ring-emerald-50 scale-[1.02]' 
                          : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50 shadow-sm'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black transition-all ${
                        isSelected 
                          ? 'bg-emerald-600 border-emerald-600 text-white rotate-3' 
                          : 'border-slate-200 text-slate-400 group-hover:border-emerald-300 group-hover:text-emerald-600'
                      }`}>
                        {letter}
                      </span>
                      <span className={`font-bold transition-all ${
                        isSelected ? 'text-emerald-900' : 'text-slate-800'
                      } ${isCalculatorOpen ? 'text-base' : 'text-xl'}`}>
                        {renderMathText(option)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mx-auto max-w-sm rounded-[2rem] border border-blue-100 bg-gradient-to-b from-blue-50 to-white p-5 shadow-[0_18px_40px_rgba(59,130,246,0.12)]">
                <div className="flex flex-col items-center gap-3">
                  <h4 className="mb-1 rounded-full border border-blue-100 bg-white px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 shadow-sm">
                    Student-Produced Response
                  </h4>
                  <div className="relative mx-auto w-full max-w-[220px]">
                    <input 
                      type="text" 
                      value={currentAnswer || ''}
                      onChange={(e) => setAnswer(question.id, e.target.value)}
                      placeholder="Enter value"
                      inputMode="decimal"
                      className="w-full rounded-2xl border-2 border-blue-300 bg-white px-4 py-3 text-center text-3xl font-black tracking-tight text-slate-900 shadow-[0_10px_22px_rgba(37,99,235,0.12)] transition-all placeholder:text-slate-200 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/80"></div>
                  </div>
                  <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-blue-500">
                    Enter your answer above
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calculator Panel */}
      {isCalculatorOpen && (
        <div className="h-[45vh] w-full md:h-auto md:w-[55%] flex flex-col bg-white animate-in slide-in-from-right duration-500 ease-out border-l border-slate-200 shadow-2xl">
          <iframe 
            src="https://www.desmos.com/testing/collegeboard/graphing?lang=en"
            className="flex-1 w-full border-none"
            title="College Board Desmos Calculator"
          />
        </div>
      )}
    </div>
  );
}
