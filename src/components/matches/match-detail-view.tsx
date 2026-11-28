// Individual match (PG-22): one request against one offer, criterion by criterion (L2-005, D15). Requirements decide
// the result, preferences stand next to it, missing data is listed as questions for the offerer, preparation steps
// name possible processors (L2-009 candidates). No score anywhere.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { formatAttributeValue } from "@/server/domain/attributes";
import { nameOf, type Catalogue } from "@/server/domain/catalogue";
import type { Origin } from "@/server/domain/listing";
import type { CriterionCheck } from "@/server/domain/matching";
import type { MatchDetail } from "@/server/dal/matches";
import { EmptyState, Notice, PageHeader, Section, buttonPrimary, buttonSecondary } from "@/components/ui/elements";
import { AlertIcon, CheckIcon, FactoryIcon, HandshakeIcon, InfoIcon, RecycleIcon, SendIcon } from "@/components/ui/icons";
import { offerPath, requestPath, sitePath } from "@/components/layout/links";
import type { Formatters } from "@/components/offers/format";
import { deliveryList, formatCriterion, maxPrice, names, originList, window } from "@/components/requests/format-request";
import { MatchBadge, OutcomeLabel } from "./match-badge";

type Props = {
  detail: MatchDetail;
  catalogue: Catalogue;
  t: PlatformMessages;
  locale: Locale;
  format: Formatters;
  back: ReactNode;
  /** Propose terms for this pair, or continue the open negotiation of the two sites (L2-006). */
  trade?: { href: string; existing: boolean };
};

export function MatchDetailView({ detail, catalogue, t, locale, format, back, trade }: Props) {
  const { request, offer, evaluation } = detail;
  const m = t.matches;
  const d = t.requestDetail;
  const definitionOf = (key: string) => catalogue.attributes.find((candidate) => candidate.categoryId === request.category?.id && candidate.key === key);

  /** What the request asks and what the offer states, for one criterion. */
  function sides(check: CriterionCheck): [string, string, string] {
    const key = check.key;
    if (key.startsWith("attributes.")) {
      const attribute = key.slice("attributes.".length);
      const definition = definitionOf(attribute);
      const value = offer.attributes[attribute];
      if (!definition) return [attribute, "", ""];
      return [nameOf(definition, locale), formatCriterion(definition, request.criteria[attribute], locale), value ? formatAttributeValue(definition, value, locale) : t.common.unknown];
    }
    const label = m.criteria[key] ?? key;
    switch (key) {
      case "category":
        return [label, request.category ? nameOf(request.category, locale) : t.common.notStated, offer.category ? nameOf(offer.category, locale) : t.common.unknown];
      case "type":
        return [label, names(request.types, locale, t.common.notStated), offer.type ? nameOf(offer.type, locale) : t.common.unknown];
      case "form":
        return [label, names(request.forms, locale, t.common.notStated), offer.form ? nameOf(offer.form, locale) : t.common.unknown];
      case "origin":
        return [label, originList(request.origins, t), offer.origin ? t.labels.origin[offer.origin as Origin] : t.common.unknown];
      case "quantity":
        return [
          label,
          request.minLot != null ? `${d.atLeast} ${format.quantity(request.minLot, request.unitKey)}` : format.quantity(request.quantity, request.unitKey),
          format.quantity(offer.quantity, offer.unitKey),
        ];
      case "minLot":
        return [label, format.quantity(request.quantity, request.unitKey), format.quantity(offer.minLot, offer.unitKey)];
      case "timing":
        return [label, window(request.neededFrom, request.neededUntil, format, t) ?? t.common.notStated, window(offer.availableFrom, offer.collectionUntil, format, t) ?? t.common.notStated];
      case "evidence":
        return [label, `${d.atLeast} ${t.labels.evidence[request.evidenceStatus as keyof typeof t.labels.evidence]}`, offer.evidenceStatus ? t.labels.evidence[offer.evidenceStatus as keyof typeof t.labels.evidence] : t.common.unknown];
      case "sample":
        return [label, d.sampleRequired, t.labels.sample[offer.sampleAvailable as keyof typeof t.labels.sample] ?? offer.sampleAvailable];
      case "frequency":
        return [label, format.frequency(request.frequency, request.recurrencePeriod), format.frequency(offer.frequency, offer.recurrencePeriod)];
      case "price":
        return [label, `${d.atMost} ${maxPrice(request.maxPriceAmount, request.maxPriceUnitKey, locale, t, catalogue)}`, format.price(offer).main];
      case "delivery":
        return [label, deliveryList(request.deliveryTerms, t), deliveryList(offer.deliveryOptions.map((option) => option.term), t)];
      default:
        return [label, "", ""];
    }
  }

  const hard = evaluation.checks.filter((check) => check.hard);
  const preferences = evaluation.checks.filter((check) => !check.hard);
  const missing = hard.filter((check) => check.outcome === "unknown");

  // Narrow screens: one stacked entry per criterion with the result next to its name – a table would push the
  // result column out of view. From 640 px the same data as a table.
  const table = (checks: CriterionCheck[]) => (
    <>
      <ul className="grid sm:hidden">
        {checks.map((check) => {
          const [label, wanted, offered] = sides(check);
          return (
            <li key={check.key} className="grid gap-1 border-b border-line py-3 text-[15px] last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 font-semibold break-words">{label}</span>
                <OutcomeLabel outcome={check.outcome} t={t} />
              </div>
              <p className="break-words"><span className="text-muted">{m.requested}:</span> {wanted}</p>
              <p className="break-words"><span className="text-muted">{m.offered}:</span> {offered}</p>
              {check.steps && <p className="text-[13px] text-muted">{check.steps.map((step) => t.labels.capability[step]).join(" → ")}</p>}
            </li>
          );
        })}
      </ul>
      <div className="scroll-thin hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[34rem] text-left text-[15px]">
          <thead>
            <tr className="border-b border-line text-[13px]">
              <th scope="col" className="py-2 pr-4 font-semibold">{m.criterion}</th>
              <th scope="col" className="py-2 pr-4 font-semibold">{m.requested}</th>
              <th scope="col" className="py-2 pr-4 font-semibold">{m.offered}</th>
              <th scope="col" className="py-2 font-semibold">{m.result}</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => {
              const [label, wanted, offered] = sides(check);
              return (
                <tr key={check.key} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-2.5 pr-4 align-top font-medium">{label}</th>
                  <td className="py-2.5 pr-4 align-top break-words">{wanted}</td>
                  <td className="py-2.5 pr-4 align-top break-words">{offered}</td>
                  <td className="py-2.5 align-top">
                    <OutcomeLabel outcome={check.outcome} t={t} />
                    {check.steps && <span className="mt-0.5 block text-[13px] text-muted">{check.steps.map((step) => t.labels.capability[step]).join(" → ")}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

  const action =
    detail.side === "request" ? (
      <Link href={`${offerPath(offer.id)}#contact`} className={buttonPrimary}>
        <SendIcon size={18} />
        {m.contactOfferer}
      </Link>
    ) : (
      <Link href={`${requestPath(request.id)}#respond`} className={buttonPrimary}>
        <SendIcon size={18} />
        {m.respond}
      </Link>
    );

  return (
    <>
      <PageHeader title={m.detailTitle} back={back} intro={`${request.ref} ${request.title} · ${offer.ref} ${offer.title}`} />

      <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="result">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="result" className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">{m.result}</h2>
          <MatchBadge result={evaluation.result} t={t} />
        </div>
        <p className="prose-justify text-[15px] leading-relaxed">{t.l2labels.matchResultText[evaluation.result]}</p>
        <dl className="grid gap-x-8 gap-y-3 text-[15px] sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-[13px] text-muted">{m.requested}</dt>
            <dd className="font-semibold break-words">
              <Link href={requestPath(request.id)} className="underline underline-offset-4">{request.title}</Link>
            </dd>
            <dd className="text-[13px] text-muted">{request.requester.companyName} – {request.requester.name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[13px] text-muted">{m.offered}</dt>
            <dd className="font-semibold break-words">
              <Link href={offerPath(offer.id)} className="underline underline-offset-4">{offer.title}</Link>
            </dd>
            <dd className="text-[13px] text-muted">{offer.supplier.companyName} – {offer.supplier.name}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">{m.distance}</dt>
            <dd className="font-semibold tabular-nums">{format.distance(detail.distanceKm, detail.distanceKm != null)}</dd>
          </div>
        </dl>
        {evaluation.result !== "incompatible" && (
          <p className="flex flex-wrap gap-3">
            {action}
            {trade && (
              <Link href={trade.href} className={buttonSecondary}>
                <HandshakeIcon size={18} />
                {trade.existing ? t.tradeEntry.continue : t.tradeEntry.propose}
              </Link>
            )}
          </p>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <Section title={m.hard} icon={<HandshakeIcon size={18} />} id="requirements">
            {table(hard)}
          </Section>
          <Section title={m.preferences} icon={<CheckIcon size={18} />} id="preferences">
            <p className="mb-3 text-[13px] leading-normal text-pretty text-muted">{m.preferencesText}</p>
            {preferences.length === 0 ? <p className="text-[15px]">{m.noPreferences}</p> : table(preferences)}
          </Section>
        </div>

        <div className="grid min-w-0 gap-6">
          <Section title={m.missing} icon={<InfoIcon size={18} />} id="missing">
            {missing.length === 0 ? (
              <p className="text-[15px]">{m.missingNone}</p>
            ) : (
              <>
                <p className="mb-3 text-[13px] leading-normal text-pretty text-muted">{m.missingText}</p>
                <ul className="grid gap-1.5 text-[15px]">
                  {missing.map((check) => (
                    <li key={check.key} className="flex items-start gap-2">
                      <AlertIcon size={16} className="mt-0.5 text-notice" />
                      <span>{sides(check)[0]}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {evaluation.steps.length > 0 && (
            <Section title={m.steps} icon={<RecycleIcon size={18} />} id="steps">
              <p className="mb-3 text-[13px] leading-normal text-pretty text-muted">{m.stepsText}</p>
              <ol className="mb-4 grid gap-1.5 text-[15px]">
                {evaluation.steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="grid size-6 flex-none place-items-center rounded-md bg-mint text-[13px] font-semibold tabular-nums">{index + 1}</span>
                    <span className="font-medium">{t.labels.capability[step]}</span>
                    {detail.receiverCapabilities.includes(step) && <span className="sr-only">{m.receiverCan}</span>}
                  </li>
                ))}
              </ol>
              {evaluation.steps.some((step) => detail.receiverCapabilities.includes(step)) && <Notice>{m.receiverCan}</Notice>}
              <h3 className="mt-4 mb-1 text-lg leading-tight font-semibold">{m.processors}</h3>
              <p className="mb-3 text-[13px] leading-normal text-pretty text-muted">{m.processorsText}</p>
              {detail.processors.length === 0 ? (
                <EmptyState icon={<FactoryIcon size={20} />} title={m.processorsNone} />
              ) : (
                <ul className="grid gap-2">
                  {detail.processors.map((processor) => (
                    <li key={processor.id} className="grid gap-0.5 border-b border-line py-2 last:border-b-0">
                      <Link href={sitePath(processor.id)} className="w-fit text-[15px] font-medium break-words underline underline-offset-4">
                        {processor.companyName} – {processor.name}
                      </Link>
                      <span className="text-[13px] text-muted">
                        {processor.capabilities.map((capability) => t.labels.capability[capability]).join(", ")} · {[processor.parkName, processor.city].filter(Boolean).join(", ")} ·{" "}
                        {format.distance(processor.distanceKm, processor.distanceKm != null)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <Notice>{m.estimatesNote}</Notice>
          <p className="flex flex-wrap gap-3">
            <Link href={requestPath(request.id)} className={buttonSecondary}>{m.viewRequest}</Link>
            <Link href={offerPath(offer.id)} className={buttonSecondary}>{m.viewOffer}</Link>
          </p>
        </div>
      </div>
    </>
  );
}
