import { redirect } from 'next/navigation';

/**
 * Kept only as a redirect.
 *
 * This route used to render its own breakdown of a finished attempt, listing
 * every question's correct answer on one page — the whole answer key of a test,
 * one `Ctrl+P` away, reachable by anyone who swapped `/dashboard/results/<id>`
 * for `/exam/review/<id>` in the address bar. Nothing linked to it, and
 * `/dashboard/results/[id]` shows the same attempt with the questions opened
 * one at a time instead - the correct answer and the student's own, no
 * explanations (the owner's rule) - so the page is gone and its URL now lands
 * there. That includes an olympiad attempt while the olympiad is still on: the
 * result page then says when its questions open, and shows none of them.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;

  redirect(`/dashboard/results/${resultId}`);
}
