import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExamState {
  answers: Record<string, string>;
  markedForReview: Record<string, boolean>;
  timeLeftSeconds: number;
  currentQuestionIndex: number;
  isCalculatorOpen: boolean;
  isReferenceOpen: boolean;
  
  // Actions
  setAnswer: (questionId: string, answer: string) => void;
  toggleMarkForReview: (questionId: string) => void;
  setCurrentQuestionIndex: (index: number) => void;
  decrementTime: () => void;
  resetExam: (initialTimeSeconds: number) => void;
  setCalculatorOpen: (open: boolean) => void;
  setReferenceOpen: (open: boolean) => void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set) => ({
      answers: {},
      markedForReview: {},
      timeLeftSeconds: 45 * 60, // 45 minutes default
      currentQuestionIndex: 0,
      isCalculatorOpen: false,
      isReferenceOpen: false,
      
      setAnswer: (questionId, answer) => 
        set((state) => ({
          answers: { ...state.answers, [questionId]: answer }
        })),
        
      toggleMarkForReview: (questionId) =>
        set((state) => ({
          markedForReview: {
            ...state.markedForReview,
            [questionId]: !state.markedForReview[questionId]
          }
        })),
        
      setCurrentQuestionIndex: (index) =>
        set(() => ({ currentQuestionIndex: index })),
        
      decrementTime: () =>
        set((state) => ({
          timeLeftSeconds: Math.max(0, state.timeLeftSeconds - 1)
        })),
        
      resetExam: (initialTimeSeconds) =>
        set(() => ({
          answers: {},
          markedForReview: {},
          timeLeftSeconds: initialTimeSeconds,
          currentQuestionIndex: 0,
          isCalculatorOpen: false,
          isReferenceOpen: false
        })),

      setCalculatorOpen: (open) => set({ isCalculatorOpen: open }),
      setReferenceOpen: (open) => set({ isReferenceOpen: open }),
    }),
    {
      name: 'mysat-exam-storage',
      partialize: (state) => ({
        answers: state.answers,
        markedForReview: state.markedForReview,
        timeLeftSeconds: state.timeLeftSeconds,
        currentQuestionIndex: state.currentQuestionIndex,
      }),
    }
  )
);
