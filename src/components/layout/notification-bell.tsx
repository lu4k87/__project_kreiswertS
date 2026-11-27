// Bell in the platform header (function no. 19): link to the notices of the own site with the number of unread
// ones. The number comes from the server on every page load – no polling.
import Link from "next/link";
import type { PlatformMessages } from "@/i18n/platform";
import { BellIcon } from "@/components/ui/icons";
import { ROUTES } from "./links";

export function NotificationBell({ unread, t }: { unread: number; t: PlatformMessages }) {
  const a = t.alerts;
  const label = unread > 0 ? `${a.bell}: ${unread} ${a.bellUnread}` : a.bell;
  return (
    <Link href={ROUTES.notifications} aria-label={label} title={label} className="relative grid size-10 flex-none place-items-center rounded-lg hover:bg-mint">
      <BellIcon size={20} />
      {unread > 0 && (
        // a counter that sits on the icon on purpose
        <span
          data-audit-ignore
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[12px] leading-none font-semibold text-white tabular-nums"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
