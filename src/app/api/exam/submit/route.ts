import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  createExamResult,
  ExamSubmissionError,
  parseExamSubmissionBody,
} from '@/lib/examSubmission';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const submission = parseExamSubmissionBody(body);
    const result = await createExamResult(session.user.id, submission);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExamSubmissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Submission error:', error);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
