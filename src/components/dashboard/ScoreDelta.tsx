import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui/Badge';
import { formatSignedDelta } from '@/lib/scoreDisplay';

/**
 * How an attempt moved against the one before it on the same test: up in
 * green, down and unchanged in gray - with an arrow, so colour is never the
 * only cue. A lower score is not an error, and red stays for wrong answers,
 * errors and destructive actions (the owner's call). `unit` names what moved
 * when it is not the score ("correct"); `context` ends the phrase ("since
 * attempt 1") where the badge stands alone; `against` says the same to a
 * screen reader only, where the eye gets it from the layout - a phone row has
 * no "Change" column header to read out.
 */
export default function ScoreDelta({
  delta,
  unit,
  context,
  against,
  same = 'Same',
}: {
  delta: number;
  unit?: string;
  context?: string;
  /** What the change is measured against, read out but not shown: "the previous attempt". */
  against?: string;
  /** Text for no change, e.g. "Same as attempt 1". */
  same?: string;
}) {
  const rounded = Number(delta.toFixed(2));
  const tone: Tone = rounded > 0 ? 'success' : 'neutral';
  const Icon = rounded > 0 ? ArrowUp : rounded < 0 ? ArrowDown : Minus;

  return (
    <Badge tone={tone} className="tabular-nums">
      <Icon aria-hidden />
      {rounded === 0
        ? same
        : [formatSignedDelta(rounded), unit, context].filter(Boolean).join(' ')}
      {against && <span className="sr-only">{rounded === 0 ? ` as ${against}` : ` since ${against}`}</span>}
    </Badge>
  );
}
