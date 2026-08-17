import { EXAM_DURATION_SECONDS, MAX_EXAM_DURATION_SECONDS } from '@/lib/examConfig';

export const MIN_MODULE_COUNT = 1;
export const MAX_MODULE_COUNT = 6;
export const DEFAULT_MODULE_COUNT = 2;
export const DEFAULT_MODULE_QUESTION_COUNT = 22;
export const DEFAULT_MODULE_DURATION_SECONDS = 35 * 60;

/** Any test row that carries the module configuration. */
export interface ModularTest {
  durationSeconds: number;
  moduleDurations: number[];
}

/** A module as the exam client needs it: its own clock and its own questions. */
export interface ExamModuleSpec {
  index: number;
  durationSeconds: number;
  questionIds: string[];
}

export interface ExamModule<Q> {
  index: number;
  durationSeconds: number;
  questions: Q[];
}

export function readModuleDurations(test: ModularTest): number[] {
  const durations = test.moduleDurations.filter(
    (duration) => Number.isInteger(duration) && duration > 0
  );

  return durations.length > 0
    ? durations
    : [test.durationSeconds || EXAM_DURATION_SECONDS];
}

export function isModularTest(test: ModularTest) {
  return readModuleDurations(test).length > 1;
}

export function getTotalDurationSeconds(test: ModularTest) {
  return readModuleDurations(test).reduce((total, duration) => total + duration, 0);
}

/**
 * Groups questions into their modules. Modules without questions are dropped so
 * a misconfigured test can never leave a student staring at an empty timer.
 */
export function buildExamModules<Q extends { moduleIndex: number }>(
  test: ModularTest,
  questions: Q[]
): ExamModule<Q>[] {
  const durations = readModuleDurations(test);
  const buckets: Q[][] = durations.map(() => []);

  for (const question of questions) {
    const bucketIndex = Math.min(Math.max(question.moduleIndex, 1), durations.length) - 1;
    buckets[bucketIndex].push(question);
  }

  return buckets
    .map((moduleQuestions, index) => ({
      durationSeconds: durations[index],
      questions: moduleQuestions,
    }))
    .filter((module) => module.questions.length > 0)
    .map((module, index) => ({ index: index + 1, ...module }));
}

export function toExamModuleSpecs<Q extends { id: string }>(
  modules: ExamModule<Q>[]
): ExamModuleSpec[] {
  return modules.map((module) => ({
    index: module.index,
    durationSeconds: module.durationSeconds,
    questionIds: module.questions.map((question) => question.id),
  }));
}

export function secondsToMinutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

/** Short label for module-based tests, or null for classic single-timer tests. */
export function formatModuleBadge(test: ModularTest) {
  const durations = readModuleDurations(test);
  if (durations.length < 2) return null;

  const minutes = durations.map(secondsToMinutes);
  const isUniform = minutes.every((value) => value === minutes[0]);

  return isUniform
    ? `${durations.length} modules x ${minutes[0]} min`
    : `${minutes.join(' + ')} min`;
}

export interface ExamFormatInput {
  /** Used only when the test has a single module. */
  durationSeconds: number;
  /** One duration per module, empty for single-module tests. */
  moduleDurations: number[];
  /** Fallback split used when the .tex file carries no module markers. */
  moduleQuestionCounts: number[];
}

export interface ResolvedExamModules {
  moduleIndexes: number[];
  moduleDurations: number[];
  durationSeconds: number;
}

function fitDurations(durations: number[], moduleCount: number) {
  if (durations.length >= moduleCount) {
    return durations.slice(0, moduleCount);
  }

  const fitted = [...durations];
  const lastDuration = durations[durations.length - 1] ?? DEFAULT_MODULE_DURATION_SECONDS;
  while (fitted.length < moduleCount) {
    fitted.push(lastDuration);
  }

  return fitted;
}

function totalsFor(durations: number[]) {
  const durationSeconds = durations.reduce((total, duration) => total + duration, 0);

  if (durationSeconds > MAX_EXAM_DURATION_SECONDS) {
    throw new Error(
      `Total test time must not exceed ${Math.floor(MAX_EXAM_DURATION_SECONDS / 60)} minutes`
    );
  }

  return {
    moduleDurations: durations.length > 1 ? durations : [],
    durationSeconds,
  };
}

/**
 * Decides which module every question belongs to and how long each module runs.
 * Module markers in the .tex file win; without them the questions are split by
 * the per-module counts entered in the admin form.
 */
export function resolveExamModules(input: {
  questionCount: number;
  /** Module index per question when the .tex file declares modules. */
  markerModules: number[] | null;
  format: ExamFormatInput;
}): ResolvedExamModules {
  const { questionCount, markerModules, format } = input;

  if (questionCount === 0) {
    throw new Error('No questions found in the .tex file');
  }

  if (markerModules) {
    const moduleCount = Math.max(...markerModules);

    if (format.moduleDurations.length < 2) {
      throw new Error(
        `The .tex file defines ${moduleCount} modules. Switch the test format to SAT modules, or remove the \\module markers.`
      );
    }

    return {
      moduleIndexes: markerModules,
      ...totalsFor(fitDurations(format.moduleDurations, moduleCount)),
    };
  }

  if (format.moduleDurations.length < 2) {
    return {
      moduleIndexes: Array.from({ length: questionCount }, () => 1),
      moduleDurations: [],
      durationSeconds: format.durationSeconds,
    };
  }

  const durations = format.moduleDurations;
  const moduleIndexes: number[] = [];

  for (let position = 0; position < durations.length; position++) {
    const isLastModule = position === durations.length - 1;
    const remaining = questionCount - moduleIndexes.length;
    const requested = format.moduleQuestionCounts[position] ?? DEFAULT_MODULE_QUESTION_COUNT;
    const take = isLastModule ? remaining : Math.min(requested, remaining);

    if (take <= 0) {
      throw new Error(
        `The .tex file has ${questionCount} questions, which is not enough for ${durations.length} modules. Lower the question counts or add \\module markers.`
      );
    }

    for (let i = 0; i < take; i++) {
      moduleIndexes.push(position + 1);
    }
  }

  return {
    moduleIndexes,
    ...totalsFor(durations),
  };
}
