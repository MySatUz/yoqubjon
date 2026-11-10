import { cn } from '@/components/ui/cn';
import { focusRingClass } from '@/components/ui/Button';

/**
 * The owner's channel, named in the Board's top bar and in the row over each
 * question of every test screen - each course's tests, olympiads and homework -
 * so a recording, or a screenshot cropped to the question, carries it.
 */
export const TELEGRAM_CHANNEL_URL = 'https://t.me/sat_800';
const TELEGRAM_CHANNEL_LABEL = 't.me/sat_800';

/**
 * Telegram's own mark: a white plane on its blue disc. Like the logo, its
 * colours are its own and not palette colours to reuse (AGENTS.md, Logo).
 * The plane is Simple Icons' Telegram glyph (CC0), drawn white on the disc.
 */
function TelegramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="12" fill="#26A5E4" />
      <path
        fill="#fff"
        d="M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
      />
    </svg>
  );
}

const sizes = {
  // The Board's, read from across a room, as its tags are (`Badge size="md"`).
  lg: { link: 'gap-2 text-lg', mark: 'h-7 w-7' },
  // The row over a test's question, as tall as Flag beside it (a `sm`
  // button) and at its label's size; a finger gets the button's 40px.
  row: { link: 'h-8 gap-1.5 px-1 text-sm pointer-coarse:h-10', mark: 'h-5 w-5' },
};

/**
 * The mark and the address, which is what a viewer of a recording types. The
 * address is ink, the link colour: Telegram's lighter blue is about 3:1 on
 * white, too faint for text. It opens in a new tab, so a test in progress
 * stays where it is.
 */
export default function TelegramChannel({
  size = 'lg',
  className,
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <a
      href={TELEGRAM_CHANNEL_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Telegram channel ${TELEGRAM_CHANNEL_LABEL}`}
      className={cn(
        'shrink-0 items-center rounded-lg font-medium text-ink-700 decoration-ink-700 underline-offset-4 hover:underline',
        sizes[size].link,
        focusRingClass,
        className,
      )}
    >
      <TelegramMark className={cn('shrink-0', sizes[size].mark)} />
      {TELEGRAM_CHANNEL_LABEL}
    </a>
  );
}

/**
 * The channel at the right end of the row over a test's question
 * (`questionHeadClass`): on every screen size, held apart from Flag so it
 * reads as a caption of the question and not as a third tool beside it.
 * `-mr-1` takes back the link's padding, so the address ends on the
 * column's edge, under the end of the row's rule.
 */
export function QuestionRowChannel() {
  return <TelegramChannel size="row" className="-mr-1 ml-auto inline-flex" />;
}
