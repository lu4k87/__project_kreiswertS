// Data Access Layer: enquiries about one offer (L1-017, D11). Private between the sending and the receiving site;
// an enquiry changes neither stock nor status of the offer and creates no demand record.
import "server-only";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { AccessError, requireSite, requireVerifiedSite, type Viewer } from "../access";
import { db } from "../db/client";
import { companies, enquiries, offers, sites } from "../db/schema";
import { listingRef, type EnquiryTopic } from "../domain/listing";
import { isDiscoverable, type OfferStatus } from "../domain/status";
import type { EnquiryInput } from "../validation/offers";

/** Limits against flooding a supplier: per sender and offer, and per sender overall, in 24 hours. */
const MAX_PER_OFFER_PER_DAY = 5;
const MAX_PER_SITE_PER_DAY = 30;

export type Enquiry = {
  id: number;
  direction: "received" | "sent";
  offer: { id: number; ref: string; title: string };
  /** The other site: sender of a received enquiry, supplier of a sent one. */
  counterpart: { id: number; name: string; companyName: string };
  topic: EnquiryTopic;
  message: string;
  response: string | null;
  createdAt: string;
  respondedAt: string | null;
};

/** Send an enquiry about an active offer of another verified site. */
export async function createEnquiry(viewer: Viewer, offerId: number, input: EnquiryInput): Promise<{ id: number; ref: string }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const [offer] = await db
    .select({ id: offers.id, siteId: offers.siteId, status: offers.status, expiresAt: offers.expiresAt, supplierStatus: sites.verificationStatus })
    .from(offers)
    .innerJoin(sites, eq(offers.siteId, sites.id))
    .where(eq(offers.id, offerId));
  // unknown, draft or offered by an unverified site → the same answer as for a missing offer
  if (!offer || offer.status === "draft" || offer.supplierStatus !== "verified") throw new AccessError("NOT_FOUND");
  if (offer.siteId === site.id) throw new AccessError("CONFLICT", { reason: "OWN_OFFER" });
  if (!isDiscoverable(offer.status as OfferStatus, offer.expiresAt)) throw new AccessError("CONFLICT", { reason: "UNAVAILABLE" });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    // Lock the sending site's row: count and insert happen one request at a time per sender, so parallel
    // requests cannot all read "below the limit" before any of them has written.
    await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, site.id)).for("no key update");
    const [sent] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        forOffer: sql<number>`(count(*) filter (where ${enquiries.offerId} = ${offerId}))::int`,
      })
      .from(enquiries)
      .where(and(eq(enquiries.fromSiteId, site.id), gt(enquiries.createdAt, since)));
    if (sent.total >= MAX_PER_SITE_PER_DAY || sent.forOffer >= MAX_PER_OFFER_PER_DAY) throw new AccessError("RATE_LIMITED");
    const [row] = await tx
      .insert(enquiries)
      .values({ offerId, fromSiteId: site.id, toSiteId: offer.siteId, senderUserId: userId, topic: input.topic, message: input.message })
      .returning({ id: enquiries.id });
    return { id: row.id, ref: listingRef(offerId) };
  });
}

/** Enquiries the viewer's site received and sent, newest first. No other site can read them. */
export async function listEnquiries(viewer: Viewer): Promise<Enquiry[]> {
  const { site } = requireSite(viewer);
  const sender = alias(sites, "sender");
  const receiver = alias(sites, "receiver");
  const senderCompany = alias(companies, "sender_company");
  const receiverCompany = alias(companies, "receiver_company");
  const rows = await db
    .select({
      enquiry: enquiries,
      offerTitle: offers.title,
      sender: { id: sender.id, name: sender.name, companyName: senderCompany.name },
      receiver: { id: receiver.id, name: receiver.name, companyName: receiverCompany.name },
    })
    .from(enquiries)
    .innerJoin(offers, eq(enquiries.offerId, offers.id))
    .innerJoin(sender, eq(enquiries.fromSiteId, sender.id))
    .innerJoin(senderCompany, eq(sender.companyId, senderCompany.id))
    .innerJoin(receiver, eq(enquiries.toSiteId, receiver.id))
    .innerJoin(receiverCompany, eq(receiver.companyId, receiverCompany.id))
    .where(or(eq(enquiries.toSiteId, site.id), eq(enquiries.fromSiteId, site.id)))
    .orderBy(desc(enquiries.createdAt))
    .limit(200);
  return rows.map(({ enquiry, offerTitle, sender: from, receiver: to }) => {
    const received = enquiry.toSiteId === site.id;
    return {
      id: enquiry.id,
      direction: received ? "received" : "sent",
      offer: { id: enquiry.offerId, ref: listingRef(enquiry.offerId), title: offerTitle },
      counterpart: received ? from : to,
      topic: enquiry.topic as EnquiryTopic,
      message: enquiry.message,
      response: enquiry.response,
      createdAt: enquiry.createdAt.toISOString(),
      respondedAt: enquiry.respondedAt?.toISOString() ?? null,
    };
  });
}

/** The supplier answers a received enquiry once. */
export async function respondToEnquiry(viewer: Viewer, enquiryId: number, response: string): Promise<{ id: number }> {
  const { site, userId } = requireVerifiedSite(viewer);
  const [row] = await db
    .update(enquiries)
    .set({ response, respondedAt: new Date(), responderUserId: userId })
    .where(and(eq(enquiries.id, enquiryId), eq(enquiries.toSiteId, site.id), isNull(enquiries.response)))
    .returning({ id: enquiries.id });
  if (row) return row;
  const [existing] = await db
    .select({ id: enquiries.id })
    .from(enquiries)
    .where(and(eq(enquiries.id, enquiryId), eq(enquiries.toSiteId, site.id)));
  // an enquiry addressed to another site is indistinguishable from a missing one
  if (!existing) throw new AccessError("NOT_FOUND");
  throw new AccessError("CONFLICT", { reason: "ALREADY_ANSWERED" });
}
