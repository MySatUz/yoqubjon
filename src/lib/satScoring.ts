const SAT_MATH_REFERENCE_QUESTION_COUNT = 44;

const SAT_MATH_RAW_TO_SCORE: Record<number, number> = {
  0: 200,
  1: 200,
  2: 210,
  3: 220,
  4: 230,
  5: 240,
  6: 250,
  7: 260,
  8: 270,
  9: 280,
  10: 290,
  11: 300,
  12: 310,
  13: 320,
  14: 330,
  15: 340,
  16: 360,
  17: 370,
  18: 390,
  19: 400,
  20: 420,
  21: 430,
  22: 450,
  23: 460,
  24: 480,
  25: 500,
  26: 510,
  27: 530,
  28: 550,
  29: 560,
  30: 580,
  31: 600,
  32: 620,
  33: 640,
  34: 660,
  35: 680,
  36: 700,
  37: 720,
  38: 740,
  39: 750,
  40: 760,
  41: 780,
  42: 790,
  43: 800,
  44: 800,
};

export function estimateSatMathScore(correctCount: number, totalQuestions: number) {
  if (totalQuestions <= 0) return 200;

  const boundedCorrect = Math.min(Math.max(correctCount, 0), totalQuestions);
  const equivalentRawScore = Math.round(
    (boundedCorrect / totalQuestions) * SAT_MATH_REFERENCE_QUESTION_COUNT
  );

  return SAT_MATH_RAW_TO_SCORE[equivalentRawScore] ?? 200;
}
