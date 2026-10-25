import { ImageResponse } from 'next/og';

/*
 * The picture a shared link unfurls to in Telegram (and anywhere else that
 * reads og:image): the brand mark, the name and what the product is, on the
 * board green, with the mark's own idea drawn large beside them - a line
 * rising to 800 over a baseline, as on the sign-in card (SlopeToGoal).
 * Generated once at build, like the static icon files beside it.
 *
 * ImageResponse draws with Satori, which knows nothing of Tailwind: colours are
 * the v4 hex values of the classes they stand for, the same ones icon.svg uses.
 */

export const alt = 'MYSATuz · Digital SAT Math practice';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// board-600, -700 and -100 (src/app/globals.css).
const BOARD_600 = '#0d6657';
const BOARD_700 = '#0c5044';
const BOARD_100 = '#cce7df';
const WHITE = '#ffffff';

const NAME = 'MYSATuz';
const TITLE = 'Digital SAT Math practice';
const DOMAIN = 'www.slope.uz';

/**
 * Fira Sans 600, cut down to the letters on the card. The build already fetches
 * Fira Sans from Google Fonts (next/font in layout.tsx), so this adds no new
 * dependency; without a browser user agent the CSS API answers with a TTF,
 * which Satori reads (it cannot read woff2). If the fetch fails the card is
 * drawn in the bundled fallback face rather than failing the build.
 */
async function loadFiraSans(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Fira+Sans:wght@600&text=${encodeURIComponent(text)}`,
      { cache: 'force-cache' },
    ).then((response) => response.text());
    const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!fontUrl) return null;

    const font = await fetch(fontUrl, { cache: 'force-cache' });
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const firaSans = await loadFiraSans(NAME + TITLE + DOMAIN + '800');

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: BOARD_600,
          color: WHITE,
          fontFamily: 'Fira Sans',
          fontWeight: 600,
        }}
      >
        {/* The slope, right of the title. Baseline board-700, a groove in the
            ground rather than a second bright line. */}
        <svg
          width="380"
          height="330"
          viewBox="0 0 380 330"
          style={{ position: 'absolute', right: 80, top: 150 }}
        >
          <line x1="0" y1="300" x2="380" y2="300" stroke={BOARD_700} strokeWidth="4" strokeLinecap="round" />
          <line x1="6" y1="300" x2="296" y2="52" stroke={WHITE} strokeWidth="12" strokeLinecap="round" />
          <circle cx="306" cy="42" r="20" fill={WHITE} />
        </svg>
        <div style={{ position: 'absolute', right: 116, top: 118, fontSize: 40 }}>800</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {/* BrandMark's `onBrand` tile: white square, board mark. Same 24-unit
              geometry as SlopeMark in src/components/layout/BrandMark.tsx. */}
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: 28,
              background: WHITE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="64" height="64" viewBox="0 0 24 24">
              <path d="M5 18.5 16.4 8.6" fill="none" stroke={BOARD_600} strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="17.4" cy="7.6" r="3.3" fill={BOARD_600} />
            </svg>
          </div>
          <div style={{ fontSize: 52, letterSpacing: '-0.02em' }}>{NAME}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 92, lineHeight: 1.05, letterSpacing: '-0.03em', maxWidth: 960 }}>{TITLE}</div>
          <div style={{ fontSize: 36, color: BOARD_100 }}>{DOMAIN}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: firaSans ? [{ name: 'Fira Sans', data: firaSans, weight: 600, style: 'normal' }] : undefined,
    },
  );
}
