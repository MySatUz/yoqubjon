import { cn } from '@/components/ui/cn';
import { focusRingClass } from '@/components/ui/Button';

/** The owner's channel, named on the Board so a lesson recording carries it. */
export const BOARD_TELEGRAM_URL = 'https://t.me/sat_800';
const BOARD_TELEGRAM_LABEL = 't.me/sat_800';

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

/**
 * The channel beside the question's tags in the Board's top bar (the owner's
 * mock-up): the mark and the address, which is what a viewer of a recording
 * types. The address is ink, the link colour: Telegram's lighter blue is
 * about 3:1 on white, too faint for text.
 */
export default function TelegramChannel({ className }: { className?: string }) {
  return (
    <a
      href={BOARD_TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Telegram channel ${BOARD_TELEGRAM_LABEL}`}
      className={cn(
        'shrink-0 items-center gap-2 rounded-lg text-lg font-medium text-ink-700 decoration-ink-700 underline-offset-4 hover:underline',
        focusRingClass,
        className,
      )}
    >
      <TelegramMark className="h-7 w-7 shrink-0" />
      {BOARD_TELEGRAM_LABEL}
    </a>
  );
}
