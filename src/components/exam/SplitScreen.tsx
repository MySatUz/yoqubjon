"use client";

import React, { useEffect, useState } from 'react';
import { useExamStore } from '@/store/useExamStore';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface Question {
  id: string;
  content: string;
  options: any; // Json from Prisma
  correctAnswer: string;
  type?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export default function SplitScreen({ questions }: { questions: Question[] }) {
  const { currentQuestionIndex, answers, setAnswer, isCalculatorOpen } = useExamStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!questions || questions.length === 0) return null;

  const question = questions[currentQuestionIndex % questions.length];
  const currentAnswer = mounted ? answers[currentQuestionIndex.toString()] : undefined;

  // Determine type: if options is null or empty array, it's GRID_IN
  const isMultipleChoice = Array.isArray(question.options) && question.options.length > 0;

  // Helper to render text with LaTeX
  const renderMathText = (text: string) => {
    if (!text) return null;
    
    // Split by $, \( \), or \[ \]
    // This regex looks for:
    // 1. $...$
    // 2. \(...\)
    // 3. \[...\]
    const parts = text.split(/(\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\])/gs);
    
    return parts.map((part, index) => {
      // Inline Math: $...$ or \(...\)
      if (
        (part.startsWith('$') && part.endsWith('$')) || 
        (part.startsWith('\\(') && part.endsWith('\\)'))
      ) {
        const formula = part.startsWith('$') 
          ? part.slice(1, -1) 
          : part.slice(2, -2);
        return <InlineMath key={index}>{formula}</InlineMath>;
      }
      
      // Block Math: \[...\]
      if (part.startsWith('\\[') && part.endsWith('\\]')) {
        const formula = part.slice(2, -2);
        return <BlockMath key={index}>{formula}</BlockMath>;
      }
      
      // Regular text
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className={`flex-1 flex overflow-hidden bg-white transition-all duration-500 ${isCalculatorOpen ? 'flex-row' : 'flex-col'}`}>
      {/* Question & Options Column */}
      <div className={`flex-1 overflow-y-auto px-6 py-8 md:px-12 md:py-10 transition-all duration-500 ${isCalculatorOpen ? 'w-[40%] md:w-[45%] border-r border-slate-100 bg-slate-50/30' : 'w-full'}`}>
        <div className={`${isCalculatorOpen ? 'max-w-2xl' : 'max-w-4xl'} mx-auto w-full flex flex-col min-h-full`}>
          {/* Question Content */}
          <div className="mb-10 flex-grow">
            <div className="prose prose-slate max-w-none">
              <div className={`${isCalculatorOpen ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'} font-medium text-slate-800 leading-relaxed mb-6 transition-all duration-500`}>
                {renderMathText(question.content)}
              </div>
            </div>

            {question.imageUrl && (
              <div className={`my-6 rounded-2xl overflow-hidden border border-slate-200 bg-white p-4 shadow-md mx-auto ${isCalculatorOpen ? 'max-w-full' : 'max-w-2xl'}`}>
                <img 
                  src={question.imageUrl} 
                  alt="Question diagram" 
                  className="max-w-full h-auto mx-auto"
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
                      onClick={() => setAnswer(currentQuestionIndex.toString(), letter)}
                      className={`group flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-100 ring-4 ring-blue-50 scale-[1.02]' 
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 shadow-sm'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black transition-all ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white rotate-3' 
                          : 'border-slate-200 text-slate-400 group-hover:border-blue-300 group-hover:text-blue-500'
                      }`}>
                        {letter}
                      </span>
                      <span className={`font-bold transition-all ${
                        isSelected ? 'text-blue-900' : 'text-slate-800'
                      } ${isCalculatorOpen ? 'text-base' : 'text-xl'}`}>
                        {renderMathText(option)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="max-w-md mx-auto bg-blue-50 p-8 rounded-3xl border-2 border-blue-200 shadow-xl ring-8 ring-blue-50/50">
                <div className="flex flex-col items-center gap-4">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 bg-white px-4 py-1.5 rounded-full border border-blue-100 shadow-sm">
                    Student-Produced Response
                  </h4>
                  <div className="relative w-full">
                    <input 
                      type="text" 
                      value={currentAnswer || ''}
                      onChange={(e) => setAnswer(currentQuestionIndex.toString(), e.target.value)}
                      placeholder="Enter value"
                      className="w-full p-5 text-4xl font-black text-slate-900 border-4 border-white bg-white rounded-2xl shadow-inner focus:border-blue-600 focus:ring-4 focus:ring-blue-200 focus:outline-none transition-all placeholder:text-slate-200 text-center tracking-tight"
                    />
                    <div className="absolute inset-0 rounded-2xl pointer-events-none border border-blue-100/50"></div>
                  </div>
                  <p className="text-[11px] text-blue-500 font-bold uppercase tracking-wide">Enter your answer above</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calculator Panel */}
      {isCalculatorOpen && (
        <div className="w-[60%] md:w-[55%] flex flex-col bg-white animate-in slide-in-from-right duration-500 ease-out border-l border-slate-200 shadow-2xl">
          <iframe 
            src="https://www.desmos.com/calculator" 
            className="flex-1 w-full border-none"
            title="Desmos Calculator"
          />
        </div>
      )}
    </div>
  );
}
