'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminItems, isAdminActive } from '@/components/layout/ShellNav';
import { ChipCheck, chipClass } from '@/components/ui/Misc';

/**
 * The admin's places on a phone. The desktop sidebar lists them; the phone's
 * bottom bar has one Admin tab, which opens Courses, so every admin page
 * carries this row above its content. Chips, one per place, from the same
 * list and active rule as the sidebar.
 */
export default function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="mx-auto w-full max-w-6xl overflow-x-auto px-4 pt-4 sm:px-6 md:hidden">
      <div className="flex gap-2">
        {adminItems.map((item) => {
          const isActive = isAdminActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={chipClass(isActive)}
            >
              <ChipCheck active={isActive} />
              {item.shortLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
