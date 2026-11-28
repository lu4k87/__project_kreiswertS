// The three steps of the registration as a vertical timeline (layout "Reg:A", user 2026-11-28): account, company
// site, verification. The current step is the largest element of the left column; used on /register and
// /register/site.
import { cardClass } from "@/components/ui/elements";
import { CheckIcon } from "@/components/ui/icons";

type Step = { label: string; state: "done" | "current" | "next" };

export function RegistrationSteps({ label, steps }: { label: string; steps: readonly Step[] }) {
  return (
    <ol aria-label={label} className={`${cardClass} grid`}>
      {steps.map((step, index) => (
        <li
          key={step.label}
          aria-current={step.state === "current" ? "step" : undefined}
          // a short line to the step above
          className="relative flex min-w-0 items-center gap-3.5 py-3 not-first:before:absolute not-first:before:-top-3 not-first:before:left-[13px] not-first:before:h-6 not-first:before:border-l-2 not-first:before:border-line"
        >
          <span
            className={`relative grid flex-none place-items-center rounded-full font-semibold tabular-nums ${
              step.state === "current" ? "-ml-1.5 size-10 bg-brand text-[15px] text-white" : step.state === "done" ? "size-7 bg-mint text-[13px]" : "size-7 border border-line text-[13px]"
            }`}
          >
            {step.state === "done" ? <CheckIcon size={14} /> : index + 1}
          </span>
          <span className={`min-w-0 break-words hyphens-auto ${step.state === "current" ? "text-[1.375rem] leading-tight font-semibold" : "text-[15px] font-medium"}`}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
