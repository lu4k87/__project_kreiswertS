"use client";
// Main navigation of the platform: marks the current page (client component only for that).
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; /** further paths that belong to this entry */ match?: string[] };

export function PlatformNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  const isCurrent = (item: NavItem) => [item.href, ...(item.match ?? [])].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return (
    // From 1344 px (84rem) the entries sit in the header row between the logo and the actions: the six German entries
    // of a site need 1325 px together with the logo and the three actions (measured 2026-11-28; English and the
    // administrator need less). Below that they get their own row under the logo line, which scrolls sideways when
    // it is too narrow – left-aligned, because a centred, clipped row would hide its first entry.
    <nav aria-label={label} className="order-last w-full min-w-0 min-[84rem]:order-none min-[84rem]:w-auto min-[84rem]:flex-1">
      <ul className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 max-[84rem]:pb-1 min-[84rem]:justify-center">
        {items.map((item) => {
          const current = isCurrent(item);
          return (
            <li key={item.href} className="flex-none">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-10 items-center rounded-lg px-2.5 text-[15px] font-medium whitespace-nowrap ${
                  current ? "bg-mint text-ink" : "text-muted hover:bg-mint hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
