import React from 'react';
import Link from 'next/link';
import BrandMark from '@/components/layout/BrandMark';
import { buttonClass, focusRingClass, linkClass } from '@/components/ui/Button';

/**
 * The frame of sign-in, sign-up, email confirmation and password reset: the
 * landing's header line (the mark at the left, the other auth page at the
 * right) over one narrow column held to the top. Not centred vertically: a
 * centred column jumped every time an error appeared above the button, and the
 * logo moved from the corner to the middle between the landing and here.
 */
export default function AuthShell({ children, altLink }: { children: React.ReactNode; altLink?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className={`flex items-center gap-2.5 rounded-lg ${focusRingClass}`} aria-label="MYSATuz home">
          <BrandMark size="sm" />
          <span className="text-base font-semibold tracking-tight text-gray-900">MYSATuz</span>
        </Link>
        {altLink}
      </header>
      <main className="mx-auto w-full max-w-sm px-4 pb-12 pt-6 sm:pt-14">{children}</main>
    </div>
  );
}

/**
 * The header's link to the other auth page, drawn as a secondary button: the
 * bare grey text it was looked like a caption on the canvas until hovered,
 * and it is the one way across for someone who landed on the wrong form.
 */
export const authAltLinkClass = buttonClass({ variant: 'secondary' });

/**
 * Links inside auth copy: the app's one text link (`linkClass`), always
 * underlined, so they are not told apart by colour alone.
 */
export const authLinkClass = linkClass;
