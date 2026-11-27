// Tabs of "My listings" (page tree, Level 2 navigation): My offers · My requests · Matches.
import type { PlatformMessages } from "@/i18n/platform";
import { ROUTES } from "@/components/layout/links";
import { TabNav } from "@/components/ui/tab-nav";

type Tab = "offers" | "requests" | "matches";

export function ListingTabs({ current, t }: { current: Tab; t: PlatformMessages }) {
  return (
    <TabNav
      label={t.listingTabs.label}
      current={current}
      tabs={[
        { key: "offers", href: ROUTES.myOffers, label: t.listingTabs.offers },
        { key: "requests", href: ROUTES.myRequests, label: t.listingTabs.requests },
        { key: "matches", href: ROUTES.matches, label: t.listingTabs.matches },
      ]}
    />
  );
}
