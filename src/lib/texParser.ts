export interface ParsedQuestion {
  order: number;
  content: string;
  options: string[];
  correctAnswer: string;
  image?: string;
}

function normalizeLatexText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseOptionsBlock(optionsRaw: string) {
  const options: string[] = [];
  const optionRegex = /^\s*([A-D]):\s*([\s\S]*?)(?=^\s*[A-D]:\s*|\s*$)/gm;
  let optMatch: RegExpExecArray | null;

  while ((optMatch = optionRegex.exec(optionsRaw)) !== null) {
    options.push(normalizeLatexText(optMatch[2]));
  }

  return options;
}

/**
 * Helper to extract content inside a LaTeX command like \content{...}
 * handles nested braces correctly.
 */
function extractTagContent(block: string, tagName: string): string | undefined {
  const tag = `\\${tagName}{`;
  const startIdx = block.indexOf(tag);
  if (startIdx === -1) return undefined;

  const contentStart = startIdx + tag.length;
  let bracketCount = 1;
  let i = contentStart;

  while (i < block.length && bracketCount > 0) {
    if (block[i] === '{') bracketCount++;
    else if (block[i] === '}') bracketCount--;
    i++;
  }

  if (bracketCount === 0) {
    return block.substring(contentStart, i - 1).trim();
  }
  return undefined;
}

export function parseTexFile(texContent: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  
  const questionBlockRegex = /\\begin\{question\}([\s\S]*?)\\end\{question\}/g;
  let blockMatch;
  let order = 1;

  while ((blockMatch = questionBlockRegex.exec(texContent)) !== null) {
    const block = blockMatch[1];

    // 1. Extract Content with nested brace support
    const content = normalizeLatexText(
      extractTagContent(block, 'content') || "Missing content"
    );

    // 2. Extract Image
    const image = extractTagContent(block, 'image')?.trim();

    // 3. Extract Options
    const optionsRaw = extractTagContent(block, 'options');
    const options = optionsRaw ? parseOptionsBlock(optionsRaw) : [];

    // 4. Extract Answer
    const correctAnswer = normalizeLatexText(extractTagContent(block, 'answer') || "");

    questions.push({
      order: order++,
      content,
      options,
      correctAnswer,
      image
    });
  }

  return questions;
}
