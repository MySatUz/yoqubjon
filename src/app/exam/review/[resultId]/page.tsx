import { prisma } from '@/lib/prisma';
import { Suspense } from 'react';
import VideoClient from '@/components/exam/VideoClient';

export default async function ReviewPage({ params }: { params: { resultId: string } }) {
  const resultId = params.resultId;
  
  let result = null;
  try {
    result = await prisma.result.findUnique({
      where: { id: resultId },
      include: {
        test: {
          include: {
            questions: true
          }
        }
      }
    });
  } catch (e) {
    console.error(e);
  }

  // Fallback for UI Development
  if (!result) {
    result = {
      score: 680,
      timeSpent: 2450,
      answers: { "0": "A", "1": "C" },
      test: {
        title: "Digital SAT Practice Test 1",
        questions: Array.from({ length: 27 }).map((_, i) => ({
          id: i.toString(),
          text: `Sample Question ${i + 1}`,
          correctAnswer: ["A", "B", "C", "D"][i % 4],
          videoUrl: i % 3 === 0 ? "https://www.youtube.com/embed/dQw4w9WgXcQ" : null
        }))
      }
    } as any;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Score Header */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Test Review</h1>
          <p className="text-slate-500 font-medium mb-8">{result.test.title}</p>
          
          <div className="flex justify-center items-end gap-2">
            <span className="text-6xl font-black text-blue-600 tracking-tighter">{result.score}</span>
            <span className="text-xl font-bold text-slate-400 mb-2">/ 800</span>
          </div>
        </div>

        {/* Question Review List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Question Breakdown</h2>
          
          <div className="grid gap-4">
            {result.test.questions.map((q: any, i: number) => {
              const userAnswer = (result as any).answers[q.id] || (result as any).answers[i.toString()]; // support mock index keys
              const isCorrect = userAnswer === q.correctAnswer;
              
              return (
                <div key={q.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className={`p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${q.videoUrl ? 'border-b border-slate-100' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
                        isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Your Answer: <span className="font-bold">{userAnswer || 'Omitted'}</span></p>
                        {!isCorrect && (
                          <p className="text-sm text-slate-500 mt-1">Correct Answer: {q.correctAnswer}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Video Explanation Trigger */}
                    {q.videoUrl && (
                      <Suspense fallback={<div className="h-10 w-32 bg-slate-100 animate-pulse rounded"></div>}>
                        <VideoClient url={q.videoUrl} />
                      </Suspense>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
