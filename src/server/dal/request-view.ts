// Station 4 – authorisation as data for material requests (D08): which fields of a request a viewer gets. Every view
// is an allow-list built here on the server; a field that is not copied below never reaches the browser.
// Pure functions without a database → tested on their own (request-view.test.ts).
import { coordinatesOf, distanceKm, type Coordinates } from "../domain/geo";
import { requestRef, type DeliveryTerm, type Origin } from "../domain/listing";
import type { MatchRequest } from "../domain/matching";
import type { Criteria } from "../domain/request-rules";
import { effectiveOfferStatus, type OfferDisplayStatus, type OfferStatus, type VerificationStatus } from "../domain/status";
import type { MaterialRef } from "./offer-view";

type Material = NonNullable<MaterialRef>;

/** Requesting site as the database returns it. No contact and no address: a request is answered through the platform. */
export type RequestSiteRecord = {
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
};

/** Request with its joins as the Data Access Layer loads it. Never sent to the browser as it is. */
export type RequestRecord = {
  id: number;
  status: OfferStatus;
  revision: number;
  title: string;
  description: string | null;
  category: MaterialRef;
  types: Material[];
  forms: Material[];
  origins: Origin[];
  quantity: number | null;
  unitKey: string | null;
  minLot: number | null;
  frequency: string | null;
  recurrencePeriod: string | null;
  neededFrom: string | null;
  neededUntil: string | null;
  validityDays: number;
  expiresAt: Date | null;
  maxPriceAmount: number | null;
  maxPriceUnitKey: string | null;
  deliveryTerms: DeliveryTerm[];
  evidenceStatus: string | null;
  sampleRequired: boolean;
  closureReason: string | null;
  provenance: string;
  publishedAt: Date | null;
  closedAt: Date | null;
  updatedAt: Date;
  site: RequestSiteRecord;
  criteria: Criteria;
};

/** Result card of the request search and of My requests. */
export type RequestCard = {
  id: number;
  ref: string;
  title: string;
  status: OfferDisplayStatus;
  provenance: string;
  category: MaterialRef;
  types: Material[];
  forms: Material[];
  quantity: number | null;
  unitKey: string | null;
  minLot: number | null;
  frequency: string | null;
  recurrencePeriod: string | null;
  neededUntil: string | null;
  maxPriceAmount: number | null;
  maxPriceUnitKey: string | null;
  deliveryTerms: DeliveryTerm[];
  closureReason: string | null;
  site: { id: number; name: string; companyName: string; parkName: string | null; city: string };
  /** Straight line from the viewer's site in km; null = unknown (never 0). */
  distanceKm: number | null;
  hasLocation: boolean;
};

export type RequestDetail = RequestCard & {
  description: string | null;
  origins: Origin[];
  neededFrom: string | null;
  evidenceStatus: string | null;
  sampleRequired: boolean;
  criteria: Criteria;
  expiresAt: string | null;
  publishedAt: string | null;
  requester: { id: number; name: string; companyName: string; industry: string; parkName: string | null; city: string; capabilities: string[]; verified: boolean };
  isOwner: boolean;
  /** Only for the owner: the number an edit must send back. */
  revision: number | null;
};

/** What a non-owner gets for a closed or expired request: that it existed and is no longer open. */
export type UnavailableRequest = { unavailable: true; id: number; ref: string; title: string; status: OfferDisplayStatus };

export function requestCard(record: RequestRecord, from: Coordinates | null, now: Date = new Date()): RequestCard {
  const location = coordinatesOf(record.site);
  return {
    id: record.id,
    ref: requestRef(record.id),
    title: record.title,
    status: effectiveOfferStatus(record.status, record.expiresAt, now),
    provenance: record.provenance,
    category: record.category,
    types: record.types,
    forms: record.forms,
    quantity: record.quantity,
    unitKey: record.unitKey,
    minLot: record.minLot,
    frequency: record.frequency,
    recurrencePeriod: record.recurrencePeriod,
    neededUntil: record.neededUntil,
    maxPriceAmount: record.maxPriceAmount,
    maxPriceUnitKey: record.maxPriceUnitKey,
    deliveryTerms: record.deliveryTerms,
    closureReason: record.closureReason,
    site: { id: record.site.id, name: record.site.name, companyName: record.site.companyName, parkName: record.site.parkName, city: record.site.city },
    distanceKm: distanceKm(from, location),
    hasLocation: location !== null,
  };
}

export function requestDetail(record: RequestRecord, from: Coordinates | null, isOwner: boolean, now: Date = new Date()): RequestDetail {
  return {
    ...requestCard(record, from, now),
    description: record.description,
    origins: record.origins,
    neededFrom: record.neededFrom,
    evidenceStatus: record.evidenceStatus,
    sampleRequired: record.sampleRequired,
    criteria: record.criteria,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    requester: {
      id: record.site.id,
      name: record.site.name,
      companyName: record.site.companyName,
      industry: record.site.industry,
      parkName: record.site.parkName,
      city: record.site.city,
      capabilities: record.site.capabilities,
      verified: record.site.verificationStatus === "verified",
    },
    isOwner,
    revision: isOwner ? record.revision : null,
  };
}

export function unavailableRequest(record: RequestRecord, now: Date = new Date()): UnavailableRequest {
  return { unavailable: true, id: record.id, ref: requestRef(record.id), title: record.title, status: effectiveOfferStatus(record.status, record.expiresAt, now) };
}

/** The request side of the matching rules (src/server/domain/matching.ts). */
export function matchRequestOf(record: RequestRecord): MatchRequest {
  return {
    categoryId: record.category?.id ?? null,
    typeKeys: record.types.map((type) => type.key),
    formKeys: record.forms.map((form) => form.key),
    origins: record.origins,
    quantity: record.quantity,
    unitKey: record.unitKey,
    minLot: record.minLot,
    frequency: record.frequency as MatchRequest["frequency"],
    neededFrom: record.neededFrom,
    neededUntil: record.neededUntil,
    maxPriceAmount: record.maxPriceAmount,
    maxPriceUnitKey: record.maxPriceUnitKey,
    deliveryTerms: record.deliveryTerms,
    evidenceStatus: record.evidenceStatus as MatchRequest["evidenceStatus"],
    sampleRequired: record.sampleRequired,
    criteria: record.criteria,
  };
}
