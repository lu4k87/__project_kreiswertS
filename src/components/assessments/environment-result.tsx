// Result of the environmental assessment (L2-008, D18): reference displacement, transport-only and the lifecycle
// comparison kept apart, what is missing, and every factor with unit, version, geography, boundary and source. The
// section around it carries the example-value warning (illustrative results, D18).
// Without a baseline or a factor the page says so instead of showing a CO₂e number.
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import type { Comparison, EnvironmentResult } from "@/server/domain/environment";
import type { FactorView } from "@/server/dal/assessments";
import type { EnvironmentalInput } from "@/server/validation/assessments";
import { Badge, Notice } from "@/components/ui/elements";

const NBSP = "\u00a0";

type Props = { result: EnvironmentResult; inputs: EnvironmentalInput; factors: FactorView[]; t: PlatformMessages; locale: Locale };

export function EnvironmentResultView({ result, inputs, factors, t, locale }: Props) {
  const e = t.environment;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const co2 = (value: number) => `${number.format(value)}${NBSP}kg${NBSP}CO₂e`;
  const used = [inputs.existing?.treatmentFactorId, inputs.processingFactorId, inputs.residueTreatmentFactorId, inputs.virginProductionFactorId, inputs.transportFactorId];
  const usedFactors = factors.filter((factor) => used.includes(factor.id));

  const comparison = (title: string, text: string, value: Comparison) => (
    <div className="grid content-start gap-2 rounded-xl border border-line bg-canvas p-4">
      <h4 className="text-[15px] font-semibold">{title}</h4>
      <p className="text-[13px] leading-normal text-pretty">{text}</p>
      <dl className="grid gap-1 text-[15px]">
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt>{e.existingRoute}</dt>
          <dd className="tabular-nums">{co2(value.existingKg)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt>{e.proposedRoute}</dt>
          <dd className="tabular-nums">{co2(value.proposedKg)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 border-t border-line pt-1 font-semibold">
          <dt>{e.difference}</dt>
          <dd className="tabular-nums">
            {co2(Math.abs(value.differenceKg))} {value.differenceKg <= 0 ? e.lessText : e.moreText}
          </dd>
        </div>
      </dl>
    </div>
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={result.status === "complete" ? "solid" : result.status === "transport_only" ? "neutral" : "attention"}>{t.assessmentLabels.environmentStatus[result.status]}</Badge>
      </div>

      <div className="grid gap-1 rounded-xl border border-line bg-mint p-4">
        <p className="text-[15px] font-medium">{e.displacement}</p>
        {result.displacementKg != null && result.quantityKg != null ? (
          <>
            <p className="text-[1.75rem] leading-tight font-semibold tabular-nums">
              {number.format(result.displacementKg)}
              {NBSP}kg
            </p>
            <p className="text-[13px] leading-normal tabular-nums">
              {e.displacementFormula
                .replace("{quantity}", number.format(result.quantityKg))
                .replace("{yield}", number.format(inputs.yieldPercent ?? 0))
                .replace("{substitution}", number.format(inputs.substitutionPercent ?? 0))
                .replace("{displacement}", number.format(result.displacementKg))}
            </p>
          </>
        ) : (
          <p className="text-[15px]">{e.displacementUnknown}</p>
        )}
      </div>

      <div className="grid gap-3">
        {result.transport && comparison(e.transportOnly, e.transportText, result.transport)}
        {result.lifecycle && comparison(e.lifecycle, e.lifecycleText, result.lifecycle)}
      </div>
      {!result.lifecycle && <Notice tone="attention" title={e.noClaim}>{result.missing.length > 0 && `${e.missing}: ${result.missing.map((key) => t.assessmentLabels.missing[key] ?? key).join(", ")}`}</Notice>}
      {inputs.assumptions && (
        <p className="text-[15px] leading-relaxed break-words whitespace-pre-line">
          <span className="font-medium">{e.assumptions}:</span> {inputs.assumptions}
        </p>
      )}

      {usedFactors.length > 0 && (
        <div className="grid gap-2">
          <h4 className="text-[15px] font-semibold">{e.factorsUsed}</h4>
          <ul className="grid gap-2">
            {usedFactors.map((factor) => (
              <li key={factor.id} className="grid gap-0.5 border-b border-line pb-2 text-[15px] last:border-b-0">
                <span className="font-medium break-words">{locale === "de" ? factor.nameDe : factor.nameEn}</span>
                <span className="text-[13px] leading-normal break-words">
                  {number.format(factor.value)} {t.assessmentLabels.factorUnit[factor.unit]} · {e.version} {factor.version} · {factor.geography} · {t.assessmentLabels.boundary[factor.boundary]}
                </span>
                <span className="text-[13px] leading-normal break-words">
                  {e.source}: {factor.example ? e.exampleSource : factor.source}
                </span>
                {!factor.example && factor.sourceUrl && (
                  <a href={factor.sourceUrl} target="_blank" rel="noopener noreferrer" className="w-fit text-[13px] font-medium underline underline-offset-4">
                    {t.factorSource.openSource}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
