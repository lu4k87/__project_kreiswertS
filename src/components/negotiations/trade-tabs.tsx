// Tabs of the trading pages (page tree: reached through the dashboard): Negotiations · Exchanges.
import type { PlatformMessages } from "@/i18n/platform";
import { ROUTES } from "@/components/layout/links";
import { TabNav } from "@/components/ui/tab-nav";

export function TradeTabs({ current, t }: { current: "negotiations" | "exchanges"; t: PlatformMessages }) {
  return (
    <TabNav
      label={t.trade.tabsLabel}
      current={current}
      tabs={[
        { key: "negotiations", href: ROUTES.negotiations, label: t.trade.tabNegotiations },
        { key: "exchanges", href: ROUTES.exchanges, label: t.trade.tabExchanges },
      ]}
    />
  );
}
