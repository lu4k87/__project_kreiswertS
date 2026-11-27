// Result of the economic feasibility (L2-007, D17): the two shared figures first (net proceeds for the offerer,
// delivered cost for the requester, before other costs), then the viewer's own side. Unknown stays a word, never 0.
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import type { FeasibilityResult } from "@/server/domain/feasibility";
import { Badge, Facts, Notice } from "@/components/ui/elements";

const NBSP = "\u00a0";

type Props = { result: FeasibilityResult; unitLabel: string; t: PlatformMessages; locale: Locale; formatQuantity: (value: number) => string };

export function FeasibilityResultView({ result, unitLabel, t, locale, formatQuantity }: Props) {
  const f = t.feasibility;
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const amount = (value: number | null) => (value == null ? t.common.unknown : money.format(value));
  const own = result.own;
  const freightNote = result.freight
    ? result.freight.total == null
      ? `${t.tradeLabels.term.freightAmount}: ${t.common.unknown}`
      : f.freightSplit.replace("{offerer}", amount(result.freight.offerer)).replace("{requester}", amount(result.freight.requester))
    : null;

  const breakEven =
    own.breakEven.kind === "quantity" ? (
      <>
        <span className="font-semibold tabular-nums">{formatQuantity(own.breakEven.quantity)}</span>
        <span className="mt-0.5 block text-[13px] leading-normal">{f.breakEvenText}</span>
      </>
    ) : own.breakEven.kind === "none" ? (
      f.breakEvenNone
    ) : (
      f.breakEvenUnknown
    );

  return (
    <div className="grid gap-5">
      <dl className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["offerer", f.offererNet, result.offererNetProceeds],
            ["requester", f.requesterDelivered, result.requesterDeliveredCost],
          ] as const
        ).map(([party, label, value]) => (
          <div key={party} className={`grid content-start gap-1 rounded-xl border p-4 ${own.party === party ? "border-ink/40 bg-mint" : "border-line bg-canvas"}`}>
            <dt className="text-[15px] font-medium text-balance">{label}</dt>
            <dd className="text-[1.75rem] leading-tight font-semibold tabular-nums">{amount(value)}</dd>
            <dd className="text-[13px] leading-normal">{f.beforeOtherCosts}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[15px] leading-relaxed text-pretty">
        {f.materialPayment}: <span className="font-semibold tabular-nums">{amount(result.materialPayment)}</span>
        {freightNote && <> · {freightNote}</>}
      </p>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg leading-tight font-semibold">{f.youAre[own.party]}</h3>
          {own.status && (
            <Badge tone="outline">
              {f.status}: {t.assessmentLabels.costStatus[own.status]}
            </Badge>
          )}
        </div>
        <Facts
          rows={[
            { label: own.party === "offerer" ? f.yourTotalOfferer : f.yourTotalRequester, value: <span className="font-semibold tabular-nums">{amount(own.total)}</span> },
            ...(own.party === "requester"
              ? [{ label: f.perUsable.replace("{unit}", unitLabel), value: <span className="tabular-nums">{own.perUsableUnit == null ? t.common.unknown : `${money.format(own.perUsableUnit)}${NBSP}/${NBSP}${unitLabel}`}</span> }]
              : []),
            { label: f.yourBaseline, value: <span className="tabular-nums">{amount(own.baseline)}</span> },
            { label: f.contribution, value: <span className="font-semibold tabular-nums">{amount(own.contribution)}</span> },
            { label: f.breakEven, value: breakEven },
          ]}
        />
      </div>
      {own.missing.length > 0 && (
        <Notice tone="attention" title={f.missing}>
          {own.missing.map((key) => t.assessmentLabels.missing[key] ?? key).join(", ")}
        </Notice>
      )}
      {result.problems.length > 0 && <Notice tone="attention">{result.problems.map((problem) => t.assessmentLabels.errors[problem.code] ?? problem.code).join(" ")}</Notice>}
    </div>
  );
}
