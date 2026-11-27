// How quantities, prices, dates and distances are written – the same in cards, detail, preview and the form's
// live preview. Pure (no server import) → used by server and client components.
import type { Locale } from "@/i18n/messages";
import type { PlatformMessages } from "@/i18n/platform";
import { findUnit, nameOf, type CatalogueUnit } from "@/server/domain/catalogue";
import type { Frequency, PriceMode, RecurrencePeriod } from "@/server/domain/listing";
import { pricePerKg } from "@/server/domain/price";

const NBSP = "\u00a0";

export type PriceFields = { priceMode: string | null; priceAmount: number | null; priceUnitKey: string | null; vatBasis: string; payer: string | null };

export type Formatters = ReturnType<typeof makeFormatters>;

export function makeFormatters(locale: Locale, t: PlatformMessages, units: CatalogueUnit[]) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Berlin" });
  const dayTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
  const unitName = (key: string | null) => {
    const unit = findUnit({ units }, key);
    return unit ? nameOf(unit, locale) : "";
  };

  /** "500 kg" with number and unit kept together; unknown stays the word, never 0. */
  function quantity(value: number | null, unitKey: string | null): string {
    if (value == null) return t.common.unknown;
    const unit = unitName(unitKey);
    return unit ? `${number.format(value)}${NBSP}${unit}` : number.format(value);
  }

  /** Main line of a price ("€400.00 per t", "Price on enquiry") plus what belongs under it. */
  function price(offer: PriceFields): { main: string; notes: string[] } {
    const mode = offer.priceMode as PriceMode | null;
    if (!mode) return { main: t.common.notStated, notes: [] };
    if (mode === "quotation") return { main: t.detail.onEnquiry, notes: [] };
    if (mode === "free") return { main: t.detail.free, notes: [] };
    if (offer.priceAmount == null) return { main: t.detail.negotiable, notes: [] };
    const unit = findUnit({ units }, offer.priceUnitKey);
    const main = `${money.format(offer.priceAmount)}${unit ? ` ${t.common.perUnit}${NBSP}${nameOf(unit, locale)}` : ""}`;
    const notes: string[] = [];
    const perKg = pricePerKg(offer.priceAmount, unit, findUnit({ units }, "kg"));
    if (perKg != null) notes.push(`${t.detail.equivalent} ${money.format(perKg)} ${t.common.perUnit}${NBSP}kg`);
    if (mode === "negotiable") notes.push(t.detail.negotiable);
    notes.push(t.labels.vatBasis[offer.vatBasis as keyof typeof t.labels.vatBasis] ?? offer.vatBasis);
    if (mode === "paid_recovery") notes.push(t.detail.offererPays);
    return { main: mode === "paid_recovery" ? `${t.offerForm.recoveryFee}: ${main}` : main, notes };
  }

  /** "One-off batch" or "Recurring supply · monthly". */
  function frequency(value: string | null, period: string | null): string {
    if (!value) return t.common.notStated;
    const label = t.labels.frequency[value as Frequency] ?? value;
    return value === "recurring" && period ? `${label} · ${t.labels.period[period as RecurrencePeriod] ?? period}` : label;
  }

  /** Date from "2026-11-27" (calendar day) or an ISO timestamp. */
  function date(value: string | null): string {
    if (!value) return t.common.notStated;
    // A calendar day has no time zone: format it as noon UTC so no zone can move it to the day before.
    return day.format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
  }

  function dateTime(value: string): string {
    return dayTime.format(new Date(value));
  }

  /** "5.5 km (straight line)" – or the words for unknown. Never an invented number. */
  function distance(km: number | null, hasLocation = true): string {
    if (km == null) return hasLocation ? t.common.distanceUnknown : t.common.noLocation;
    return `${number.format(km)}${NBSP}km (${t.common.straightLine})`;
  }

  return { number, quantity, price, frequency, date, dateTime, distance, unitName };
}
