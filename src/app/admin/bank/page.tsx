import 'katex/dist/katex.min.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Library, Search, SearchX, Upload } from 'lucide-react';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/formatDate';
import {
  BANK_DIFFICULTIES,
  BANK_DOMAINS,
  BANK_PAGE_SIZES,
  EMPTY_BANK_FILTERS,
  bankListHref,
  getDifficultyLabel,
  getDomainShortLabel,
  hasBankFilters,
  isBankDifficulty,
  isBankDomain,
  readBankFilters,
} from '@/lib/questionBank';
import { bankQuestionWhere, countTestsUsing, readOptions } from '@/lib/questionBankServer';
import { isMultiSelectKey } from '@/lib/resultAnswers';
import { renderQuestionPreview } from '@/app/admin/tests/questionPreview';
import { DifficultyBars, KindBadge, choiceTileClass } from '@/components/admin/bank/bankBadges';
import { linkRowClass, rowLinkClass } from '@/components/admin/adminControls';
import { Badge } from '@/components/ui/Badge';
import { buttonClass, focusRingClass } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { checkboxClass, inputClass, labelClass } from '@/components/ui/Field';
import { List, listRowInteractiveClass, rowChevronClass, tableClass, tableWrapClass, tdClass, thClass } from '@/components/ui/List';
import { segmentClass, segmentedClass } from '@/components/ui/Misc';
import { Page, PageHeader } from '@/components/ui/Page';
import { cn } from '@/components/ui/cn';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata: Metadata = { title: 'Question bank' };

function formatCount(count: number) {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

const tileClass = choiceTileClass;

/** 1 … 4 5 6 … 12: the first, the last, and the pages around this one. */
function pageItems(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  for (const [index, n] of sorted.entries()) {
    if (index > 0 && n - sorted[index - 1] > 1) items.push('gap');
    items.push(n);
  }
  return items;
}

const pageLinkClass = cn(
  'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-medium tabular-nums transition-colors pointer-coarse:h-10 pointer-coarse:min-w-10',
  focusRingClass,
);
const pageIdleClass = 'border-gray-400 border-b-gray-500 bg-white text-gray-700 shadow-xs hover:bg-gray-50';
const pageOffClass = 'border-gray-200 bg-gray-100 text-gray-400';

/**
 * The question bank. Like the College Board's educator bank it opens on the
 * search, not on a list: pick domains and difficulties (each with its count),
 * or type words from a question, then Search. Matching questions come back as
 * a table - difficulty as bars, the domain, the question itself typeset - and
 * nothing is listed before that (the owner's call: the whole bank as one long
 * list was a page of text to scroll, and the bank only grows).
 *
 * A plain GET form: the choices are in the URL, so a result survives a
 * reload and the back button, and the page needs no script to search.
 */
export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const { filters, page, size } = readBankFilters(await searchParams);
  const where = bankQuestionWhere(filters);
  const skip = (page - 1) * size;
  const filtered = hasBankFilters(filters);

  const [total, matching, unsorted, rows, byDomain, byDifficulty] = await Promise.all([
    prisma.bankQuestion.count(),
    filtered ? prisma.bankQuestion.count({ where }) : Promise.resolve(0),
    prisma.bankQuestion.count({ where: { OR: [{ domain: null }, { difficulty: null }] } }),
    filtered
      ? prisma.bankQuestion.findMany({
          where,
          // Newest import first, each in its file's order (see buildBankRows).
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip,
          take: size,
          select: {
            id: true,
            content: true,
            options: true,
            correctAnswer: true,
            domain: true,
            difficulty: true,
            source: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    prisma.bankQuestion.groupBy({ by: ['domain'], _count: { _all: true } }),
    prisma.bankQuestion.groupBy({ by: ['difficulty'], _count: { _all: true } }),
  ]);
  const usage = await countTestsUsing(rows.map((row) => row.id));
  const domainCount = (value: string) => byDomain.find((group) => group.domain === value)?._count._all ?? 0;
  const difficultyCount = (value: number) => byDifficulty.find((group) => group.difficulty === value)?._count._all ?? 0;

  const totalPages = Math.max(1, Math.ceil(matching / size));
  const uploadLink = (
    <Link href="/admin/bank/upload" prefetch={false} className={buttonClass()}>
      <Upload className="h-4 w-4" />
      Upload .tex
    </Link>
  );

  const rowFacts = rows.map((row) => {
    const options = readOptions(row.options);
    return {
      ...row,
      kind: options.length === 0
        ? 'grid-in' as const
        : isMultiSelectKey(row.correctAnswer) ? 'multi-select' as const : 'choice' as const,
      // Typeset on the server; empty only for a question that is all image.
      preview: renderQuestionPreview(row.content) || '<span class="text-gray-500">Image only</span>',
      tests: usage.get(row.id) ?? 0,
    };
  });

  return (
    <Page>
      <PageHeader
        title="Question bank"
        description="Every question imported since the bank exists, by SAT Math domain and difficulty. Tests copy their questions from here."
        actions={total > 0 ? uploadLink : undefined}
      />

      {total === 0 ? (
        <EmptyState
          icon={<Library />}
          title="The question bank is empty"
          description="Upload a .tex file, or import a test into a course: its questions land here."
          action={uploadLink}
        />
      ) : (
        <>
          <form action="/admin/bank" method="get" role="search" aria-label="Find questions" className={cardClass}>
            {size !== BANK_PAGE_SIZES[0] && <input type="hidden" name="size" value={size} />}
            <div className="space-y-5 p-5">
              <fieldset className="space-y-2">
                <legend className={labelClass}>Domain</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
                  {BANK_DOMAINS.map((domain) => (
                    <label key={domain.value} className={tileClass}>
                      <input
                        type="checkbox"
                        name="domain"
                        value={domain.value}
                        defaultChecked={filters.domains.includes(domain.value)}
                        className={checkboxClass}
                      />
                      <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">{domain.label}</span>
                      <span className="text-xs tabular-nums text-gray-500">{domainCount(domain.value)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className={labelClass}>Difficulty</legend>
                <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-3', unsorted > 0 && 'xl:grid-cols-4')}>
                  {BANK_DIFFICULTIES.map((difficulty) => (
                    <label key={difficulty.value} className={tileClass}>
                      <input
                        type="checkbox"
                        name="difficulty"
                        value={difficulty.value}
                        defaultChecked={filters.difficulties.includes(difficulty.value)}
                        className={checkboxClass}
                      />
                      <DifficultyBars level={difficulty.value} />
                      <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">{difficulty.label}</span>
                      <span className="text-xs tabular-nums text-gray-500">{difficultyCount(difficulty.value)}</span>
                    </label>
                  ))}
                  {/* Only while there is something to sort, or the filter is on. */}
                  {(unsorted > 0 || filters.unsorted) && (
                    <label className={tileClass}>
                      <input
                        type="checkbox"
                        name="unsorted"
                        value="1"
                        defaultChecked={filters.unsorted}
                        className={checkboxClass}
                      />
                      <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">Not sorted yet</span>
                      <span className="text-xs tabular-nums text-gray-500">{unsorted}</span>
                    </label>
                  )}
                </div>
              </fieldset>

              <div className="space-y-2">
                <label htmlFor="bank-search" className={labelClass}>Words in the question or file name</label>
                <div className="relative max-w-xl">
                  <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="bank-search"
                    type="search"
                    name="q"
                    defaultValue={filters.q}
                    maxLength={100}
                    placeholder="e.g. circle, f(x), geometry-set-oct"
                    autoComplete="off"
                    className={inputClass({ className: 'pl-9' })}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3">
              <p className="mr-auto text-xs tabular-nums text-gray-500">{formatCount(total)} in the bank</p>
              {filtered && (
                <Link href={bankListHref(EMPTY_BANK_FILTERS, 1, size)} prefetch={false} className={buttonClass({ variant: 'secondary' })}>
                  Clear
                </Link>
              )}
              <button type="submit" className={buttonClass()}>
                <Search className="h-4 w-4" />
                Search
              </button>
            </div>
          </form>

          {filtered && (
            <section aria-labelledby="bank-results" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="bank-results" className="text-base font-semibold tabular-nums text-gray-900">
                  {matching === 0 ? 'No questions found' : `${formatCount(matching)} found`}
                </h2>
                {matching > BANK_PAGE_SIZES[0] && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Per page</span>
                    <nav aria-label="Questions per page" className={segmentedClass}>
                      {BANK_PAGE_SIZES.map((option) => (
                        <Link
                          key={option}
                          href={bankListHref(filters, 1, option)}
                          prefetch={false}
                          aria-current={option === size ? 'true' : undefined}
                          className={segmentClass(option === size, 'tabular-nums')}
                        >
                          {option}
                        </Link>
                      ))}
                    </nav>
                  </div>
                )}
              </div>

              {rowFacts.length === 0 ? (
                <EmptyState
                  icon={<SearchX />}
                  title={matching > 0 ? 'No questions on this page' : 'Nothing matches these choices'}
                  action={
                    <Link
                      href={matching > 0 ? bankListHref(filters, 1, size) : bankListHref(EMPTY_BANK_FILTERS, 1, size)}
                      prefetch={false}
                      className={buttonClass({ variant: 'secondary', size: 'sm' })}
                    >
                      {matching > 0 ? 'Go to the first page' : 'Clear the search'}
                    </Link>
                  }
                />
              ) : (
                <>
                  {/* Desktop: a table; the whole row opens the question (see `linkRowClass`). */}
                  <div className={cn(tableWrapClass, 'hidden md:block')}>
                    <table className={tableClass}>
                      <caption className="sr-only">Questions found</caption>
                      <thead>
                        <tr>
                          <th scope="col" className={thClass}>Question</th>
                          <th scope="col" className={thClass}>Domain</th>
                          <th scope="col" className={thClass}>Difficulty</th>
                          <th scope="col" className={cn(thClass, 'text-right')}>Tests</th>
                          <th scope="col" className={thClass}>Added</th>
                          <th scope="col" className={cn(thClass, 'w-10')}><span className="sr-only">Open</span></th>
                        </tr>
                      </thead>
                      <tbody className="[&>tr:last-child>td]:border-b-0">
                        {rowFacts.map((row) => (
                          <tr key={row.id} className={cn(linkRowClass, 'group')}>
                            <td className={cn(tdClass, 'w-full max-w-0')}>
                              <Link href={`/admin/bank/${row.id}`} prefetch={false} className={cn(rowLinkClass, 'block font-normal')}>
                                <span className="line-clamp-2 text-gray-800" dangerouslySetInnerHTML={{ __html: row.preview }} />
                              </Link>
                              {(row.kind !== 'choice' || row.source) && (
                                <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                  <KindBadge kind={row.kind} />
                                  {row.source && <span className="truncate">{row.source}</span>}
                                </span>
                              )}
                            </td>
                            <td className={cn(tdClass, 'whitespace-nowrap')}>
                              {isBankDomain(row.domain) ? getDomainShortLabel(row.domain) : <Badge tone="warning">Not sorted</Badge>}
                            </td>
                            <td className={cn(tdClass, 'whitespace-nowrap')}>
                              <span className="flex items-center gap-2">
                                <DifficultyBars level={row.difficulty} />
                                <span className="text-xs text-gray-600">
                                  {isBankDifficulty(row.difficulty) ? getDifficultyLabel(row.difficulty) : '—'}
                                </span>
                              </span>
                            </td>
                            <td className={cn(tdClass, 'text-right tabular-nums')}>
                              {row.tests > 0 ? row.tests : <span className="text-gray-500">—</span>}
                            </td>
                            <td className={cn(tdClass, 'whitespace-nowrap')}>{formatDate(row.createdAt)}</td>
                            <td className={tdClass}>
                              <ChevronRight aria-hidden className={rowChevronClass} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Phones: the same questions as rows. */}
                  <List className="md:hidden">
                    {rowFacts.map((row) => (
                      <li key={row.id}>
                        <Link href={`/admin/bank/${row.id}`} prefetch={false} className={cn(listRowInteractiveClass, 'group items-start')}>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="line-clamp-3 text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: row.preview }} />
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                              <DifficultyBars level={row.difficulty} />
                              <span>{isBankDomain(row.domain) ? getDomainShortLabel(row.domain) : 'Not sorted'}</span>
                              <KindBadge kind={row.kind} />
                              {row.tests > 0 && <span>· in {row.tests} {row.tests === 1 ? 'test' : 'tests'}</span>}
                            </div>
                          </div>
                          <ChevronRight aria-hidden className={cn(rowChevronClass, 'mt-0.5')} />
                        </Link>
                      </li>
                    ))}
                  </List>
                </>
              )}

              {totalPages > 1 && (
                <nav aria-label="Question bank pages" className="flex flex-wrap items-center justify-between gap-3">
                  {/* On the gray-100 canvas, where gray-500 misses AA. */}
                  <p className="text-xs tabular-nums text-gray-600">
                    {skip + 1}–{skip + rowFacts.length} of {matching}
                  </p>
                  <div className="flex items-center gap-1">
                    {page > 1 ? (
                      <Link
                        href={bankListHref(filters, page - 1, size)}
                        prefetch={false}
                        aria-label="Previous page"
                        className={cn(pageLinkClass, pageIdleClass)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span aria-hidden className={cn(pageLinkClass, pageOffClass)}>
                        <ChevronLeft className="h-4 w-4" />
                      </span>
                    )}
                    {pageItems(page, totalPages).map((item, index) =>
                      item === 'gap' ? (
                        <span key={`gap-${index}`} aria-hidden className="px-1 text-sm text-gray-500">…</span>
                      ) : (
                        <Link
                          key={item}
                          href={bankListHref(filters, item, size)}
                          prefetch={false}
                          aria-current={item === page ? 'page' : undefined}
                          aria-label={`Page ${item}`}
                          className={cn(pageLinkClass, item === page ? 'border-ink-600 bg-ink-50 text-ink-800' : pageIdleClass)}
                        >
                          {item}
                        </Link>
                      ),
                    )}
                    {page < totalPages ? (
                      <Link
                        href={bankListHref(filters, page + 1, size)}
                        prefetch={false}
                        aria-label="Next page"
                        className={cn(pageLinkClass, pageIdleClass)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span aria-hidden className={cn(pageLinkClass, pageOffClass)}>
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </nav>
              )}
            </section>
          )}
        </>
      )}
    </Page>
  );
}
