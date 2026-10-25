'use client';

import { useEffect } from 'react';

/**
 * Scrolls to the element `id` once it is on screen, when the address ends in
 * `#<id>`.
 *
 * The router's own hash scroll does not reach a section behind an await: on a
 * client navigation it runs once, against the route's loading.tsx, finds no
 * such element there and is spent before the page streams in. So a link to
 * `/dashboard/subscription#payments` (the Courses page's "payments waiting",
 * `/admin/payments`) used to land at the top. Rendered inside the section,
 * this runs when the section itself mounts. An instant jump, not a smooth
 * one: nothing moves on its own for a reader who asked for reduced motion.
 */
export default function HashScroll({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [id]);

  return null;
}
