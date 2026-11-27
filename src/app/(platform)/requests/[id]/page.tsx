// Individual request (PG-20): required material, acceptance criteria, quantity, commercial and delivery terms.
// The owner sees the draft with Publish, the actions of each state and every response. Other verified sites see
// how their own offers compare and respond once.
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { ownOffersForRequest } from "@/server/dal/matches";
import { getRequest, getRequestPublishProblems, listResponses } from "@/server/dal/requests";
import { idParam } from "@/server/validation/common";
import { BackLink, EmptyState, Notice, Section, buttonSecondary } from "@/components/ui/elements";
import { ClockIcon, MailIcon, PencilIcon, SendIcon } from "@/components/ui/icons";
import { ROUTES, editRequestPath, matchPath } from "@/components/layout/links";
import { fieldErrorText } from "@/lib/api-client";
import { makeFormatters } from "@/components/offers/format";
import { OwnMatchList } from "@/components/matches/own-match-list";
import { RequestActions, type RequestActionKind } from "@/components/requests/request-actions";
import { RequestDetailView } from "@/components/requests/request-detail-view";
import { RespondForm } from "@/components/requests/respond-form";
import { ResponseList } from "@/components/requests/response-list";
import { platformPage } from "../../gate";

type Props = { params: Promise<{ id: string }> };

export default async function RequestPage({ params }: Props) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const path = `/requests/${id.data}`;
  // "account": the owner of a pending site may open the own draft; everything else is decided by getRequest().
  const page = await platformPage("account", path);
  const p = page.t.platform;

  let request;
  try {
    request = await getRequest(page.viewer, id.data);
  } catch (error) {
    if (!(error instanceof AccessError)) throw error;
    if (error.code === "NOT_FOUND") notFound();
    const gate = await platformPage("browse", path);
    return gate.blocked ?? notFound();
  }

  const d = p.requestDetail;
  if ("unavailable" in request) {
    return (
      <>
        <BackLink href={ROUTES.requests}>{d.backToResults}</BackLink>
        <EmptyState
          icon={<ClockIcon size={20} />}
          title={`${d.unavailableTitle}: ${request.title} (${request.ref})`}
          text={request.status === "expired" ? d.unavailableExpired : d.unavailableClosed}
          action={<Link href={ROUTES.requests} className={buttonSecondary}>{d.backToResults}</Link>}
        />
      </>
    );
  }

  const catalogue = await getCatalogue();
  const format = makeFormatters(page.locale, p, catalogue.units);
  const viewer = page.viewer;
  const r = p.responses;
  let aside;

  if (request.isOwner && viewer.role === "member") {
    const verified = viewer.site.status === "verified";
    const [responses, problems] = await Promise.all([
      listResponses(viewer, request.id),
      request.status === "draft" ? getRequestPublishProblems(viewer, request.id) : Promise.resolve([]),
    ]);
    const actions: RequestActionKind[] =
      request.status === "draft"
        ? [...(verified && problems.length === 0 ? (["publish"] as const) : []), "delete"]
        : request.status === "active"
          ? [...(verified ? (["renew"] as const) : []), "fulfilled", "withdrawn"]
          : request.status === "expired"
            ? [...(verified ? (["publish"] as const) : []), "fulfilled", "withdrawn"]
            : [];
    const f = p.requestForm;
    const labels: Record<string, string> = {
      description: f.description, categoryId: f.category, typeIds: f.types, formIds: f.forms, quantity: f.quantity, unitKey: f.unit, minLot: f.minLot,
      frequency: f.frequency, recurrencePeriod: f.period, neededUntil: f.neededUntil, maxPriceAmount: f.maxPrice, maxPriceUnitKey: f.maxPriceUnit, criteria: f.specs,
    };
    const fieldLabel = (field: string) => labels[field.split(".")[0]] ?? field;
    aside = (
      <>
        <Section title={request.status === "draft" ? d.ownDraft : d.ownRequest} icon={<PencilIcon size={18} />} id="manage">
          <div className="grid gap-4">
            {request.status === "draft" && (
              problems.length > 0 ? (
                <Notice tone="attention" title={p.myRequests.notPublishable}>
                  <ul className="list-disc pl-5">
                    {[...new Map(problems.map((problem) => [problem.field, problem])).values()].map((problem) => (
                      <li key={problem.field}>
                        {fieldLabel(problem.field)}: {fieldErrorText(problem.code, p.errors)}
                      </li>
                    ))}
                  </ul>
                </Notice>
              ) : (
                <p className="text-[15px] text-pretty">{verified ? p.myRequests.publishText : p.requestForm.pendingNote}</p>
              )
            )}
            {request.status !== "closed" && viewer.site.status !== "declined" && (
              <Link href={editRequestPath(request.id)} className={`${buttonSecondary} justify-self-start`}>
                <PencilIcon size={16} />
                {p.common.edit}
              </Link>
            )}
            {actions.length > 0 && <RequestActions requestId={request.id} revision={request.revision ?? 1} actions={actions} t={p} primary="publish" />}
          </div>
        </Section>
        {request.status !== "draft" && (
          <Section title={`${r.title} (${responses.length})`} icon={<MailIcon size={18} />} id="responses">
            {responses.length === 0 ? <EmptyState title={r.none} /> : <ResponseList responses={responses} t={p} format={format} canReply={verified} />}
          </Section>
        )}
      </>
    );
  } else if (viewer.role === "admin") {
    aside = (
      <Section title={r.respondTitle} icon={<SendIcon size={18} />} id="respond">
        <p className="text-[15px]">{r.disabledAdmin}</p>
      </Section>
    );
  } else if (viewer.site.status !== "verified") {
    aside = (
      <Section title={r.respondTitle} icon={<SendIcon size={18} />} id="respond">
        <p className="text-[15px]">{r.disabledPending}</p>
      </Section>
    );
  } else {
    const [mine, own] = await Promise.all([listResponses(viewer, request.id), ownOffersForRequest(viewer, request.id)]);
    const requestId = request.id;
    aside = (
      <>
        <OwnMatchList items={own} hrefOf={(item) => matchPath(requestId, item.id)} text={p.matches.ownOffersText} empty={p.matches.noOwnOffers} t={p} />
        <Section title={mine.length > 0 ? r.yours : r.respondTitle} icon={<SendIcon size={18} />} id="respond">
          {mine.length > 0 ? (
            <ResponseList responses={mine} t={p} format={format} canReply={false} />
          ) : (
            <RespondForm requestId={request.id} ownOffers={own.map(({ id: offerId, ref, title }) => ({ id: offerId, ref, title }))} preselect={own.find((item) => item.match.result !== "incompatible")?.id} t={p} />
          )}
        </Section>
      </>
    );
  }

  return (
    <RequestDetailView
      request={request}
      catalogue={catalogue}
      t={p}
      locale={page.locale}
      format={format}
      back={<BackLink href={request.isOwner ? ROUTES.myRequests : ROUTES.requests}>{request.isOwner ? d.backToMyRequests : d.backToResults}</BackLink>}
      aside={aside}
    />
  );
}
