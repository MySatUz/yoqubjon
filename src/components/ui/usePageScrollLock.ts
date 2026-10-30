import { useLayoutEffect } from 'react';

/*
 * A layer over the whole window - a dialog's scrim, the admin Board, the
 * landing's phone menu - holds the page under it still. Without this the page
 * kept its own scrollbar beside the layer, as if something there could be
 * scrolled (the owner's report on the Board), and the wheel moved the page
 * behind a dialog once the dialog itself had nothing left to scroll.
 *
 * Layers stack (a confirm over a dialog), so a count says when the page gets
 * its scrollbar back. While it is gone the page is padded by the scrollbar's
 * width, so nothing behind a see-through scrim shifts sideways.
 */
let holds = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

export function usePageScrollLock(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    if (holds === 0) {
      const scrollbar = window.innerWidth - root.clientWidth;
      saved = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
      root.style.overflow = 'hidden';
      if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    }
    holds += 1;
    return () => {
      holds -= 1;
      if (holds > 0 || !saved) return;
      root.style.overflow = saved.overflow;
      root.style.paddingRight = saved.paddingRight;
      saved = null;
    };
  }, [active]);
}
