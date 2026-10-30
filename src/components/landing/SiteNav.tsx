'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/layout/BrandMark';
import { buttonClass, focusRingClass, iconButtonClass, linkClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { FREE_OFFER_CTA, SITE_MENU_EVENT } from '@/lib/landing/warmup';
import styles from './landing.module.css';

/*
 * The landing's header: the logo in the top-left corner and a white pill of
 * links on the right. Both slide away while the page scrolls down and come
 * back the moment it scrolls up. At the very top they sit on the page itself; anywhere lower
 * a white bar with a bottom edge comes with them, so the logo never lies over
 * a section's text. On a wide screen the pill lists the sections and marks
 * the one in view. Below lg the sections move into a full-height menu, and
 * the sign-up button is left to the phone's bottom bar (StickyCta), so the two
 * are never on screen together. Plain white, no blur: AGENTS.md keeps
 * backdrop-filter out of the codebase.
 */

const SECTIONS = [{ id: 'test-screen', label: 'Test screen' }];
// Every section is watched, so one without a link clears the mark.
const WATCHED = ['warmup', 'test-screen'];

// Above this the header always shows: the hero's top is still on screen.
const ALWAYS_SHOWN_ABOVE = 80;
// A smaller move is not a change of direction: a trackpad jitters by a pixel or two.
const SCROLL_SLOP = 4;

// Ghost is right here: the pill around them already says "controls". The
// section in view is marked in the accent's subtle ground.
const sectionLinkClass = buttonClass({
  variant: 'ghost',
  size: 'sm',
  pill: true,
  className: 'aria-[current=location]:bg-ink-50 aria-[current=location]:text-ink-700',
});

export default function SiteNav() {
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [tucked, setTucked] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // A browser sends at most one scroll event a frame, so the handler runs as it comes.
  useEffect(() => {
    let lastY = Math.max(window.scrollY, 0);
    const onScroll = () => {
      // Safari reports a negative offset while the page bounces past the top.
      const y = Math.max(window.scrollY, 0);
      setAtTop(y < 1);
      if (y < ALWAYS_SHOWN_ABOVE) {
        setTucked(false);
        lastY = y;
        return;
      }
      if (Math.abs(y - lastY) < SCROLL_SLOP) return;
      setTucked(y > lastY);
      lastY = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
      },
      // A thin band across the middle of the screen: the section crossing it is the one being read.
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const id of WATCHED) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SITE_MENU_EVENT, { detail: open }));
    if (!open) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    firstLinkRef.current?.focus({ preventScroll: true });

    // The page under the panel is out of reach while it is open: <main> and
    // the footer go inert, and Tab cycles through the header and the menu.
    const header = headerRef.current;
    const behind = [...(header?.parentElement?.children ?? [])].filter(
      (element): element is HTMLElement => element instanceof HTMLElement && ['MAIN', 'FOOTER'].includes(element.tagName),
    );
    const wasInert = behind.map((element) => element.inert);
    behind.forEach((element) => (element.inert = true));

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !header) return;
      // offsetParent is null for what is not drawn (the pill's wide-screen links).
      const stops = [...header.querySelectorAll<HTMLElement>('a[href], button')].filter((el) => el.offsetParent !== null);
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const wide = window.matchMedia('(min-width: 1024px)');
    const onWide = () => {
      if (wide.matches) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    wide.addEventListener('change', onWide);
    return () => {
      root.style.overflow = overflow;
      behind.forEach((element, index) => (element.inert = wasInert[index]));
      window.removeEventListener('keydown', onKey);
      wide.removeEventListener('change', onWide);
    };
  }, [open]);

  const currentOf = (id: string) => (current === id ? ('location' as const) : undefined);
  // Focus goes back to the toggle: the link that was pressed is inert a frame later.
  const close = () => {
    setOpen(false);
    toggleRef.current?.focus({ preventScroll: true });
  };

  return (
    // Focus coming back to a tucked header (Shift+Tab from the page) brings it down.
    <header ref={headerRef} onFocus={() => setTucked(false)} className="pointer-events-none sticky top-0 z-50">
      {/* The bar slides, not the header: a transform would make the header
          the box the fixed menu below is laid out in. Its row is the page's
          own container, so the logo stands over the headline's edge and the
          pill over the warm-up card's. */}
      <div
        className={cn(
          'relative z-10 border-b',
          atTop ? 'border-transparent' : 'pointer-events-auto border-gray-200 bg-white',
          styles.headerBar,
          tucked && !open && styles.headerBarTucked,
        )}
      >
        {/* The logo at its largest, nearly the bar's full height (the owner's call). */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="MYSATuz home"
            className={cn('pointer-events-auto flex items-center gap-3 rounded-full pr-1', focusRingClass)}
          >
            <BrandMark size="lg" />
            <span className="text-2xl font-semibold tracking-tight text-gray-900">MYSATuz</span>
          </Link>

          {/* The pill floats with its shadow only on the page itself; on the bar it is drawn by its edge. */}
          <nav
            aria-label="Main"
            className={cn(
              'pointer-events-auto flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1',
              atTop && 'shadow-lg',
            )}
          >
            <div className="hidden items-center gap-0.5 lg:flex">
              {SECTIONS.map((section) => (
                <a key={section.id} href={`#${section.id}`} aria-current={currentOf(section.id)} className={sectionLinkClass}>
                  {section.label}
                </a>
              ))}
            </div>

            {/* Quiet, not ghost: beside the primary (and alone on a phone) it has
                to look like a button, not like a line of grey text. */}
            <Link href="/login" className={buttonClass({ variant: 'quiet', size: 'sm', pill: true })}>
              Sign in
            </Link>
            <div className="hidden lg:block">
              <Link href="/register?from=nav" className={buttonClass({ size: 'sm', pill: true })}>
                {FREE_OFFER_CTA}
              </Link>
            </div>

            <button
              ref={toggleRef}
              type="button"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((value) => !value)}
              className={iconButtonClass({ size: 'sm', pill: true, className: 'relative lg:hidden' })}
            >
              <span aria-hidden className={cn(styles.navBar, styles.navBarTop, open && styles.navBarOpen)} />
              <span aria-hidden className={cn(styles.navBar, styles.navBarBottom, open && styles.navBarOpen)} />
            </button>
          </nav>
        </div>
      </div>

      {/* Inside the header, so it shares its layer: the bar stays on top
          of the panel, and both sit above the phone's bottom bar. */}
      <div
        id="site-menu"
        inert={!open}
        className={cn(
          // Scrolls on its own: on a landscape phone the list is taller than the screen.
          'pointer-events-auto fixed inset-0 flex flex-col justify-between gap-8 overflow-y-auto overscroll-contain bg-white px-4 pb-8 pt-24 lg:hidden',
          styles.menu,
          open && styles.menuOpen,
        )}
      >
        <ul className="grid gap-1">
          {SECTIONS.map((section, index) => (
            <li key={section.id} className={styles.menuItem} style={{ '--i': index } as CSSProperties}>
              <a
                ref={index === 0 ? firstLinkRef : undefined}
                href={`#${section.id}`}
                aria-current={currentOf(section.id)}
                onClick={close}
                className={cn(
                  'block w-fit rounded-lg py-3 text-2xl font-semibold tracking-tight text-gray-900 transition-colors',
                  'hover:text-ink-700 aria-[current=location]:text-ink-700',
                  focusRingClass,
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
        <div className={cn('grid gap-4 text-center', styles.menuItem)} style={{ '--i': SECTIONS.length } as CSSProperties}>
          <Link href="/register?from=menu" onClick={close} className={buttonClass({ size: 'lg', block: true })}>
            {FREE_OFFER_CTA}
          </Link>
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" onClick={close} className={linkClass}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </header>
  );
}
