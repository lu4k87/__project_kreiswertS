// Start page map: the real, zoomable map of the region with the public park areas (from the public projection –
// no contact, address, quantity or price). Without data (database unreachable) it still shows the region.
import type { Messages } from "@/i18n/messages";
import type { PublicMap } from "@/server/dal/map";
import { ROUTES } from "@/components/layout/links";
import { LiveMap } from "@/components/map/live-map";

type Props = { t: Messages["home"]["map"]; platform: Messages["platform"]; map: PublicMap | null };

export function MaterialMap({ t, platform, map }: Props) {
  const parks = (map?.parks ?? []).map((park) => ({
    ...park,
    stats: [{ label: platform.map.listedSites, value: String(park.sites.length) }],
    links: [{ href: ROUTES.regionalMap, label: t.open }],
  }));
  return (
    <LiveMap
      parks={parks}
      label={t.label}
      t={platform.map}
      // a full-width band: fixed height on narrow screens, a flat 21:8 format from 768 px
      className="h-[340px] md:h-auto md:aspect-[21/8]"
      overlay={
        // Deliberately on the map, top left: the map controls sit on the right.
        <p className="pointer-events-none absolute top-4 left-4 z-10 flex items-center gap-2 rounded-lg bg-surface/95 px-3 py-1.5 text-[13px] font-medium shadow-sm">
          <span className="size-1.5 rounded-full bg-ink" aria-hidden="true" />
          {t.badge}
        </p>
      }
    />
  );
}
