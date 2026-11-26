// Create offer (PG-08): the shared offer form with an empty draft. Every site that is not declined may draft.
import { getCatalogue } from "@/server/dal/catalogue";
import { getMySite } from "@/server/dal/sites";
import { calendarDay } from "@/server/domain/dates";
import { BackLink, Notice, PageHeader } from "@/components/ui/elements";
import { ROUTES } from "@/components/layout/links";
import { OfferForm } from "@/components/offers/offer-form";
import { newOfferInput } from "@/components/offers/offer-form-state";
import { platformPage } from "../../gate";

export default async function NewOfferPage() {
  const page = await platformPage("site", ROUTES.newOffer);
  const p = page.t.platform;
  if (page.blocked) return <><PageHeader title={p.offerForm.createTitle} />{page.blocked}</>;
  const back = <BackLink href={ROUTES.myOffers}>{p.offerForm.backToMyOffers}</BackLink>;
  if (page.viewer.site.status === "declined") {
    return (
      <>
        <PageHeader title={p.offerForm.createTitle} back={back} />
        <Notice tone="attention" title={p.gate.declinedTitle}>{p.gate.declinedText}</Notice>
      </>
    );
  }

  const [catalogue, site] = await Promise.all([getCatalogue(), getMySite(page.viewer)]);
  const today = calendarDay();
  return (
    <>
      <PageHeader title={p.offerForm.createTitle} back={back} />
      {site.verificationStatus === "pending" && <Notice tone="attention">{p.offerForm.pendingNote}</Notice>}
      <OfferForm
        mode="create"
        initial={newOfferInput(catalogue, today)}
        catalogue={catalogue}
        site={{ name: site.name, parkName: site.park?.name ?? null, city: site.city }}
        t={p}
        locale={page.locale}
        today={today}
      />
    </>
  );
}
