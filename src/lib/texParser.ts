export interface ParsedQuestion {
  order: number;
  content: string;
  options: string[];
  correctAnswer: string;
  image?: string;
}

/**
 * Helper to extract content inside a LaTeX command like \content{...}
 * handles nested braces correctly.
 */
function extractTagContent(block: string, tagName: string): string | undefined {
  const tag = `\\${tagName}{`;
  const startIdx = block.indexOf(tag);
  if (startIdx === -1) return undefined;

  let contentStart = startIdx + tag.length;
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
    const content = extractTagContent(block, 'content') || "Missing content";

    // 2. Extract Image
    const image = extractTagContent(block, 'image');

    // 3. Extract Options
    const options: string[] = [];
    const optionsRaw = extractTagContent(block, 'options');
    if (optionsRaw) {
      // Match "A: some text", "B: some text", etc.
      const optionRegex = /([A-D]):\s*([\s\S]*?)(?=[A-D]:|$)/g;
      let optMatch;
      while ((optMatch = optionRegex.exec(optionsRaw)) !== null) {
        options.push(optMatch[2].trim());
      }
    }

    // 4. Extract Answer
    const correctAnswer = extractTagContent(block, 'answer') || "";

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
