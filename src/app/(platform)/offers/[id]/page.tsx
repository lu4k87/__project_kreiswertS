// Individual offer (PG-10): full detail for verified sites, the owner's own view in every state, and only an
// "unavailable" notice for a listing that was closed or has expired.
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { ownRequestsForOffer } from "@/server/dal/matches";
import { getOffer } from "@/server/dal/offers";
import { idParam } from "@/server/validation/common";
import { BackLink, EmptyState, Notice, Section, buttonSecondary } from "@/components/ui/elements";
import { ClockIcon, SendIcon } from "@/components/ui/icons";
import { ROUTES, editOfferPath, matchPath } from "@/components/layout/links";
import { OwnMatchList } from "@/components/matches/own-match-list";
import { EnquiryForm } from "@/components/offers/enquiry-form";
import { makeFormatters } from "@/components/offers/format";
import { OfferDetailView } from "@/components/offers/offer-detail-view";
import { platformPage } from "../../gate";

type Props = { params: Promise<{ id: string }> };

export default async function OfferPage({ params }: Props) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  // "account": the owner of a pending site may open the own offer; everything else is decided by getOffer().
  const page = await platformPage("account", `/offers/${id.data}`);
  const p = page.t.platform;

  let offer;
  try {
    offer = await getOffer(page.viewer, id.data);
  } catch (error) {
    if (!(error instanceof AccessError)) throw error;
    if (error.code === "NOT_FOUND") notFound();
    // not verified: explain the gate instead of a bare error page
    const gate = await platformPage("browse", `/offers/${id.data}`);
    return gate.blocked ?? notFound();
  }

  const back = <BackLink href={ROUTES.offers}>{p.detail.backToResults}</BackLink>;
  if ("unavailable" in offer) {
    return (
      <>
        {back}
        <EmptyState
          icon={<ClockIcon size={20} />}
          title={`${p.detail.unavailableTitle}: ${offer.title} (${offer.ref})`}
          text={offer.status === "expired" ? p.detail.unavailableExpired : p.detail.unavailableClosed}
          action={
            <Link href={ROUTES.offers} className={buttonSecondary}>
              {p.detail.backToResults}
            </Link>
          }
        />
      </>
    );
  }

  const viewer = page.viewer;
  // Level 2: how the viewer's own open requests compare with this offer (verified sites only, never on the own offer)
  const comparable = !offer.isOwner && viewer.role === "member" && viewer.site.status === "verified" && offer.status === "active";
  const [catalogue, ownRequests] = await Promise.all([getCatalogue(), comparable ? ownRequestsForOffer(viewer, offer.id) : Promise.resolve(null)]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const offerId = offer.id;
  const contact = offer.isOwner ? (
    <Notice title={offer.status === "draft" ? p.detail.ownDraft : p.detail.ownOffer}>
      <Link href={offer.status === "closed" ? ROUTES.myOffers : editOfferPath(offer.id)} className="font-semibold underline underline-offset-4">
        {p.detail.manage}
      </Link>
    </Notice>
  ) : (
    <Section title={p.enquiry.title} icon={<SendIcon size={18} />} id="contact">
      {viewer.role === "admin" ? (
        <p className="text-[15px]">{p.enquiry.disabledAdmin}</p>
      ) : viewer.site.status !== "verified" ? (
        <p className="text-[15px]">{p.enquiry.disabledPending}</p>
      ) : (
        <EnquiryForm offerId={offer.id} t={p} />
      )}
    </Section>
  );
  const compatibility = ownRequests && (
    <OwnMatchList items={ownRequests} hrefOf={(item) => matchPath(item.id, offerId)} text={p.matches.ownRequestsText} empty={p.matches.noOwnRequests} t={p} />
  );

  return (
    <>
      {offer.isOwner ? <BackLink href={ROUTES.myOffers}>{p.detail.backToMyOffers}</BackLink> : back}
      <OfferDetailView offer={offer} catalogue={catalogue} t={p} locale={page.locale} format={format} contact={contact} compatibility={compatibility} />
    </>
  );
}
