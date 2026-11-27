// Station 4 – authorisation as data: which fields of an offer a viewer gets (D08). Every view is an allow-list
// built here on the server; a field that is not copied below never reaches the browser.
// Pure functions without a database → tested on their own (offer-view.test.ts).
import type { AttributeValues } from "../domain/attributes";
import type { Named } from "../domain/catalogue";
import { calendarDay, isUrgent } from "../domain/dates";
import { coordinatesOf, distanceKm, type Coordinates } from "../domain/geo";
import { listingRef, type DeliveryTerm } from "../domain/listing";
import { effectiveOfferStatus, type OfferDisplayStatus, type OfferStatus, type VerificationStatus } from "../domain/status";

export type MaterialRef = (Named & { id: number; key: string }) | null;

export type DeliveryOption = {
  term: DeliveryTerm;
  namedPlace: string | null;
  incotermsVersion: string | null;
  customNote: string | null;
};

/** Site of an offer as the database returns it (all columns the views choose from). */
export type OfferSiteRecord = {
  id: number;
  name: string;
  companyName: string;
  industry: string;
  city: string;
  parkId: number | null;
  parkName: string | null;
  latitude: number | null;
  longitude: number | null;
  verificationStatus: VerificationStatus;
  capabilities: string[];
  contactVisible: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
};

/** Offer with its joins as the Data Access Layer loads it. Never sent to the browser as it is. */
export type OfferRecord = {
  id: number;
  status: OfferStatus;
  revision: number;
  title: string;
  description: string | null;
  category: MaterialRef;
  type: MaterialRef;
  form: MaterialRef;
  origin: string | null;
  legalStatus: string | null;
  wasteCode: string | null;
  quantity: number | null;
  unitKey: string | null;
  minLot: number | null;
  frequency: string | null;
  recurrencePeriod: string | null;
  recurrenceQuantity: number | null;
  availableFrom: string | null;
  collectionUntil: string | null;
  validityDays: number;
  expiresAt: Date | null;
  priceMode: string | null;
  priceAmount: number | null;
  priceUnitKey: string | null;
  currency: string;
  vatBasis: string;
  payer: string | null;
  deliveryPricing: string | null;
  maxDeliveryDistanceKm: number | null;
  packaging: string | null;
  loadingEquipment: string | null;
  evidenceStatus: string | null;
  datasheetAvailable: boolean;
  datasheetAccess: string;
  photosAvailable: boolean;
  sampleAvailable: string;
  provenance: string;
  publishedAt: Date | null;
  closedAt: Date | null;
  updatedAt: Date;
  site: OfferSiteRecord;
  deliveryOptions: DeliveryOption[];
  attributes: AttributeValues;
};

/** Result card of list and map (L1-015): enough to tell two batches apart before opening either. */
export type OfferCard = {
  id: number;
  ref: string;
  title: string;
  status: OfferDisplayStatus;
  provenance: string;
  category: MaterialRef;
  type: MaterialRef;
  form: MaterialRef;
  origin: string | null;
  quantity: number | null;
  unitKey: string | null;
  frequency: string | null;
  recurrencePeriod: string | null;
  recurrenceQuantity: number | null;
  priceMode: string | null;
  priceAmount: number | null;
  priceUnitKey: string | null;
  vatBasis: string;
  payer: string | null;
  deliveryTerms: DeliveryTerm[];
  collectionUntil: string | null;
  /** The collection deadline is close (function no. 41, rule in domain/dates.ts) → label "urgent". */
  urgent: boolean;
  site: { id: number; name: string; companyName: string; parkName: string | null; city: string };
  /** Straight line from the viewer's site in km; null = unknown (never 0). */
  distanceKm: number | null;
  /** false = the supplying site has no coordinates: stays in the list, missing on the map. */
  hasLocation: boolean;
};

export type SupplierView = {
  id: number;
  name: string;
  companyName: string;
  industry: string;
  parkName: string | null;
  city: string;
  capabilities: string[];
  /** Identity of the site checked by an administrator – says nothing about the material (L1-016). */
  verified: boolean;
  /** null = the site shares its contact only through an enquiry. */
  contact: { name: string; email: string; phone: string | null } | null;
};

export type OfferDetail = OfferCard & {
  description: string | null;
  legalStatus: string | null;
  wasteCode: string | null;
  minLot: number | null;
  availableFrom: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  currency: string;
  deliveryOptions: DeliveryOption[];
  deliveryPricing: string | null;
  maxDeliveryDistanceKm: number | null;
  packaging: string | null;
  loadingEquipment: string | null;
  evidenceStatus: string | null;
  datasheetAvailable: boolean;
  datasheetAccess: string;
  photosAvailable: boolean;
  sampleAvailable: string;
  /** Entered attribute values by key; a missing key is unknown. */
  attributes: AttributeValues;
  supplier: SupplierView;
  isOwner: boolean;
  /** Only for the owner: the number an edit must send back. */
  revision: number | null;
};

/** What a non-owner gets for a closed or expired listing: that it existed and is unavailable, nothing else. */
export type UnavailableOffer = { unavailable: true; id: number; ref: string; title: string; status: OfferDisplayStatus };

export function offerCard(record: OfferRecord, from: Coordinates | null, now: Date = new Date()): OfferCard {
  const location = coordinatesOf(record.site);
  return {
    id: record.id,
    ref: listingRef(record.id),
    title: record.title,
    status: effectiveOfferStatus(record.status, record.expiresAt, now),
    provenance: record.provenance,
    category: record.category,
    type: record.type,
    form: record.form,
    origin: record.origin,
    quantity: record.quantity,
    unitKey: record.unitKey,
    frequency: record.frequency,
    recurrencePeriod: record.recurrencePeriod,
    recurrenceQuantity: record.recurrenceQuantity,
    priceMode: record.priceMode,
    priceAmount: record.priceAmount,
    priceUnitKey: record.priceUnitKey,
    vatBasis: record.vatBasis,
    payer: record.payer,
    deliveryTerms: record.deliveryOptions.map((option) => option.term),
    collectionUntil: record.collectionUntil,
    urgent: isUrgent(record.collectionUntil, calendarDay(now)),
    site: {
      id: record.site.id,
      name: record.site.name,
      companyName: record.site.companyName,
      parkName: record.site.parkName,
      city: record.site.city,
    },
    distanceKm: distanceKm(from, location),
    hasLocation: location !== null,
  };
}

/** Supplier fields for members: never the street address; contact only when the site allows it or for the owner. */
export function supplierView(site: OfferSiteRecord, isOwner: boolean): SupplierView {
  return {
    id: site.id,
    name: site.name,
    companyName: site.companyName,
    industry: site.industry,
    parkName: site.parkName,
    city: site.city,
    capabilities: site.capabilities,
    verified: site.verificationStatus === "verified",
    contact:
      site.contactVisible || isOwner ? { name: site.contactName, email: site.contactEmail, phone: site.contactPhone } : null,
  };
}

export function offerDetail(record: OfferRecord, from: Coordinates | null, isOwner: boolean, now: Date = new Date()): OfferDetail {
  return {
    ...offerCard(record, from, now),
    description: record.description,
    legalStatus: record.legalStatus,
    wasteCode: record.wasteCode,
    minLot: record.minLot,
    availableFrom: record.availableFrom,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    currency: record.currency,
    deliveryOptions: record.deliveryOptions,
    deliveryPricing: record.deliveryPricing,
    maxDeliveryDistanceKm: record.maxDeliveryDistanceKm,
    packaging: record.packaging,
    loadingEquipment: record.loadingEquipment,
    evidenceStatus: record.evidenceStatus,
    datasheetAvailable: record.datasheetAvailable,
    datasheetAccess: record.datasheetAccess,
    photosAvailable: record.photosAvailable,
    sampleAvailable: record.sampleAvailable,
    attributes: record.attributes,
    supplier: supplierView(record.site, isOwner),
    isOwner,
    revision: isOwner ? record.revision : null,
  };
}

export function unavailableOffer(record: OfferRecord, now: Date = new Date()): UnavailableOffer {
  return {
    unavailable: true,
    id: record.id,
    ref: listingRef(record.id),
    title: record.title,
    status: effectiveOfferStatus(record.status, record.expiresAt, now),
  };
}
