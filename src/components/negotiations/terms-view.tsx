// The terms of one proposal revision as label / value rows (L2-006). Terms that changed against the revision before
// carry a marker – the only colour on the list, because a change is what the reader has to check.
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import type { TermKey } from "@/server/domain/negotiation";
import type { TermsView } from "@/server/dal/negotiations";
import { Badge, Facts } from "@/components/ui/elements";
import type { Formatters } from "@/components/offers/format";

type Props = { terms: TermsView; changed?: TermKey[]; t: PlatformMessages; locale: Locale; format: Formatters };

export function TermsFacts({ terms, changed = [], t, locale, format }: Props) {
  const l = t.tradeLabels;
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const label = (text: string, keys: TermKey[]) =>
    keys.some((key) => changed.includes(key)) ? (
      <span className="inline-flex flex-wrap items-center gap-2">
        {text}
        <Badge tone="attention">{t.negotiationDetail.changed}</Badge>
      </span>
    ) : (
      text
    );
  const price =
    terms.priceAmount == null
      ? null
      : (() => {
          const shown = format.price({ priceMode: "fixed", priceAmount: terms.priceAmount, priceUnitKey: terms.priceUnitKey, vatBasis: terms.vatBasis, payer: null });
          return { main: shown.main, note: shown.notes.join(" · ") };
        })();
  const freight =
    terms.freightAmount == null
      ? t.common.notStated
      : [
          money.format(terms.freightAmount),
          terms.freightCostStatus && l.costStatus[terms.freightCostStatus],
          terms.freightPayer && `${l.term.freightPayer}: ${l.freightPayer[terms.freightPayer]}${terms.freightPayer === "shared" && terms.offererSharePercent != null ? ` (${l.freightPayer.offerer} ${terms.offererSharePercent}${" "}%)` : ""}`,
        ]
          .filter(Boolean)
          .join(" · ");
  const window =
    terms.deliveryFrom || terms.deliveryUntil
      ? [terms.deliveryFrom && `${t.common.from} ${format.date(terms.deliveryFrom)}`, terms.deliveryUntil && `${t.common.until} ${format.date(terms.deliveryUntil)}`].filter(Boolean).join(" ")
      : t.common.notStated;
  const rows = [
    { label: label(l.term.quantity, ["quantity", "unitKey"]), key: "quantity", value: format.quantity(terms.quantity, terms.unitKey) },
    { label: label(l.term.paymentDirection, ["paymentDirection"]), key: "payment", value: l.paymentDirection[terms.paymentDirection] },
    { label: label(l.term.priceAmount, ["priceAmount", "priceUnitKey", "vatBasis"]), key: "price", value: price?.main ?? "–", note: price?.note },
    {
      label: label(l.term.deliveryTerm, ["deliveryTerm"]),
      key: "term",
      value: t.labels.deliveryTerm[terms.deliveryTerm].name,
      note: terms.incotermsVersion ? `Incoterms® ${terms.incotermsVersion}` : t.labels.deliveryTerm[terms.deliveryTerm].text,
    },
    { label: label(l.term.namedPlace, ["namedPlace"]), key: "place", value: terms.namedPlace },
    { label: label(l.term.transportOrganiser, ["transportOrganiser"]), key: "transport", value: l.transportOrganiser[terms.transportOrganiser] },
    { label: label(l.term.freightAmount, ["freightAmount", "freightCostStatus", "freightPayer", "offererSharePercent"]), key: "freight", value: freight },
    { label: label(t.trade.deliveryWindow, ["deliveryFrom", "deliveryUntil"]), key: "window", value: window },
    { label: label(l.term.technicalConditions, ["technicalConditions"]), key: "technical", value: terms.technicalConditions ?? t.common.notStated },
  ];
  return <Facts rows={rows} />;
}
