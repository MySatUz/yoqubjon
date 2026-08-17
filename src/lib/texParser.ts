import katex from 'katex';
import { MAX_MODULE_COUNT } from '@/lib/examModules';

export interface ParsedQuestion {
  order: number;
  content: string;
  options: string[];
  correctAnswer: string;
  image?: string;
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

function parseOptionsBlock(optionsRaw: string) {
  const options: string[] = [];
  const lines = optionsRaw.replace(/\r\n/g, '\n').split('\n');
  let current: string[] = [];

  function pushCurrent() {
    const value = normalizeLatexText(current.join('\n'));
    if (value) options.push(value);
    current = [];
  }

  for (const line of lines) {
    const labelledOption = line.match(/^\s*([A-Ha-h])\s*[:.)]\s*(.*)$/);
    const itemOption = line.match(/^\s*\\item(?:\s*\[\s*([A-Ha-h])\s*\])?\s*(.*)$/);

    if (labelledOption || itemOption) {
      pushCurrent();
      current.push(labelledOption ? labelledOption[2] : itemOption?.[2] || '');
      continue;
    }

    current.push(line);
  }

  pushCurrent();
  return options;
}

/**
 * Helper to extract content inside a LaTeX command like \content{...}
 * Handles whitespace before the opening brace and nested escaped braces.
 */
function extractTagContent(block: string, tagName: string): string | undefined {
  const tagRegex = new RegExp(`\\\\${tagName}\\s*\\{`);
  const match = tagRegex.exec(block);
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
  return undefined;
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

function validateQuestion(question: ParsedQuestion) {
  if (!question.content) {
    throw new TexParseError(`Question ${question.order} is missing \\content{...}`);
  }

  if (!question.correctAnswer) {
    throw new TexParseError(`Question ${question.order} is missing \\answer{...}`);
  }

  if (question.options.length === 1) {
    throw new TexParseError(`Question ${question.order} has only one option. Use at least two options or remove \\options{...} for grid-in answers.`);
  }

  const answerLetter = question.correctAnswer.trim().toUpperCase();
  if (/^[A-H]$/.test(answerLetter) && question.options.length > 0) {
    const answerIndex = answerLetter.charCodeAt(0) - 65;
    if (answerIndex >= question.options.length) {
      throw new TexParseError(`Question ${question.order} answer is ${answerLetter}, but only ${question.options.length} options were found.`);
    }
  }

  validateMath(question.content, question.order, 'content');
  for (const [index, option] of question.options.entries()) {
    validateMath(question.options[index], question.order, `option ${String.fromCharCode(65 + index)}`);
    question.options[index] = option;
  }
  validateMath(question.correctAnswer, question.order, 'answer');
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
  let tokenMatch;

  TEX_TOKEN_REGEX.lastIndex = 0;

  while ((tokenMatch = TEX_TOKEN_REGEX.exec(cleanedTexContent)) !== null) {
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

    const content = normalizeLatexText(
      extractTagContent(questionBlock, 'content') || ''
    );

    const image = extractTagContent(questionBlock, 'image')?.trim();

    const optionsRaw = extractTagContent(questionBlock, 'options');
    const options = optionsRaw ? parseOptionsBlock(optionsRaw) : [];

    const correctAnswer = normalizeLatexText(extractTagContent(questionBlock, 'answer') || "");

    const question = {
      order: order++,
      content,
      options,
      correctAnswer,
      image
    };

    validateQuestion(question);
    questions.push(question);
    moduleIndexes.push(currentModule);
  }

  if (!hasModuleMarkers || questions.length === 0) {
    return { questions, moduleIndexes: null };
  }

  validateModuleIndexes(moduleIndexes);

  return { questions, moduleIndexes };
}
