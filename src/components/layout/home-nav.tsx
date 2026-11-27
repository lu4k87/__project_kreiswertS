"use client";
// Start page navigation: "Overview" (top) and "How it works" (#how-it-works) on the same page.
// Scrolls itself instead of relying on next/link, which skips the jump when the URL already
// matches (e.g. /#how-it-works after scrolling back up), and marks the part the user is reading.
import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { ROUTES } from "./links";

type Part = "overview" | "howItWorks";

const SECTION_ID = ROUTES.howItWorks.split("#")[1];
// Section counts as "reached" once its top is this close to the viewport top (scroll-mt-6 = 24 px).
const REACHED_PX = 120;

function currentPart(): Part {
  const section = document.getElementById(SECTION_ID);
  if (!section) return "overview";
  // A page that fits the window is "at the bottom" from the start → only counts once the user has scrolled.
  const atBottom =
    window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  return section.getBoundingClientRect().top <= REACHED_PX || atBottom ? "howItWorks" : "overview";
}

/** `pages`: further public pages, shown as plain links after the two parts of the start page. */
type Props = { label: string; overview: string; howItWorks: string; pages?: { key: string; href: string; text: string }[] };

export function HomeNav({ label, overview, howItWorks, pages = [] }: Props) {
  const [active, setActive] = useState<Part>("overview");

  useEffect(() => {
    const update = () => setActive(currentPart());
    // Back/forward between our own entries: Next keeps the scroll position, so jump like an anchor would.
    // Runs after Next has rendered the history entry, otherwise its own scroll handling wins.
    const restore = () =>
      requestAnimationFrame(() => {
        if (location.pathname !== ROUTES.home) return;
        if (location.hash === `#${SECTION_ID}`) document.getElementById(SECTION_ID)?.scrollIntoView();
        else window.scrollTo({ top: 0 });
      });
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("popstate", restore);
    };
  }, []);

  function go(event: MouseEvent<HTMLAnchorElement>, part: Part) {
    // Ctrl/Cmd/middle click keeps the browser's own behaviour (new tab etc.).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (part === "overview") {
      window.scrollTo({ top: 0 });
      window.history.pushState(null, "", ROUTES.home);
    } else {
      document.getElementById(SECTION_ID)?.scrollIntoView();
      window.history.pushState(null, "", ROUTES.howItWorks);
    }
    setActive(part);
  }

  const items: { part: Part; href: string; text: string }[] = [
    { part: "overview", href: ROUTES.home, text: overview },
    { part: "howItWorks", href: ROUTES.howItWorks, text: howItWorks },
  ];

  return (
    <nav aria-label={label} className="order-last w-full xl:order-none xl:w-auto xl:flex-1">
      <ul className="flex flex-wrap gap-x-8 gap-y-1 whitespace-nowrap xl:flex-nowrap xl:justify-center">
        {items.map((item) => (
          <li key={item.part}>
            <a
              href={item.href}
              onClick={(event) => go(event, item.part)}
              aria-current={active === item.part ? "location" : undefined}
              className={
                active === item.part
                  ? "relative block pb-2 text-[15px] font-medium text-ink after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-6 after:-translate-x-1/2 after:rounded-full after:bg-ink"
                  : "block pb-2 text-[15px] font-medium text-muted hover:text-ink"
              }
            >
              {item.text}
            </a>
          </li>
        ))}
        {pages.map((page) => (
          <li key={page.key}>
            <Link href={page.href} className="block pb-2 text-[15px] font-medium text-muted hover:text-ink">
              {page.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
