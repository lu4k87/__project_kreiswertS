// List of sections next to a long form (layout "Form:A", user 2026-11-28): numbered links to the form's sections,
// the current one marked. From 1280 px a column of 3 that stays in view, from 1024 px a row above fields and side
// column, below that a wrapping row. Used by the offer and the request form; the form decides what a click does.
import { cardClass } from "@/components/ui/elements";

type Props<K extends string> = {
  title: string;
  items: { key: K; label: string }[];
  current: K;
  /** Called on a click or Enter on a link; the link's own jump is prevented. */
  onGo: (key: K) => void;
};

/** The id of a form section's element (`<details>` or `<section>`), the target of its link. */
export const sectionId = (key: string) => `section-${key}`;

export function FormSectionList<K extends string>({ title, items, current, onGo }: Props<K>) {
  return (
    <nav aria-labelledby="form-sections" className={`${cardClass} grid gap-3 lg:col-span-12 xl:sticky xl:top-6 xl:col-span-3 xl:px-4`}>
      <h2 id="form-sections" className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em] xl:px-2">
        {title}
      </h2>
      <ol className="flex flex-wrap gap-1 xl:grid">
        {items.map(({ key, label }, index) => (
          <li key={key} className="min-w-0">
            <a
              href={`#${sectionId(key)}`}
              aria-current={current === key ? "step" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onGo(key);
              }}
              className={`flex min-h-11 items-center gap-3 rounded-lg py-1.5 pr-3 pl-2 text-[15px] leading-snug font-medium hover:bg-mint ${current === key ? "bg-mint" : ""}`}
            >
              <span className={`grid size-7 flex-none place-items-center rounded-full border text-[13px] leading-none font-semibold tabular-nums ${current === key ? "border-brand bg-brand text-white" : "border-line"}`}>
                {index + 1}
              </span>
              <span className="min-w-0 break-words hyphens-auto">{label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
