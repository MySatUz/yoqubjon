import katex from 'katex';
import { MAX_MODULE_COUNT } from '@/lib/examModules';
import { formatAnswerLetters, parseAnswerLetters } from '@/lib/resultAnswers';
import {
  parseDifficultyTag,
  parseDomainTag,
  type BankDifficulty,
  type BankDomain,
} from '@/lib/questionBank';

export interface ParsedQuestion {
  order: number;
  content: string;
  options: string[];
  correctAnswer: string;
  image?: string;
  /**
   * The question bank's tags, `\domain{algebra}` and `\difficulty{2}` inside
   * the question block. Both are optional: the import preview asks for the
   * missing ones. The raw text is kept beside the parsed value so the
   * preview can say what the file wrote when it names nothing the bank knows
   * ("Unknown domain 'calculus'").
   */
  domainTag?: string;
  difficultyTag?: string;
  /** Null when there is no tag or the tag names no domain. */
  domain: BankDomain | null;
  /** Null when there is no tag or the tag is not 1-3 / easy-hard. */
  difficulty: BankDifficulty | null;
}

export interface ParsedTex {
  questions: ParsedQuestion[];
  /**
   * Module index per question, aligned with `questions`. Null when the file
   * declares no modules, which keeps the classic single-timer format working.
   */
  moduleIndexes: number[] | null;
}

export class TexParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TexParseError';
  }
}

function normalizeLatexText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isEscaped(value: string, index: number) {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

function stripLatexComments(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '%' && !isEscaped(line, i)) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

/** Choices are lettered A-H, as the exam screen and the answer keys read them. */
const MAX_OPTION_COUNT = 8;

/** The tags the importer reads in a question block; any other is ignored. */
const QUESTION_TAGS = ['content', 'image', 'options', 'answer', 'domain', 'difficulty'] as const;

function tagPattern(tagName: string, flags = '') {
  return new RegExp(`\\\\${tagName}\\s*\\{`, flags);
}

interface ParsedOption {
  text: string;
  /**
   * The letter written before it, upper-cased (`B:`, `b)`, `\item[B]`). Null
   * for a bare `\item`, and for text before the first label.
   */
  label: string | null;
}

function parseOptionsBlock(optionsRaw: string) {
  const options: ParsedOption[] = [];
  const lines = optionsRaw.replace(/\r\n/g, '\n').split('\n');
  let current: string[] = [];
  let label: string | null = null;
  let started = false;

  function pushCurrent() {
    const value = normalizeLatexText(current.join('\n'));
    // Text before the first label counts only when there is some; a labelled
    // option is kept even when empty, so the check can name it.
    if (value || started) options.push({ text: value, label });
    current = [];
  }

  for (const line of lines) {
    // `I:` after the eighth option is read as a ninth, so the count check
    // stops it, instead of being glued onto option H.
    const labelledOption =
      line.match(/^\s*([A-Ha-h])\s*[:.)]\s*(.*)$/) ??
      (started && options.length === MAX_OPTION_COUNT - 1 ? line.match(/^\s*(I)\s*[:.)]\s*(.*)$/) : null);
    const itemOption = line.match(/^\s*\\item(?:\s*\[\s*([A-Ha-h])\s*\])?\s*(.*)$/);

    if (labelledOption || itemOption) {
      pushCurrent();
      started = true;
      label = (labelledOption?.[1] ?? itemOption?.[1])?.toUpperCase() ?? null;
      current.push(labelledOption ? labelledOption[2] : itemOption?.[2] || '');
      continue;
    }

    current.push(line);
  }

  pushCurrent();
  return options;
}

/**
 * The inside of a tag such as \content{...} in question `order`'s block, or
 * undefined when the block has no such tag. Nested braces count, escaped \{
 * and \} do not. Braces that never close stop the import: read as no tag, a
 * question's choices vanished and it went in as a grid-in.
 */
function extractTagContent(block: string, tagName: string, order: number): string | undefined {
  const match = tagPattern(tagName).exec(block);
  if (!match) return undefined;

  const contentStart = match.index + match[0].length;
  let bracketCount = 1;
  let i = contentStart;

  while (i < block.length && bracketCount > 0) {
    if (block[i] === '{' && !isEscaped(block, i)) bracketCount++;
    else if (block[i] === '}' && !isEscaped(block, i)) bracketCount--;
    i++;
  }

  if (bracketCount === 0) {
    return block.substring(contentStart, i - 1).trim();
  }
  throw new TexParseError(
    `Question ${order} has a \\${tagName}{...} whose braces do not close. Check for a missing }, or write \\{ for a literal brace.`
  );
}

type MathSegment = {
  formula: string;
  displayMode: boolean;
  delimiter: string;
};

function findClosingDelimiter(value: string, delimiter: string, startIndex: number) {
  let index = startIndex;
  while (index < value.length) {
    const foundIndex = value.indexOf(delimiter, index);
    if (foundIndex === -1) return -1;
    if (!isEscaped(value, foundIndex)) return foundIndex;
    index = foundIndex + delimiter.length;
  }
  return -1;
}

function extractMathSegments(value: string) {
  const segments: MathSegment[] = [];
  let index = 0;

  while (index < value.length) {
    if (value.startsWith('\\[', index)) {
      const end = findClosingDelimiter(value, '\\]', index + 2);
      if (end === -1) throw new TexParseError('Missing closing \\] in a display formula');
      segments.push({ formula: value.slice(index + 2, end), displayMode: true, delimiter: '\\[...\\]' });
      index = end + 2;
      continue;
    }

    if (value.startsWith('\\(', index)) {
      const end = findClosingDelimiter(value, '\\)', index + 2);
      if (end === -1) throw new TexParseError('Missing closing \\) in an inline formula');
      segments.push({ formula: value.slice(index + 2, end), displayMode: false, delimiter: '\\(...\\)' });
      index = end + 2;
      continue;
    }

    if (value.startsWith('$$', index) && !isEscaped(value, index)) {
      const end = findClosingDelimiter(value, '$$', index + 2);
      if (end === -1) throw new TexParseError('Missing closing $$ in a display formula');
      segments.push({ formula: value.slice(index + 2, end), displayMode: true, delimiter: '$$...$$' });
      index = end + 2;
      continue;
    }

    if (value[index] === '$' && !isEscaped(value, index)) {
      const end = findClosingDelimiter(value, '$', index + 1);
      if (end === -1) throw new TexParseError('Missing closing $ in an inline formula');
      segments.push({ formula: value.slice(index + 1, end), displayMode: false, delimiter: '$...$' });
      index = end + 1;
      continue;
    }

    index++;
  }

  return segments;
}

function validateMath(value: string, questionOrder: number, fieldName: string) {
  const segments = extractMathSegments(value);

  for (const segment of segments) {
    try {
      katex.renderToString(segment.formula, {
        displayMode: segment.displayMode,
        throwOnError: true,
        strict: 'warn',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid formula';
      throw new TexParseError(`Question ${questionOrder} has invalid math in ${fieldName} (${segment.delimiter}): ${message}`);
    }
  }
}

function validateQuestion(question: ParsedQuestion, optionLabels: (string | null)[]) {
  if (!question.content) {
    throw new TexParseError(`Question ${question.order} is missing \\content{...}`);
  }

  if (!question.correctAnswer) {
    throw new TexParseError(`Question ${question.order} is missing \\answer{...}`);
  }

  if (question.options.length > MAX_OPTION_COUNT) {
    throw new TexParseError(
      `Question ${question.order} has ${question.options.length} options. A question can have at most ${MAX_OPTION_COUNT}, A–H.`
    );
  }

  for (const [index, option] of question.options.entries()) {
    const letter = String.fromCharCode(65 + index);
    if (!option) {
      throw new TexParseError(`Question ${question.order} has an empty option ${letter}. Write its text, or remove its label.`);
    }

    // Options are lettered by their place, so a label out of order would
    // point the answer at another choice than the one the file names.
    const label = optionLabels[index];
    if (label && label !== letter) {
      throw new TexParseError(
        `Question ${question.order} has option ${letter} labelled ${label}. Label the options A, B, C… in order.`
      );
    }
  }

  if (question.options.length === 1) {
    throw new TexParseError(`Question ${question.order} has only one option. Use at least two options or remove \\options{...} for grid-in answers.`);
  }

  const answerLetters = parseAnswerLetters(question.correctAnswer);
  const isMultiSelect = answerLetters !== null && answerLetters.length > 1;

  // `\answer{B, C}` is the only thing that makes a question multi-select, so a
  // letter list with nothing to select from is always a mistake rather than a
  // grid-in value that happens to look like one.
  if (isMultiSelect && question.options.length === 0) {
    throw new TexParseError(
      `Question ${question.order} answer lists several options (${answerLetters.join(', ')}) but the question has no \\options{...}.`
    );
  }

  if (answerLetters && question.options.length > 0) {
    if (new Set(answerLetters).size !== answerLetters.length) {
      throw new TexParseError(`Question ${question.order} answer repeats an option letter.`);
    }

    for (const letter of answerLetters) {
      if (letter.charCodeAt(0) - 65 >= question.options.length) {
        throw new TexParseError(`Question ${question.order} answer is ${letter}, but only ${question.options.length} options were found.`);
      }
    }

    // Stored sorted and without spaces, so `B, C` and `C,B` are one key and the
    // grader never has to care which order the author wrote. A single letter is
    // left exactly as written: rewriting it would also rewrite grid-in-style
    // keys such as `\(C\)` that already round-trip through `answersMatch`.
    if (isMultiSelect) {
      question.correctAnswer = formatAnswerLetters(answerLetters);
    }
  }

  validateMath(question.content, question.order, 'content');
  for (const [index, option] of question.options.entries()) {
    validateMath(question.options[index], question.order, `option ${String.fromCharCode(65 + index)}`);
    question.options[index] = option;
  }
  validateMath(question.correctAnswer, question.order, 'answer');
}

/**
 * Text between question blocks is ignored - a preamble, comments, module
 * markers - but not the pieces of a question. An \end{question} or a tag
 * there is a block never opened, a \begin{question} there one never closed;
 * read as they stood, they dropped a question without a word.
 */
function checkBetweenQuestions(text: string, nextOrder: number) {
  const place = nextOrder === 1 ? 'before the first question' : `after question ${nextOrder - 1}`;

  if (text.includes('\\end{question}')) {
    throw new TexParseError(`The \\end{question} ${place} has no \\begin{question}. Add the \\begin{question}, or remove it.`);
  }

  if (text.includes('\\begin{question}')) {
    throw new TexParseError(`Question ${nextOrder} has no \\end{question}. Add one at the end of the question.`);
  }

  const looseTag = QUESTION_TAGS.find((tag) => tagPattern(tag).test(text));
  if (looseTag) {
    throw new TexParseError(
      `The \\${looseTag}{...} ${place} is outside a question. Put it between \\begin{question} and \\end{question}.`
    );
  }
}

function validateModuleIndexes(moduleIndexes: number[]) {
  const moduleCount = Math.max(...moduleIndexes);

  for (let moduleNumber = 1; moduleNumber <= moduleCount; moduleNumber++) {
    if (!moduleIndexes.includes(moduleNumber)) {
      throw new TexParseError(
        `Module ${moduleNumber} has no questions. Number the modules from 1 to ${moduleCount} without gaps.`
      );
    }
  }
}

/**
 * Matches one question block, or a module marker between blocks. Module markers
 * inside a question body are part of that block's match and stay untouched.
 */
const TEX_TOKEN_REGEX = new RegExp(
  [
    /\\begin\{question\}([\s\S]*?)\\end\{question\}/.source,
    /\\module\s*\{\s*(\d+)\s*\}/.source,
    /\\begin\{module\}(?:\s*\[\s*(\d+)\s*\])?/.source,
    /\\newmodule\b/.source,
  ].join('|'),
  'g'
);

export function parseTexFile(texContent: string): ParsedTex {
  const questions: ParsedQuestion[] = [];
  const moduleIndexes: number[] = [];
  const cleanedTexContent = stripLatexComments(texContent);

  let hasModuleMarkers = false;
  let currentModule = 1;
  let order = 1;
  let scannedTo = 0;
  let tokenMatch;

  TEX_TOKEN_REGEX.lastIndex = 0;

  while ((tokenMatch = TEX_TOKEN_REGEX.exec(cleanedTexContent)) !== null) {
    checkBetweenQuestions(cleanedTexContent.slice(scannedTo, tokenMatch.index), order);
    scannedTo = TEX_TOKEN_REGEX.lastIndex;

    const [token, questionBlock, explicitModule, startedModule] = tokenMatch;

    if (questionBlock === undefined) {
      const requestedModule = explicitModule ?? startedModule;

      if (requestedModule) {
        currentModule = Number(requestedModule);
      } else if (token.startsWith('\\newmodule')) {
        currentModule += 1;
      } else {
        // \begin{module} without a number: the first one opens module 1, every
        // following one opens the next module.
        currentModule = hasModuleMarkers ? currentModule + 1 : 1;
      }

      if (!Number.isInteger(currentModule) || currentModule < 1 || currentModule > MAX_MODULE_COUNT) {
        throw new TexParseError(
          `Module number must be between 1 and ${MAX_MODULE_COUNT}`
        );
      }

      hasModuleMarkers = true;
      continue;
    }

    // The block runs to the first \end{question}, so a question that never
    // closed has the next one inside it.
    if (questionBlock.includes('\\begin{question}')) {
      throw new TexParseError(
        `Question ${order} has no \\end{question} before the next \\begin{question}. Add one at the end of the question.`
      );
    }

    // Only the first of a repeated tag would be read.
    for (const tag of QUESTION_TAGS) {
      if ((questionBlock.match(tagPattern(tag, 'g')) ?? []).length > 1) {
        throw new TexParseError(`Question ${order} has two \\${tag}{...}. Keep one.`);
      }
    }

    const content = normalizeLatexText(
      extractTagContent(questionBlock, 'content', order) || ''
    );

    const image = extractTagContent(questionBlock, 'image', order)?.trim();

    const optionsRaw = extractTagContent(questionBlock, 'options', order);
    const options = optionsRaw ? parseOptionsBlock(optionsRaw) : [];

    const correctAnswer = normalizeLatexText(extractTagContent(questionBlock, 'answer', order) || "");

    // Empty braces count as no tag, so `\domain{}` left in a template asks
    // for a domain instead of reporting an unknown one.
    const domainTag = extractTagContent(questionBlock, 'domain', order)?.trim() || undefined;
    const difficultyTag = extractTagContent(questionBlock, 'difficulty', order)?.trim() || undefined;

    const question: ParsedQuestion = {
      order: order++,
      content,
      options: options.map((option) => option.text),
      correctAnswer,
      image,
      domainTag,
      difficultyTag,
      domain: parseDomainTag(domainTag),
      difficulty: parseDifficultyTag(difficultyTag),
    };

    validateQuestion(question, options.map((option) => option.label));
    questions.push(question);
    moduleIndexes.push(currentModule);
  }

  checkBetweenQuestions(cleanedTexContent.slice(scannedTo), order);

  if (!hasModuleMarkers || questions.length === 0) {
    return { questions, moduleIndexes: null };
  }

  validateModuleIndexes(moduleIndexes);

  return { questions, moduleIndexes };
}
