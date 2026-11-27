// Row of page tabs as plain links – the current page is marked with aria-current, so it works without JavaScript.
import Link from "next/link";

export type Tab<K extends string> = { key: K; href: string; label: string };

export function TabNav<K extends string>({ label, tabs, current }: { label: string; tabs: Tab<K>[]; current: K }) {
  return (
    <nav aria-label={label} className="min-w-0">
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
