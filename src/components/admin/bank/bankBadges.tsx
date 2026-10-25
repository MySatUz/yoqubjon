import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import {
  getDifficultyLabel,
  getDomainShortLabel,
  isBankDifficulty,
  isBankDomain,
  type BankQuestionKind,
} from '@/lib/questionBank';

/*
 * How a bank question's facts read in a row - on the bank list, in the build
 * page's pickers. No 'use client' and no hooks: server pages and client
 * pickers both render these.
 */

/**
 * Domain and difficulty as two flat neutral badges - facts, not states, so
 * no colour. A question still missing either says "Not sorted" once, as a
 * warning: it is waiting for the admin, like anything pending.
 */
export function BankTagBadges({
  domain,
  difficulty,
  onCanvas,
}: {
  domain: string | null;
  difficulty: number | null;
  onCanvas?: boolean;
}) {
  const hasDomain = isBankDomain(domain);
  const hasDifficulty = isBankDifficulty(difficulty);

  return (
    <>
      {hasDomain && <Badge onCanvas={onCanvas}>{getDomainShortLabel(domain)}</Badge>}
      {hasDifficulty && <Badge onCanvas={onCanvas}>{getDifficultyLabel(difficulty)}</Badge>}
      {(!hasDomain || !hasDifficulty) && (
        <Badge tone="warning" title={!hasDomain ? 'No domain yet' : 'No difficulty yet'}>
          Not sorted
        </Badge>
      )}
    </>
  );
}

/** Only the kinds worth saying: a plain one-answer choice gets no badge. */
export function KindBadge({ kind }: { kind: BankQuestionKind }) {
  if (kind === 'grid-in') return <Badge>Grid-in</Badge>;
  if (kind === 'multi-select') return <Badge>Multi-select</Badge>;
  return null;
}

/**
 * Difficulty as three short bars, filled up to the level - read at a glance
 * down a column, the way the College Board bank shows it. The word stays in
 * the accessible name and the tooltip; an unsorted question shows three empty
 * bars. Board fills: it is data, drawn like a chart's line, not a status.
 */
export function DifficultyBars({ level, className }: { level: number | null; className?: string }) {
  const label = isBankDifficulty(level) ? getDifficultyLabel(level) : 'Not sorted';

  return (
    <span role="img" aria-label={`Difficulty: ${label}`} title={label} className={cn('inline-flex items-center gap-0.5', className)}>
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn('h-1.5 w-4 rounded-full', level !== null && step <= level ? 'bg-board-600' : 'bg-mist-200')}
        />
      ))}
    </span>
  );
}

/**
 * A choice tile: a native checkbox and its label in one bordered box, so the
 * whole tile is the target - the bank's domain and difficulty filters, on the
 * bank page and in every bank picker. Chosen, it takes the selected treatment
 * of every other picker (board-50, a board-600 edge); `has-checked:` reads the
 * box itself, so a server-rendered form is right before any script runs.
 * Use it on a <label> that wraps `<input type="checkbox" className={checkboxClass}>`,
 * the words (flex-1) and, where known, a count.
 */
export const choiceTileClass =
  'flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-mist-300 bg-white px-3.5 transition-colors ' +
  'hover:border-mist-400 hover:bg-mist-50 has-checked:border-board-600 has-checked:bg-board-50 pointer-coarse:h-12';
