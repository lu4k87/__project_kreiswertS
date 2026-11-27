// My offers (PG-07): active, draft, closed and expired offers of the own site with the actions of each state.
import Link from "next/link";
import { getCatalogue } from "@/server/dal/catalogue";
import { listMyOffers, type MyOffer } from "@/server/dal/offers";
import { EmptyState, Notice, PageHeader, Section, buttonPrimary, buttonQuiet } from "@/components/ui/elements";
import { ClockIcon, LayersIcon, PackageIcon, PencilIcon, PlusIcon } from "@/components/ui/icons";
import { ROUTES, editOfferPath, previewOfferPath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { OfferActions, type OfferActionKind } from "@/components/offers/offer-actions";
import { OfferCard } from "@/components/offers/offer-card";
import { ListingTabs } from "@/components/requests/listing-tabs";
import { platformPage } from "../gate";

export default async function MyOffersPage() {
  const page = await platformPage("site", ROUTES.myOffers);
  const p = page.t.platform;
  const m = p.myOffers;
  if (page.blocked) return <><PageHeader title={m.title} />{page.blocked}</>;

  const [offers, catalogue] = await Promise.all([listMyOffers(page.viewer), getCatalogue()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const status = page.viewer.site.status;
  const verified = status === "verified";
  const mayEdit = status !== "declined";
  const groups = {
    active: offers.filter((offer) => offer.status === "active"),
    drafts: offers.filter((offer) => offer.status === "draft"),
    ended: offers.filter((offer) => offer.status === "closed" || offer.status === "expired"),
  };

  const card = (offer: MyOffer) => {
    const actions: OfferActionKind[] =
      offer.status === "draft" ? ["delete"] : offer.status === "active" ? ["close"] : offer.status === "expired" ? [...(verified ? (["renew"] as const) : []), "close"] : [];
    const editable = mayEdit && offer.status !== "closed";
    return (
      <li key={offer.id}>
        <OfferCard
          offer={offer}
          t={p}
          locale={page.locale}
          format={format}
          showDistance={false}
          href={offer.status === "draft" ? previewOfferPath(offer.id) : undefined}
          footer={
            <div className="grid gap-3 border-t border-line pt-3">
              <p className="text-[13px] text-muted">
                {offer.status === "active" && offer.expiresAt && `${m.expires} ${format.date(offer.expiresAt)} · `}
                {offer.status === "expired" && offer.expiresAt && `${m.expired} ${format.date(offer.expiresAt)} · `}
                {m.updated} {format.dateTime(offer.updatedAt)}
                {offer.status !== "draft" && ` · ${m.enquiries}: ${offer.enquiryCount}`}
              </p>
              <div className="flex flex-wrap items-start gap-2">
                {editable && (
                  <Link href={editOfferPath(offer.id)} className={buttonQuiet}>
                    <PencilIcon size={16} />
                    {p.common.edit}
                  </Link>
                )}
                {offer.status === "draft" && (
                  <Link href={previewOfferPath(offer.id)} className={buttonQuiet}>
                    {m.preview} / {m.publish}
                  </Link>
                )}
                {actions.length > 0 && <OfferActions offerId={offer.id} revision={offer.revision} actions={actions} t={p} />}
              </div>
            </div>
          }
        />
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title={m.title}
        intro={m.intro}
        actions={
          mayEdit && (
            <Link href={ROUTES.newOffer} className={buttonPrimary}>
              <PlusIcon size={18} />
              {p.nav.createOffer}
            </Link>
          )
        }
      />
      <ListingTabs current="offers" t={p} />
      {status === "pending" && <Notice tone="attention">{p.offerForm.pendingNote}</Notice>}
      {status === "declined" && <Notice tone="attention" title={p.gate.declinedTitle}>{p.gate.declinedText}</Notice>}

      <Section title={`${m.active} (${groups.active.length})`} icon={<PackageIcon size={18} />} id="active">
        {groups.active.length === 0 ? <EmptyState title={m.emptyActive} /> : <ul className="grid gap-4">{groups.active.map(card)}</ul>}
      </Section>
      <Section title={`${m.drafts} (${groups.drafts.length})`} icon={<LayersIcon size={18} />} id="drafts">
        {groups.drafts.length === 0 ? <EmptyState title={m.emptyDrafts} /> : <ul className="grid gap-4">{groups.drafts.map(card)}</ul>}
      </Section>
      <Section title={`${m.closed} (${groups.ended.length})`} icon={<ClockIcon size={18} />} id="closed">
        {groups.ended.length === 0 ? (
          <EmptyState title={m.emptyClosed} />
        ) : (
          <>
            <ul className="grid gap-4">{groups.ended.map(card)}</ul>
            <p className="mt-3 text-[13px] leading-normal text-muted">
              {m.closedNote} {m.renewText}
            </p>
          </>
        )}
      </Section>
    </>
  );
}
