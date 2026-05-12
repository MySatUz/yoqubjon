export interface NormalizedAnswer {
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function normalizeStoredAnswer(
  storedAnswer: unknown,
  fallbackCorrectAnswer: string
): NormalizedAnswer {
  if (
    storedAnswer &&
    typeof storedAnswer === "object" &&
    !Array.isArray(storedAnswer)
  ) {
    const answer = storedAnswer as Record<string, unknown>;
    const userAnswer = normalizeText(answer.userAnswer);
    const correctAnswer = normalizeText(answer.correctAnswer) || fallbackCorrectAnswer;
    const isCorrect =
      typeof answer.isCorrect === "boolean"
        ? answer.isCorrect
        : answersMatch(userAnswer, correctAnswer);

    return {
      userAnswer,
      correctAnswer,
      isCorrect,
    };
  }

  const userAnswer = normalizeText(storedAnswer);

  return {
    userAnswer,
    correctAnswer: fallbackCorrectAnswer,
    isCorrect: answersMatch(userAnswer, fallbackCorrectAnswer),
  };
}

export function answersMatch(userAnswer: string, correctAnswer: string) {
  return userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
}
