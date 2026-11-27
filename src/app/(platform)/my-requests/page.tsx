// My requests (PG-17): active, draft, closed and expired requests of the own site with the actions of each state
// and the responses received.
import Link from "next/link";
import { getCatalogue } from "@/server/dal/catalogue";
import { openNegotiationsFor } from "@/server/dal/negotiations";
import { listMyRequests, listResponses, type MyRequest } from "@/server/dal/requests";
import { EmptyState, Notice, PageHeader, Section, buttonPrimary, buttonQuiet } from "@/components/ui/elements";
import { ClockIcon, FileTextIcon, LayersIcon, MailIcon, PencilIcon, PlusIcon } from "@/components/ui/icons";
import { ROUTES, editRequestPath, requestPath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { ListingTabs } from "@/components/requests/listing-tabs";
import { RequestActions, type RequestActionKind } from "@/components/requests/request-actions";
import { RequestCard } from "@/components/requests/request-card";
import { ResponseList } from "@/components/requests/response-list";
import { platformPage } from "../gate";

export default async function MyRequestsPage() {
  const page = await platformPage("site", ROUTES.myRequests);
  const p = page.t.platform;
  const m = p.myRequests;
  if (page.blocked) return <><PageHeader title={m.title} />{page.blocked}</>;

  const [requests, responses, catalogue] = await Promise.all([listMyRequests(page.viewer), listResponses(page.viewer), getCatalogue()]);
  const format = makeFormatters(page.locale, p, catalogue.units);
  const status = page.viewer.site.status;
  const verified = status === "verified";
  // responses that name an offer lead to a negotiation – only a verified site can propose terms
  const offerIds = responses.flatMap((response) => (response.offer ? [response.offer.id] : []));
  const negotiations = verified ? await openNegotiationsFor(page.viewer, offerIds) : undefined;
  const mayEdit = status !== "declined";
  const groups = {
    active: requests.filter((request) => request.status === "active"),
    drafts: requests.filter((request) => request.status === "draft"),
    ended: requests.filter((request) => request.status === "closed" || request.status === "expired"),
  };
  const received = responses.filter((response) => response.direction === "received");
  const sent = responses.filter((response) => response.direction === "sent");

  const card = (request: MyRequest) => {
    const actions: RequestActionKind[] =
      request.status === "draft"
        ? ["delete"]
        : request.status === "active"
          ? ["fulfilled", "withdrawn"]
          : request.status === "expired"
            ? [...(verified ? (["renew"] as const) : []), "fulfilled", "withdrawn"]
            : [];
    return (
      <li key={request.id}>
        <RequestCard
          request={request}
          t={p}
          locale={page.locale}
          format={format}
          catalogue={catalogue}
          showDistance={false}
          footer={
            <div className="grid gap-3 border-t border-line pt-3">
              <p className="text-[13px] text-muted">
                {request.status === "active" && request.expiresAt && `${m.expires} ${format.date(request.expiresAt)} · `}
                {request.status === "expired" && request.expiresAt && `${m.expired} ${format.date(request.expiresAt)} · `}
                {m.updated} {format.dateTime(request.updatedAt)}
                {request.status !== "draft" && ` · ${m.responses}: ${request.responseCount}`}
              </p>
              <div className="flex flex-wrap items-start gap-2">
                <Link href={requestPath(request.id)} className={buttonQuiet}>
                  {request.status === "draft" ? `${m.view} / ${m.publish}` : m.view}
                </Link>
                {mayEdit && request.status !== "closed" && (
                  <Link href={editRequestPath(request.id)} className={buttonQuiet}>
                    <PencilIcon size={16} />
                    {p.common.edit}
                  </Link>
                )}
                {actions.length > 0 && <RequestActions requestId={request.id} revision={request.revision} actions={actions} t={p} />}
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
            <Link href={ROUTES.newRequest} className={buttonPrimary}>
              <PlusIcon size={18} />
              {p.nav.createRequest}
            </Link>
          )
        }
      />
      <ListingTabs current="requests" t={p} />
      {status === "pending" && <Notice tone="attention">{p.requestForm.pendingNote}</Notice>}
      {status === "declined" && <Notice tone="attention" title={p.gate.declinedTitle}>{p.gate.declinedText}</Notice>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <Section title={`${m.active} (${groups.active.length})`} icon={<FileTextIcon size={18} />} id="active">
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
                <p className="mt-3 text-[13px] leading-normal text-muted">{m.closedNote}</p>
              </>
            )}
          </Section>
        </div>
        <div className="grid min-w-0 gap-6">
          <Section title={`${p.responses.received} (${received.length})`} icon={<MailIcon size={18} />} id="received">
            {received.length === 0 ? <EmptyState title={p.responses.none} /> : <ResponseList responses={received} t={p} format={format} canReply={verified} showRequest negotiations={negotiations} />}
          </Section>
          {sent.length > 0 && (
            <Section title={`${p.responses.sent} (${sent.length})`} icon={<MailIcon size={18} />} id="sent">
              <ResponseList responses={sent} t={p} format={format} canReply={false} showRequest negotiations={negotiations} />
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
