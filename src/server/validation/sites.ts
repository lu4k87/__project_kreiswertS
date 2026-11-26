// Station 3 – validation of site data: registration step, profile, verification, directory filters.
// Only zod + pure modules → the registration form uses the same schema.
import { z } from "zod";
import { CAPABILITIES, INDUSTRIES } from "../domain/listing";
import { VERIFICATION_STATUSES } from "../domain/status";
import { HAS_LETTER_OR_DIGIT, idParam, line, nullable, optionalParam, paragraph } from "./common";

const capabilities = z
  .array(z.enum(CAPABILITIES))
  .max(CAPABILITIES.length)
  .transform((values) => [...new Set(values)])
  .default([]);

/** International phone number as people type it: digits, spaces, + ( ) / - ; 6–30 characters. */
const phone = z
  .string()
  .trim()
  .min(6)
  .max(30)
  .regex(/^\+?[0-9 ()/-]+$/);

/**
 * Body of POST /api/registration/site (L1-001): the physical site of the account's company. Company name and
 * VAT ID come from the account (sign-up), the owner from the session – neither is part of this body.
 */
export const siteRegistration = z.object({
  industry: z.enum(INDUSTRIES),
  siteName: line(200).min(2).regex(HAS_LETTER_OR_DIGIT),
  streetAddress: line(255).min(3).regex(HAS_LETTER_OR_DIGIT),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,10}$/),
  city: line(100).min(2).regex(HAS_LETTER_OR_DIGIT),
  /** Industrial park from the list, or null when the site is in none of them / unknown. */
  parkId: nullable(idParam),
  contactName: line(150).min(2).regex(HAS_LETTER_OR_DIGIT),
  contactPhone: nullable(phone),
  capabilities,
});
export type SiteRegistration = z.infer<typeof siteRegistration>;

/**
 * Body of PUT /api/my/site: what a site may change itself. Company, address and park identify the site and stay
 * fixed after registration – they are what the administrator verified.
 */
export const siteProfile = z.object({
  description: nullable(paragraph(1500)),
  contactName: line(150).min(2).regex(HAS_LETTER_OR_DIGIT),
  contactEmail: z.email().max(254),
  contactPhone: nullable(phone),
  capabilities,
  contactVisible: z.boolean(),
  publicListed: z.boolean(),
});
export type SiteProfile = z.infer<typeof siteProfile>;

/** Body of POST /api/admin/sites/[id]/verification (L1-003). */
export const verificationDecision = z.object({
  status: z.enum(VERIFICATION_STATUSES),
  note: nullable(paragraph(1000)),
  /** Coordinates the reviewer looked up; both or none. Omitted → the stored ones stay. */
  latitude: nullable(z.number().min(-90).max(90)).optional(),
  longitude: nullable(z.number().min(-180).max(180)).optional(),
});
export type VerificationDecision = z.infer<typeof verificationDecision>;

/** Query of GET /api/admin/sites: one status per page (default: the sites waiting), `before` = id for the next older page. */
export const siteReviewQuery = z.object({
  status: optionalParam(z.enum(VERIFICATION_STATUSES).default("pending")),
  before: optionalParam(idParam.optional()),
});
export type SiteReviewQuery = z.infer<typeof siteReviewQuery>;

/** Filters of GET /api/sites and /companies (L1-018). */
export const siteDirectoryQuery = z.object({
  q: optionalParam(line(100).optional()),
  industry: optionalParam(z.enum(INDUSTRIES).optional()),
  capability: optionalParam(z.enum(CAPABILITIES).optional()),
  parkId: optionalParam(idParam.optional()),
});
export type SiteDirectoryQuery = z.infer<typeof siteDirectoryQuery>;

/** Body of POST /api/admin/categories/[id]: switch a material category on or off (PG-16). */
export const categoryToggle = z.object({ enabled: z.boolean() });

/** street + postal code without case, spaces and punctuation – two spellings of one address compare equal (D01). */
export function addressKey(streetAddress: string, postalCode: string): string {
  const fold = (value: string) =>
    value
      .toLowerCase()
      .replace(/ß/g, "ss")
      .replace(/stra(ss|ß)e\b|str\.?(?=\s|\d|$)/g, "str")
      .normalize("NFKD")
      .replace(/[^a-z0-9]/g, "");
  return `${fold(postalCode)}|${fold(streetAddress)}`.slice(0, 300);
}
