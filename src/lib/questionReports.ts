/**
 * Question reports: a student's note, from the review of their result, that a
 * question is wrong. Kept in the platform (QuestionReport) for the admins, who
 * see the open ones under the Courses page's bell and close them once the
 * question is fixed.
 */

/** A report says what is wrong in a sentence or two; this leaves room to explain. */
export const MAX_REPORT_LENGTH = 1000;

/** How many open reports the bell lists before "N more". */
export const LISTED_REPORTS = 5;

/** "Module 2, question 14", or "Question 14" on a test that is one block. */
export function reportPlace(report: { moduleIndex: number; questionNumber: number }, isModular: boolean) {
  return isModular
    ? `Module ${report.moduleIndex}, question ${report.questionNumber}`
    : `Question ${report.questionNumber}`;
}

/**
 * Where an admin fixes the question: its bank page, which writes the change
 * through to every test showing it, or for an older row with no bank question
 * the test's own editor, scrolled to it.
 */
export function questionFixHref(question: { id: string; testId: string; bankQuestionId: string | null }) {
  return question.bankQuestionId
    ? `/admin/bank/${question.bankQuestionId}`
    : `/admin/tests/${question.testId}#question-${question.id}`;
}
