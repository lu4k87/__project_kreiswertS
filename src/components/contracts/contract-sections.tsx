// Sections of Level 2, part 4 on the existing pages: the contract and the combined chain benefit on the negotiation
// (PG-24), the simulated payment on the exchange (PG-26). Server components; the buttons are client islands.
import Link from "next/link";
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import type { ChainView } from "@/server/dal/chain";
import type { ContractSummary } from "@/server/dal/contracts";
import type { ExchangePayment } from "@/server/dal/payments";
import type { ChainBenefit } from "@/server/domain/chain";
import type { PaymentAmount } from "@/server/domain/payment";
import { Badge, Facts, Notice, Section, buttonSecondary } from "@/components/ui/elements";
import { EuroIcon, FileTextIcon, HandshakeIcon } from "@/components/ui/icons";
import { ChainConsentButtons } from "./chain-consent";
import { CreateContractButton } from "./contract-actions";
import { contractPath } from "./contract-errors";
import { PaymentButtons, RefundForm, StartPaymentButton } from "./payment-actions";

export const formatCents = (locale: Locale, cents: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
const formatEuro = (locale: Locale, euro: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(euro);
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

// ── Contract on the negotiation ─────────────────────────────────────────────────────────────────────────

export function ContractSection({ negotiationId, contract, agreed, canCreate, t }: { negotiationId: number; contract: ContractSummary | null; agreed: boolean; canCreate: boolean; t: PlatformMessages }) {
  const c = t.contract;
  const l = t.contractLabels;
  return (
    <Section title={c.title} icon={<FileTextIcon size={18} />} id="contract">
      <div className="grid gap-4">
        <p className="prose-justify text-[15px] leading-relaxed">{c.sectionIntro}</p>
        {contract ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-[15px]">
              <span translate="no">{contract.ref}</span>
              <Badge tone={contract.status === "signed" ? "solid" : "neutral"}>{l.contractStatus[contract.status]}</Badge>
              {contract.status === "signed" && <Badge tone="outline">{l.execution[contract.execution.state]}</Badge>}
            </p>
            <Link href={contractPath(contract.id)} className={`${buttonSecondary} justify-self-start`}>
              <FileTextIcon size={18} />
              {c.open}
            </Link>
          </>
        ) : agreed ? (
          canCreate ? <CreateContractButton negotiationId={negotiationId} t={t} /> : null
        ) : (
          <p className="text-[15px] text-pretty">{c.notAgreed}</p>
        )}
        <p className="text-[13px] leading-normal text-pretty">{c.prototypeNote}</p>
      </div>
    </Section>
  );
}

// ── Combined chain benefit on the negotiation ───────────────────────────────────────────────────────────

function ChainTotal({ combined, locale, t }: { combined: ChainBenefit; locale: Locale; t: PlatformMessages }) {
  const c = t.chain;
  return (
    <div className="grid gap-1 rounded-xl border border-line bg-mint p-4">
      <p className="text-[13px]">{c.total}</p>
      {combined.total != null ? (
        <p className="text-[1.75rem] leading-tight font-semibold tabular-nums whitespace-nowrap">{formatEuro(locale, combined.total)}</p>
      ) : (
        <p className="text-[15px] font-medium text-pretty">{fill(c.unknown, { sides: combined.unknown.map((side) => c.sides[side]).join(" / ") })}</p>
      )}
      {combined.status && <p className="text-[13px]">{c.status}: {t.assessmentLabels.costStatus[combined.status]}</p>}
      <p className="text-[13px] leading-normal text-pretty">{c.estimate}</p>
    </div>
  );
}

export function ChainSection({ view, negotiationId, verified, locale, t }: { view: ChainView; negotiationId: number; verified: boolean; locale: Locale; t: PlatformMessages }) {
  const c = t.chain;
  const own = view.ownConsent === "valid" ? c.ownValid : view.ownConsent === "outdated" ? c.ownOutdated : c.ownNone;
  const other = view.otherConsent === "valid" ? c.otherValid : c.otherNone;
  return (
    <Section title={c.title} icon={<HandshakeIcon size={18} />} id="chain">
      <div className="grid gap-4">
        <p className="prose-justify text-[15px] leading-relaxed">{c.intro}</p>
        {view.combined ? <ChainTotal combined={view.combined} locale={locale} t={t} /> : <p className="text-[15px] text-pretty">{c.waiting}</p>}
        <ul className="grid gap-1 text-[15px]">
          <li>{own}</li>
          <li>{other}</li>
        </ul>
        <div className="grid gap-3 rounded-xl border border-line p-4">
          <p className="font-semibold">{c.consentTitle}</p>
          <p className="prose-justify text-[15px] leading-relaxed">{c.consentText}</p>
          {!view.own ? (
            <p className="text-[15px] font-medium text-pretty">{c.needAssessment}</p>
          ) : verified ? (
            <ChainConsentButtons negotiationId={negotiationId} assessmentRevision={view.own.revision} termsRevision={view.termsRevision} released={view.ownConsent === "valid"} t={t} />
          ) : null}
        </div>
        {view.simulated && <p className="text-[13px] leading-normal text-pretty">{t.trade.simulatedText}</p>}
      </div>
    </Section>
  );
}

// ── Simulated payment on the exchange ───────────────────────────────────────────────────────────────────

function AmountFacts({ amount, role, locale, t }: { amount: PaymentAmount; role: "offerer" | "requester"; locale: Locale; t: PlatformMessages }) {
  const m = t.payment;
  const party = (side: string) => (side === role ? t.contract.yourSite : side === "offerer" ? m.offerer : m.requester);
  return (
    <div className="grid gap-3">
      <Facts
        rows={[
          ...amount.lines.map((line, index) => ({
            key: `line-${index}`,
            label: m.lines[line.kind] ?? line.kind,
            value: <span className="tabular-nums whitespace-nowrap">{formatCents(locale, line.cents)}</span>,
            note: fill(m.flow, { from: party(line.from), to: party(line.to) }),
          })),
          {
            key: "net",
            label: m.net,
            value: amount.amountCents != null ? <span className="font-semibold tabular-nums whitespace-nowrap">{formatCents(locale, amount.amountCents)}</span> : "–",
            note: amount.payer ? (amount.payer === role ? m.youPay : m.youReceive) : undefined,
          },
          { key: "vat", label: m.vatBasis, value: t.labels.vatBasis[amount.vatBasis] },
        ]}
      />
      <p className="text-[13px] leading-normal text-pretty">{m.vatNote}</p>
      {amount.freightOutside && <p className="text-[13px] leading-normal text-pretty">{m.freightOutside}</p>}
    </div>
  );
}

export function PaymentSection({ view, role, locale, t, dateTime }: { view: ExchangePayment; role: "offerer" | "requester"; locale: Locale; t: PlatformMessages; dateTime: (iso: string) => string }) {
  const m = t.payment;
  const l = t.contractLabels;
  const current = view.current;
  const blockedText = view.blocked && view.blocked !== "PAYMENT_EXISTS" ? m.blocked[view.blocked] : null;
  return (
    <Section title={m.title} icon={<EuroIcon size={18} />} id="payment" aside={<Badge tone="outline">{m.badge}</Badge>}>
      <div className="grid gap-4">
        <Notice tone="attention">{m.notice}</Notice>
        {view.due && (
          <div className="grid gap-2">
            <h3 className="text-lg leading-tight font-semibold text-balance">{m.due}</h3>
            <AmountFacts amount={view.due} role={role} locale={locale} t={t} />
          </div>
        )}
        {current && (
          <div className="grid gap-3 rounded-xl border border-line p-4">
            <p className="flex flex-wrap items-center gap-2 text-[15px]">
              <span className="font-semibold" translate="no">{current.ref}</span>
              <Badge tone={current.status === "captured" ? "solid" : current.status === "failed" ? "attention" : "neutral"}>{l.paymentStatus[current.status]}</Badge>
              <span className="tabular-nums whitespace-nowrap">{formatCents(locale, current.amountCents)}</span>
            </p>
            <p className="prose-justify text-[15px] leading-relaxed">{l.paymentStatusText[current.status]}</p>
            <Facts
              rows={[
                { label: m.provider, value: m.providerName },
                { label: m.reference, value: <span className="break-all" translate="no">{current.providerRef}</span> },
                { label: m.refundReason, value: current.refundReason },
              ]}
            />
            {current.status === "authorised" && !current.actions.includes("capture") && <p className="text-[13px] leading-normal text-pretty">{m.captureWait}</p>}
            {current.actions.includes("capture") && <p className="text-[15px] text-pretty">{m.captureText}</p>}
            <PaymentButtons paymentId={current.id} actions={current.actions} t={t} />
            {current.actions.includes("refund") && (
              <details className="rounded-lg border border-line">
                <summary className="cursor-pointer px-3 py-2 text-[15px] font-semibold">{m.refundTitle}</summary>
                <div className="border-t border-line p-3">
                  <RefundForm paymentId={current.id} t={t} />
                </div>
              </details>
            )}
            <details className="rounded-lg border border-line">
              <summary className="cursor-pointer px-3 py-2 text-[15px] font-semibold">{m.history}</summary>
              <ol className="grid gap-1 border-t border-line p-3">
                {current.events.map((event, index) => (
                  <li key={index} className="grid gap-0.5 border-b border-line py-1.5 text-[15px] last:border-b-0">
                    <span className="font-medium">{m.events[event.action] ?? event.action}</span>
                    <span className="text-[13px]">{m.sources[event.source]} · {dateTime(event.createdAt)}</span>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        )}
        {view.blocked === null && (
          <div className="grid gap-3">
            <p className="prose-justify text-[15px] leading-relaxed">{m.startText}</p>
            <StartPaymentButton exchangeId={view.exchange.id} t={t} />
          </div>
        )}
        {blockedText && <p className="text-[15px] text-pretty">{blockedText}</p>}
        {view.earlier.length > 0 && (
          <p className="text-[13px] leading-normal text-pretty">
            {m.earlier}: {view.earlier.map((payment) => `${payment.ref} (${l.paymentStatus[payment.status]})`).join(", ")}
          </p>
        )}
        {view.contract && (
          <Link href={contractPath(view.contract.id)} className={`${buttonSecondary} justify-self-start`}>
            <FileTextIcon size={18} />
            {m.toContract} <span translate="no">{view.contract.ref}</span>
          </Link>
        )}
      </div>
    </Section>
  );
}
