import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EXAM_DURATION_SECONDS } from '@/lib/examConfig';

interface ExamState {
  activeTestId: string | null;
  answers: Record<string, string>;
  markedForReview: Record<string, boolean>;
  timeLeftSeconds: number;
  initialTimeSeconds: number;
  currentQuestionIndex: number;
  isCalculatorOpen: boolean;
  isReferenceOpen: boolean;
  
  // Actions
  initializeExam: (testId: string, initialTimeSeconds: number, questionIds: string[]) => void;
  setAnswer: (questionId: string, answer: string) => void;
  toggleMarkForReview: (questionId: string) => void;
  setCurrentQuestionIndex: (index: number) => void;
  decrementTime: () => void;
  resetExam: (testId: string, initialTimeSeconds: number) => void;
  setCalculatorOpen: (open: boolean) => void;
  setReferenceOpen: (open: boolean) => void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set) => ({
      activeTestId: null,
      answers: {},
      markedForReview: {},
      timeLeftSeconds: EXAM_DURATION_SECONDS,
      initialTimeSeconds: EXAM_DURATION_SECONDS,
      currentQuestionIndex: 0,
      isCalculatorOpen: false,
      isReferenceOpen: false,

      initializeExam: (testId, initialTimeSeconds, questionIds) =>
        set((state) => {
          if (state.activeTestId !== testId) {
            return {
              activeTestId: testId,
              answers: {},
              markedForReview: {},
              timeLeftSeconds: initialTimeSeconds,
              initialTimeSeconds,
              currentQuestionIndex: 0,
              isCalculatorOpen: false,
              isReferenceOpen: false,
            };
          }

          const lastQuestionIndex = Math.max(questionIds.length - 1, 0);

          return {
            initialTimeSeconds,
            currentQuestionIndex: Math.min(state.currentQuestionIndex, lastQuestionIndex),
          };
        }),
      
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
        set(() => ({ currentQuestionIndex: Math.max(0, index) })),
        
      decrementTime: () =>
        set((state) => ({
          timeLeftSeconds: Math.max(0, state.timeLeftSeconds - 1)
        })),
        
      resetExam: (testId, initialTimeSeconds) =>
        set(() => ({
          activeTestId: testId,
          answers: {},
          markedForReview: {},
          timeLeftSeconds: initialTimeSeconds,
          initialTimeSeconds,
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
        activeTestId: state.activeTestId,
        answers: state.answers,
        markedForReview: state.markedForReview,
        timeLeftSeconds: state.timeLeftSeconds,
        initialTimeSeconds: state.initialTimeSeconds,
        currentQuestionIndex: state.currentQuestionIndex,
      }),
    }
  )
);
