import { redirect } from 'next/navigation';

/**
 * Kept only as a redirect.
 *
 * This route used to render its own breakdown of a finished attempt, listing
 * every question's correct answer on one page — the whole answer key of a test,
 * one `Ctrl+P` away, reachable by anyone who swapped `/dashboard/results/<id>`
 * for `/exam/review/<id>` in the address bar. Nothing linked to it, and
 * `/dashboard/results/[id]` shows the same attempt with the questions opened
 * one at a time instead, video explanations included, so the page is gone and
 * its URL now lands there.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;

  redirect(`/dashboard/results/${resultId}`);
}
