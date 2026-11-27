// Sections of the private assessments: economic feasibility and environmental assessment on the match comparison
// (PG-22), commercial comparison on the negotiation (PG-24). Result on the left, inputs on the right from 1024 px.
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import type { EnvironmentView, MatchFeasibilityView, NegotiationFeasibilityView } from "@/server/dal/assessments";
import { Badge, Notice, Section } from "@/components/ui/elements";
import { EuroIcon, RecycleIcon, ShieldCheckIcon } from "@/components/ui/icons";
import type { Formatters } from "@/components/offers/format";
import { ApproveButton, EnvironmentForm } from "./environment-form";
import { EnvironmentResultView } from "./environment-result";
import { FeasibilityForm } from "./feasibility-form";
import { FeasibilityResultView } from "./feasibility-result";

type Common = { t: PlatformMessages; locale: Locale; format: Formatters; units: { key: string; label: string }[] };

function SavedLine({ saved, t, format, unsaved = t.feasibility.notSaved }: { saved: MatchFeasibilityView["saved"]; t: PlatformMessages; format: Formatters; unsaved?: string }) {
  return <p className="text-[13px] leading-normal">{saved ? `${t.feasibility.saved}: ${format.dateTime(saved.updatedAt)}` : unsaved}</p>;
}

const split = "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";

export function MatchFeasibilitySection({ view, subject, t, locale, format, units }: Common & { view: MatchFeasibilityView; subject: { kind: "match"; requestId: number; offerId: number } }) {
  const unitLabel = format.unitName(view.inputs.unitKey) || view.inputs.unitKey;
  return (
    <Section title={t.feasibility.title} icon={<EuroIcon size={18} />} id="feasibility">
      <div className="mb-5 grid gap-2">
        <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{t.feasibility.matchIntro}</p>
        <p className="flex max-w-[68ch] items-start gap-2 text-[15px] leading-relaxed font-medium text-pretty">
          <ShieldCheckIcon size={18} className="mt-0.5 flex-none" />
          {t.feasibility.privateNote}
        </p>
      </div>
      <div className={split}>
        <div className="grid min-w-0 gap-3">
          <h3 className="text-lg leading-tight font-semibold">{t.feasibility.results}</h3>
          <SavedLine saved={view.saved} t={t} format={format} />
          {view.result ? (
            <FeasibilityResultView result={view.result} unitLabel={unitLabel} t={t} locale={locale} formatQuantity={(value) => format.quantity(value, view.inputs.unitKey)} />
          ) : (
            <Notice tone="attention">{t.feasibility.noTotal}</Notice>
          )}
          <p className="text-[13px] leading-normal text-pretty">{t.feasibility.notBinding}</p>
        </div>
        <div className="min-w-0">
          <FeasibilityForm subject={subject} revision={view.saved?.revision ?? null} party={view.party} initial={view.inputs} units={units} unitLabel={unitLabel} t={t} />
        </div>
      </div>
    </Section>
  );
}

export function EnvironmentSection({ view, subject, t, locale, format, units }: Common & { view: EnvironmentView; subject: { kind: "match"; requestId: number; offerId: number } }) {
  const e = t.environment;
  return (
    <Section title={e.title} icon={<RecycleIcon size={18} />} id="environment">
      <div className="mb-5 grid gap-3">
        <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{e.intro}</p>
        <Notice tone="attention">{e.exampleWarning}</Notice>
      </div>
      <div className={split}>
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg leading-tight font-semibold">{t.feasibility.results}</h3>
            {view.saved?.status === "approved" && <Badge tone="solid">{e.approved}</Badge>}
          </div>
          <SavedLine saved={view.saved} t={t} format={format} />
          {view.result ? <EnvironmentResultView result={view.result} inputs={view.inputs} factors={view.factors} t={t} locale={locale} /> : <Notice tone="attention">{e.noClaim}</Notice>}
          {view.saved && view.saved.status === "draft" && view.result && view.result.status !== "incomplete" && <ApproveButton assessmentId={view.saved.id} revision={view.saved.revision} t={t} />}
        </div>
        <div className="min-w-0">
          <EnvironmentForm subject={subject} revision={view.saved?.revision ?? null} initial={view.inputs} factors={view.factors} units={units} t={t} locale={locale} />
        </div>
      </div>
    </Section>
  );
}

export function NegotiationFeasibilitySection({ view, negotiationId, revision, t, locale, format, units }: Common & { view: NegotiationFeasibilityView; negotiationId: number; revision: number }) {
  const unitKey = view.shared?.unit.key ?? "kg";
  const unitLabel = format.unitName(unitKey) || unitKey;
  return (
    <Section title={t.feasibility.negotiationTitle} icon={<EuroIcon size={18} />} id="feasibility">
      <div className="grid gap-5">
        <div className="grid gap-2">
          <p className="prose-justify max-w-[68ch] text-[15px] leading-relaxed">{t.feasibility.negotiationIntro.replace("{revision}", String(revision))}</p>
          <p className="flex max-w-[68ch] items-start gap-2 text-[15px] leading-relaxed font-medium text-pretty">
            <ShieldCheckIcon size={18} className="mt-0.5 flex-none" />
            {t.feasibility.privateNote}
          </p>
          {view.shared && view.shared.freight == null && <p className="max-w-[68ch] text-[13px] leading-normal text-pretty">{t.feasibility.noProposalFreight}</p>}
        </div>
        <SavedLine saved={view.saved} t={t} format={format} unsaved={t.feasibility.notSavedNegotiation} />
        {view.result ? <FeasibilityResultView result={view.result} unitLabel={unitLabel} t={t} locale={locale} formatQuantity={(value) => format.quantity(value, unitKey)} /> : <Notice tone="attention">{t.feasibility.noTotal}</Notice>}
        <details className="rounded-xl border border-line" open={view.saved == null || undefined}>
          <summary className="cursor-pointer px-4 py-3 text-[15px] font-semibold">{t.feasibility.editOwnFigures}</summary>
          <div className="border-t border-line p-4">
            <FeasibilityForm subject={{ kind: "negotiation", negotiationId }} revision={view.saved?.revision ?? null} party={view.party} initial={view.inputs} units={units} unitLabel={unitLabel} t={t} />
          </div>
        </details>
        <p className="text-[13px] leading-normal text-pretty">{t.feasibility.notBinding}</p>
      </div>
    </Section>
  );
}
