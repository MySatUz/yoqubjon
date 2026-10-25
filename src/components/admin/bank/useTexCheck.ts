'use client';

import { useCallback, useRef, useState } from 'react';
import { checkTexFile } from '@/app/admin/bank/actions';
import { isTagged, type QuestionTagDraft, type TexCheckResult } from '@/lib/questionBank';

export type TexCheckState =
  | { status: 'idle' }
  | { status: 'checking'; fileName: string }
  | { status: 'checked'; result: TexCheckResult };

/**
 * The "Check questions" step of a `.tex` import, shared by the course's test
 * upload and the bank's: parses the chosen file on the server, then holds the
 * tag each question will go into the bank with - the file's own, until the
 * admin picks another in the preview.
 *
 * A newer file wins: the answer to an older check that arrives late is
 * dropped, so the preview never describes a file that is no longer chosen.
 */
export function useTexCheck() {
  const [state, setState] = useState<TexCheckState>({ status: 'idle' });
  const [tags, setTags] = useState<QuestionTagDraft[]>([]);
  const requestRef = useRef(0);

  const reset = useCallback(() => {
    requestRef.current += 1;
    setState({ status: 'idle' });
    setTags([]);
  }, []);

  const check = useCallback(async (file: File | null | undefined) => {
    if (!file) {
      reset();
      return;
    }

    const request = ++requestRef.current;
    setState({ status: 'checking', fileName: file.name });

    const formData = new FormData();
    formData.set('texFile', file);

    let result: TexCheckResult;
    try {
      result = await checkTexFile(formData);
    } catch {
      result = { success: false, error: 'The file could not be checked. Check your connection and choose it again.' };
    }

    if (request !== requestRef.current) return;

    setState({ status: 'checked', result });
    setTags(result.success
      ? result.questions.map((question) => ({ domain: question.domain, difficulty: question.difficulty }))
      : []);
  }, [reset]);

  const questions = state.status === 'checked' && state.result.success ? state.result.questions : null;
  const untagged = questions ? tags.filter((tag) => !isTagged(tag)).length : 0;

  return { state, questions, tags, setTags, check, reset, untagged };
}

/**
 * The names `\image{…}` asks for that are not among the chosen files, in file
 * order, each once. The server matches them the same way, by exact name.
 */
export function findMissingImages(
  questions: { image: string | null }[] | null,
  chosenNames: readonly string[],
) {
  if (!questions) return [];
  const chosen = new Set(chosenNames);
  return [...new Set(
    questions.map((question) => question.image).filter((name): name is string => Boolean(name) && !chosen.has(name!)),
  )];
}
