/**
 * The one logo square, shared by the sidebar, the mobile header, the
 * collapsed-rail toggle and the public pages. The mark is the product's own
 * motif - a line rising to a point, "800 isn't a jump, it's a slope" - drawn on
 * `currentColor`. A board-600 square with a white line on light pages;
 * `onBrand` is the inverted mark for the deep board-950 sidebar: a white
 * square with a board-600 line. src/app/icon.svg, apple-icon.png and the link
 * preview (opengraph-image.tsx) draw the same mark in the same green.
 */
export function SlopeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M5 18.5 16.4 8.6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="17.4" cy="7.6" r="3.3" fill="currentColor" />
    </svg>
  );
}

export default function BrandMark({ size = 'md', onBrand = false }: { size?: 'sm' | 'md'; onBrand?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${
        onBrand ? 'bg-white text-board-600' : 'bg-board-600 text-white'
      } ${size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'}`}
    >
      <SlopeMark className={size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'} />
    </span>
  );
}
