'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RailTooltip } from '@/components/layout/RailTooltip';
import { focusRingClass } from '@/components/ui/Button';
import { SIDEBAR_STORAGE_KEY } from '@/components/layout/sidebarState';

function toggleSidebar() {
  const root = document.documentElement;
  const collapse = root.dataset.sidebar !== 'collapsed';

  if (collapse) root.dataset.sidebar = 'collapsed';
  else delete root.dataset.sidebar;

  try {
    if (collapse) localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed');
    else localStorage.removeItem(SIDEBAR_STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the toggle still works for this page.
  }
}

/*
 * A small keyed circle sitting on the sidebar's right edge, level with the
 * logo, in both states. It used to be an icon at the end of the logo row that
 * dropped under the logo when the rail collapsed (no room beside it in 80px),
 * so the way back moved every time it was used - the owner's note. On the
 * edge it stays where it was and needs no room in the rail; white on the
 * canvas side and the dark sidebar alike, it reads as a control, not as a
 * glyph of the sidebar. The aside is `relative`, so it hangs from its corner.
 */
const handleClass =
  'absolute -right-3 top-5 z-10 h-6 w-6 items-center justify-center rounded-full border border-mist-400 border-b-mist-500 bg-white text-mist-700 shadow-xs transition-colors hover:bg-mist-50 hover:text-mist-900 ' +
  focusRingClass;

/**
 * Both buttons are always rendered and CSS shows the one that fits, because
 * the state is a DOM attribute rather than React state (see sidebarState.ts).
 */
export default function SidebarToggle() {
  return (
    <>
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Collapse sidebar"
        title="Collapse sidebar"
        className={`${handleClass} flex collapsed:hidden`}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Expand sidebar"
        className={`group ${handleClass} hidden collapsed:flex`}
      >
        <ChevronRight className="h-3.5 w-3.5" />
        <RailTooltip className="ml-2">Expand sidebar</RailTooltip>
      </button>
    </>
  );
}
