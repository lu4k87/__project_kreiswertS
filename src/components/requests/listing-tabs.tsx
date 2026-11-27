// Tabs of "My listings" (page tree, Level 2 navigation): My offers · My requests · Matches. Plain links – the
// current page is marked with aria-current, so the row works without JavaScript.
import Link from "next/link";
import type { PlatformMessages } from "@/i18n/platform";
import { ROUTES } from "@/components/layout/links";

type Tab = "offers" | "requests" | "matches";

export function ListingTabs({ current, t }: { current: Tab; t: PlatformMessages }) {
  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "offers", href: ROUTES.myOffers, label: t.listingTabs.offers },
    { key: "requests", href: ROUTES.myRequests, label: t.listingTabs.requests },
    { key: "matches", href: ROUTES.matches, label: t.listingTabs.matches },
  ];
  return (
    <nav aria-label={t.listingTabs.label} className="min-w-0">
      <ul className="scroll-thin -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key} className="flex-none">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center border-b-2 px-3 text-[15px] font-semibold whitespace-nowrap ${
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
