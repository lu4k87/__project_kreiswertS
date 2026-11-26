// Preview before publishing (PG-08 "Preview" → "Publish"): the offer exactly as verified sites will see it – the
// same component and projection as the published detail – plus what is still missing and the Publish button.
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { getOffer, getPublishProblems } from "@/server/dal/offers";
import { nameOf } from "@/server/domain/catalogue";
import { idParam } from "@/server/validation/common";
import { fieldErrorText } from "@/lib/api-client";
import { BackLink, Notice, PageHeader, buttonSecondary } from "@/components/ui/elements";
import { PencilIcon } from "@/components/ui/icons";
import { ROUTES, editOfferPath, offerPath, previewOfferPath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { OfferActions } from "@/components/offers/offer-actions";
import { OfferDetailView } from "@/components/offers/offer-detail-view";
import { platformPage } from "../../../gate";

type Props = { params: Promise<{ id: string }> };

export default async function PreviewOfferPage({ params }: Props) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const page = await platformPage("site", previewOfferPath(id.data));
  const p = page.t.platform;
  if (page.blocked) return <><PageHeader title={p.preview.title} />{page.blocked}</>;

  let offer;
  let problems;
  try {
    [offer, problems] = await Promise.all([getOffer(page.viewer, id.data), getPublishProblems(page.viewer, id.data)]);
  } catch (error) {
    if (error instanceof AccessError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  if ("unavailable" in offer || !offer.isOwner) notFound();

  const catalogue = await getCatalogue();
  const format = makeFormatters(page.locale, p, catalogue.units);
  const verified = page.viewer.site.status === "verified";
  const isDraft = offer.status === "draft";
  // "attributes.grade" → name of the attribute; "deliveryOptions.fca.namedPlace" → name of the arrangement
  const fieldName = (field: string) => {
    const [first, second] = field.split(".");
    if (first === "attributes") {
      const definition = catalogue.attributes.find((candidate) => candidate.key === second && candidate.categoryId === offer.category?.id);
      return definition ? nameOf(definition, page.locale) : second;
    }
    if (first === "deliveryOptions" && second && second in p.labels.deliveryTerm) return p.labels.deliveryTerm[second as keyof typeof p.labels.deliveryTerm].name;
    return p.preview.fieldNames[first] ?? first;
  };

  return (
    <>
      <PageHeader
        title={p.preview.title}
        intro={p.preview.intro}
        back={<BackLink href={ROUTES.myOffers}>{p.offerForm.backToMyOffers}</BackLink>}
        actions={
          offer.status !== "closed" && (
            <Link href={editOfferPath(offer.id)} className={buttonSecondary}>
              <PencilIcon size={18} />
              {p.preview.backToEdit}
            </Link>
          )
        }
      />

      {!isDraft ? (
        <Notice tone="success" title={p.preview.alreadyActive}>
          <Link href={offerPath(offer.id)} className="font-semibold underline underline-offset-4">
            {p.preview.viewPublished}
          </Link>
        </Notice>
      ) : problems.length > 0 ? (
        <Notice tone="attention" title={p.preview.problemsTitle}>
          <ul className="mt-1 grid list-disc gap-0.5 pl-5">
            {problems.map((problem) => (
              <li key={problem.field}>
                <span className="font-semibold">{fieldName(problem.field)}:</span> {fieldErrorText(problem.code, p.errors)}
              </li>
            ))}
          </ul>
        </Notice>
      ) : !verified ? (
        <Notice tone="attention">{p.preview.notVerified}</Notice>
      ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface p-5">
          <p className="min-w-[14rem] flex-1 text-[15px] font-medium">{p.preview.ready}</p>
          <OfferActions offerId={offer.id} revision={offer.revision ?? 1} actions={["publish"]} primary="publish" t={p} afterPath={offerPath(offer.id)} />
        </div>
      )}

      <OfferDetailView offer={offer} catalogue={catalogue} t={p} locale={page.locale} format={format} linkSupplier={false} />
    </>
  );
}
