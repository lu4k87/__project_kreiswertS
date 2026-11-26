// Edit offer (PG-08, L1-011): the shared offer form with the stored values and the revision they were read at –
// saving with an outdated revision is refused, so a second tab cannot silently overwrite a newer state.
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { getMyOffer } from "@/server/dal/offers";
import { getMySite } from "@/server/dal/sites";
import { calendarDay } from "@/server/domain/dates";
import { idParam } from "@/server/validation/common";
import { BackLink, Badge, Notice, PageHeader } from "@/components/ui/elements";
import { ROUTES, editOfferPath } from "@/components/layout/links";
import { OfferForm } from "@/components/offers/offer-form";
import { platformPage } from "../../../gate";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };

export default async function EditOfferPage({ params, searchParams }: Props) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const page = await platformPage("site", editOfferPath(id.data));
  const p = page.t.platform;
  if (page.blocked) return <><PageHeader title={p.offerForm.editTitle} />{page.blocked}</>;

  let offer;
  try {
    offer = await getMyOffer(page.viewer, id.data);
  } catch (error) {
    if (error instanceof AccessError && error.code === "NOT_FOUND") notFound(); // also another site's offer
    throw error;
  }
  const back = <BackLink href={ROUTES.myOffers}>{p.offerForm.backToMyOffers}</BackLink>;
  const status = page.viewer.site.status;
  const header = <PageHeader title={p.offerForm.editTitle} back={back} actions={<Badge tone={offer.status === "active" ? "solid" : "outline"}>{p.labels.offerStatus[offer.status]}</Badge>} />;
  // The same rules as the server (updateOffer): closed listings, a declined site, and published listings of a
  // site under review cannot be changed – say so instead of showing a form whose saving would fail.
  if (offer.status === "closed") return <>{header}<Notice tone="attention">{p.errors.api.CLOSED}</Notice></>;
  if (status === "declined") return <>{header}<Notice tone="attention" title={p.gate.declinedTitle}>{p.gate.declinedText}</Notice></>;
  if (status !== "verified" && offer.status !== "draft") return <>{header}<Notice tone="attention" title={p.gate.pendingTitle}>{p.errors.api.NOT_VERIFIED}</Notice></>;

  const [catalogue, site] = await Promise.all([getCatalogue(), getMySite(page.viewer)]);
  return (
    <>
      {header}
      {(await searchParams).saved === "1" && <Notice tone="success" live>{p.offerForm.saved}</Notice>}
      {status === "pending" && <Notice tone="attention">{p.offerForm.pendingNote}</Notice>}
      <OfferForm
        // a new revision from the server (after router.refresh()) starts the form from the stored state again
        key={offer.revision}
        mode="edit"
        offerId={offer.id}
        revision={offer.revision}
        status={offer.status}
        initial={offer.input}
        catalogue={catalogue}
        site={{ name: site.name, parkName: site.park?.name ?? null, city: site.city }}
        t={p}
        locale={page.locale}
        today={calendarDay()}
      />
    </>
  );
}
