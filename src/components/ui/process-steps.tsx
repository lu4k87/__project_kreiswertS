// Numbered process as a connected chain: icon node + "Step n" + title + text, joined by a line.
// "auto": vertical timeline on narrow screens, one horizontal row from xl. "vertical": always the timeline.
// The connector is a pseudo-element (::after), so it never takes part in the layout flow.
import type { CSSProperties, ReactNode } from "react";

export type ProcessStep = { icon: ReactNode; title: string; text: string };

export function ProcessSteps({ steps, stepLabel, layout = "auto" }: { steps: ProcessStep[]; stepLabel: string; layout?: "auto" | "vertical" }) {
  const row = layout === "auto";
  return (
    <ol
      style={{ "--steps": steps.length } as CSSProperties}
      className={`grid grid-cols-[minmax(0,1fr)] ${row ? "xl:grid-cols-[repeat(var(--steps),minmax(0,1fr))] xl:gap-x-6" : ""}`}
    >
      {steps.map((step, index) => (
        <li
          key={step.title}
          className={[
            // timeline: node column + text, line from below the node down to the next one
            "relative grid grid-cols-[2.75rem_minmax(0,1fr)] content-start gap-x-4 pb-6 last:pb-0",
            "after:absolute after:top-[3.25rem] after:bottom-2 after:left-[1.375rem] after:w-0.5 after:-translate-x-1/2 after:rounded-full after:bg-brand/25 last:after:hidden",
            // row: node on top, line from the node to the next column
            row
              ? "xl:grid-cols-[minmax(0,1fr)] xl:gap-y-3 xl:pb-0 xl:after:top-[1.375rem] xl:after:right-[-1rem] xl:after:bottom-auto xl:after:left-[3.75rem] xl:after:h-0.5 xl:after:w-auto xl:after:translate-x-0 xl:after:-translate-y-1/2"
              : "",
          ].join(" ")}
        >
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-brand text-white">
            {step.icon}
          </span>
          <div className="grid min-w-0 content-start gap-1 pt-0.5">
            <span className="text-[13px] leading-tight font-semibold tracking-[0.04em] uppercase tabular-nums">
              {stepLabel} {index + 1}
            </span>
            <h3 className="text-lg leading-snug font-semibold text-balance break-words hyphens-auto">{step.title}</h3>
            <p className="text-[15px] leading-relaxed text-pretty hyphens-auto">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
