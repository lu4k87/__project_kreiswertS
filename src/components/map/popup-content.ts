// Map popups (user, 2026-11-28: "the popups are lame – build a logo and format the texts cleanly"): a head with a
// mark (park sign, pathway letter or company monogram), title and place, then named sites as a list with their own
// monograms, key figures as small tiles and the links as buttons. Built from DOM nodes – names from the database are
// always set as textContent, never as HTML.

export type PopupLink = { href: string; label: string };
export type PopupItem = { name: string; detail?: string; tag?: string };
export type PopupStat = { label: string; value: string };
export type PopupSpec = {
  /** Mark top left: the park sign, a pathway letter or the monogram of the title. */
  mark: { kind: "park" | "flow" | "site"; text?: string };
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Place line with a pin. */
  place?: string;
  tags?: string[];
  lines?: string[];
  stats?: PopupStat[];
  list?: { title: string; items: PopupItem[]; empty: string };
  links?: PopupLink[];
};

/** Words that do not make a company recognisable: legal forms, connectors, notes in brackets. */
const FILLER = new Set(["gmbh", "mbh", "ag", "kg", "ohg", "gbr", "ug", "se", "ek", "e.k.", "co", "co.", "und", "&", "+", "der", "die", "das", "the", "and"]);

/** Two letters for a company logo: first letters of the first two telling words ("Demo Formteile GmbH" → "DF"). */
export function monogram(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s\-–—/,]+/)
    .filter((word) => word && !FILLER.has(word.toLowerCase()) && /\p{L}|\p{N}/u.test(word));
  const letters = words.slice(0, 2).map((word) => [...word.replace(/^[^\p{L}\p{N}]+/u, "")][0] ?? "");
  return letters.join("").toLocaleUpperCase("de") || "?";
}

const SVG_NS = "http://www.w3.org/2000/svg";
/** Line icons on the 24 grid of icons.tsx (Lucide paths, ISC licence). */
const ICONS = {
  pin: ["M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0", "M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6"],
  factory: [
    "M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z",
    "M8 16h.01",
    "M12 16h.01",
    "M16 16h.01",
  ],
  arrow: ["M5 12h14", "M12 5l7 7-7 7"],
} as const;

function icon(name: keyof typeof ICONS, size: number, width = 1.75): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [key, value] of Object.entries({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }))
    svg.setAttribute(key, String(value));
  svg.classList.add("flex-none");
  for (const d of ICONS[name]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Tile with a soft top light: one shape for all three marks, the colour says the layer (legend colours). */
const MARK_BASE = "grid size-11 flex-none place-items-center rounded-xl shadow-[0_6px_14px_rgb(16_32_24/0.22),inset_0_1px_0_rgb(255_255_255/0.35)]";
const MARK_CLASS = {
  park: `${MARK_BASE} bg-[#15803d] text-white`, // green-700: the park colour, white sign ≥ 5:1
  flow: `${MARK_BASE} bg-map-flow text-white text-[18px] font-bold leading-none`, // white letter 5.2:1
  site: `${MARK_BASE} bg-ink text-surface text-[15px] font-bold leading-none tracking-wide`,
} as const;

function mark({ kind, text }: PopupSpec["mark"], title: string): HTMLElement {
  const tile = el("span", MARK_CLASS[kind]);
  tile.setAttribute("aria-hidden", "true");
  if (kind === "park") tile.append(icon("factory", 22));
  else tile.textContent = text ?? monogram(title);
  return tile;
}

/** Small tag (Demo, Simulated): outlined, ink on glass. */
const tag = (text: string) => el("span", "inline-flex flex-none items-center rounded-full border border-ink/25 px-2 py-0.5 text-[13px] leading-tight font-medium whitespace-nowrap", text);

export function popupContent(spec: PopupSpec, navigate: (href: string) => void): HTMLElement {
  const root = el("div", "grid gap-3 text-[15px] leading-snug text-ink");

  // Head: mark + eyebrow, title, subtitle, place.
  const head = el("div", "flex items-start gap-3 pr-7"); // room for the close button, only next to the head
  head.append(mark(spec.mark, spec.title));
  const heading = el("div", "grid min-w-0 gap-0.5");
  if (spec.eyebrow) heading.append(el("p", "text-[13px] leading-tight font-semibold tracking-wide uppercase", spec.eyebrow));
  heading.append(el("p", "text-[17px] leading-snug font-semibold text-balance break-words", spec.title));
  if (spec.subtitle) heading.append(el("p", "text-[15px] leading-snug break-words", spec.subtitle));
  if (spec.place) {
    const place = el("p", "mt-0.5 flex items-center gap-1.5 text-[14px] leading-snug");
    place.append(icon("pin", 15), el("span", "min-w-0 break-words", spec.place));
    heading.append(place);
  }
  head.append(heading);
  root.append(head);

  if (spec.tags?.length) {
    const tags = el("div", "flex flex-wrap gap-1.5");
    spec.tags.forEach((text) => tags.append(tag(text)));
    root.append(tags);
  }
  for (const line of spec.lines ?? []) root.append(el("p", "text-[14px] leading-normal text-pretty", line));

  if (spec.stats?.length) {
    const stats = el("dl", "grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2");
    for (const stat of spec.stats) {
      const tile = el("div", "grid content-start gap-0.5 rounded-lg border border-ink/12 bg-surface/55 px-3 py-2");
      tile.append(el("dd", "text-[20px] leading-none font-bold tabular-nums", stat.value), el("dt", "text-[13px] leading-tight text-pretty", stat.label));
      stats.append(tile);
    }
    root.append(stats);
  }

  if (spec.list) {
    const section = el("section", "grid gap-2 border-t border-ink/12 pt-3");
    const title = el("p", "flex items-center gap-2 text-[13px] leading-tight font-semibold tracking-wide uppercase");
    title.append(el("span", "", spec.list.title));
    if (spec.list.items.length > 0) title.append(el("span", "grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[12px] leading-none font-bold text-surface tabular-nums", String(spec.list.items.length)));
    section.append(title);
    if (spec.list.items.length === 0) section.append(el("p", "text-[14px] leading-normal text-pretty", spec.list.empty));
    else {
      const list = el("ul", "grid gap-2");
      for (const item of spec.list.items) {
        const row = el("li", "flex items-start gap-2.5");
        const logo = el("span", "grid size-8 flex-none place-items-center rounded-lg border border-ink/15 bg-surface/80 text-[12px] leading-none font-bold tracking-wide", monogram(item.name));
        logo.setAttribute("aria-hidden", "true");
        const text = el("div", "grid min-w-0 flex-1 gap-0.5");
        text.append(el("p", "text-[14px] leading-snug font-semibold break-words", item.name));
        if (item.detail) text.append(el("p", "text-[14px] leading-snug break-words", item.detail));
        row.append(logo, text);
        if (item.tag) row.append(tag(item.tag));
        list.append(row);
      }
      section.append(list);
    }
    root.append(section);
  }

  if (spec.links?.length) {
    const links = el("div", "flex flex-wrap gap-2 border-t border-ink/12 pt-3");
    spec.links.forEach((link, index) => {
      const anchor = el(
        "a",
        `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-semibold no-underline transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
          index === 0 ? "bg-ink text-surface hover:bg-ink/85" : "border border-ink/25 hover:bg-ink/8"
        }`,
      );
      anchor.href = link.href;
      anchor.append(el("span", "", link.label), icon("arrow", 15, 2));
      anchor.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // new tab stays a normal link
        event.preventDefault();
        navigate(link.href);
      });
      links.append(anchor);
    });
    root.append(links);
  }
  return root;
}
