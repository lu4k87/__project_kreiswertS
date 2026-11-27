// How the parts of a request are written – criteria, accepted lists, the price ceiling, the time window. The same in
// cards, detail and the comparison page. Pure (no server import) → used by server and client components.
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { findUnit, nameOf, type AttributeDefinition, type Catalogue, type Named } from "@/server/domain/catalogue";
import type { DeliveryTerm, Origin } from "@/server/domain/listing";
import type { CriterionValue } from "@/server/domain/request-rules";
import type { Formatters } from "@/components/offers/format";

const NBSP = "\u00a0";

/** "3–6 mm", "≥ 0.5 g/10 min", "≤ 2 %", the enum label or the text. Number and unit stay together. */
export function formatCriterion(definition: AttributeDefinition, criterion: CriterionValue, locale: Locale): string {
  if (definition.dataType === "enum") {
    const option = definition.options.find((candidate) => candidate.value === criterion.valueText);
    return option ? option[locale] : (criterion.valueText ?? "");
  }
  if (definition.dataType === "text") return criterion.valueText ?? "";
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  const unit = definition.unit ? `${NBSP}${definition.unit.replaceAll(" ", NBSP)}` : "";
  const { valueMin: low, valueMax: high } = criterion;
  if (low != null && high != null) return low === high ? `${number.format(low)}${unit}` : `${number.format(low)}–${number.format(high)}${unit}`;
  if (low != null) return `≥${NBSP}${number.format(low)}${unit}`;
  if (high != null) return `≤${NBSP}${number.format(high)}${unit}`;
  return "";
}

/** Names of catalogue entries joined, or the fallback when the list is empty. */
export function names(items: Named[], locale: Locale, fallback: string): string {
  return items.length === 0 ? fallback : items.map((item) => nameOf(item, locale)).join(", ");
}

export function originList(origins: Origin[], t: PlatformMessages): string {
  return origins.length === 0 ? t.requestDetail.anyOrigin : origins.map((origin) => t.labels.origin[origin]).join(", ");
}

export function deliveryList(terms: DeliveryTerm[], t: PlatformMessages): string {
  return terms.length === 0 ? t.requestDetail.deliveryNone : terms.map((term) => t.labels.deliveryTerm[term].name).join(", ");
}

/** "€300.00 per t" – or the words for "no ceiling". */
export function maxPrice(amount: number | null, unitKey: string | null, locale: Locale, t: PlatformMessages, catalogue: Pick<Catalogue, "units">): string {
  if (amount == null) return t.requestDetail.noMaxPrice;
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(amount);
  const unit = findUnit(catalogue, unitKey);
  return unit ? `${money} ${t.common.perUnit}${NBSP}${nameOf(unit, locale)}` : money;
}

/** "from 1 Dec 2026 · by 31 Jan 2027", one side alone, or null when neither is set. */
export function window(from: string | null, until: string | null, format: Formatters, t: PlatformMessages): string | null {
  const parts = [from && `${t.common.from} ${format.date(from)}`, until && `${t.common.until} ${format.date(until)}`].filter(Boolean);
  return parts.length === 0 ? null : parts.join(" · ");
}
