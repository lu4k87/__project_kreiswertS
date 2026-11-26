"use client";
// Main navigation of the platform: marks the current page (client component only for that).
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode; /** further paths that belong to this entry */ match?: string[] };

export function PlatformNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  const isCurrent = (item: NavItem) => [item.href, ...(item.match ?? [])].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return (
    // Own row under the logo line at every width: six to seven entries in German do not fit next to the actions,
    // and a centred, clipped row would hide its first entry. On narrow screens the row scrolls sideways.
    <nav aria-label={label} className="order-last w-full min-w-0">
      <ul className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {items.map((item) => {
          const current = isCurrent(item);
          return (
            <li key={item.href} className="flex-none">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-[15px] font-medium whitespace-nowrap ${
                  current ? "bg-mint text-ink" : "text-muted hover:bg-mint hover:text-ink"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
