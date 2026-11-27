// Edit request (PG-18, L2-004): the request form with the stored values and the revision they were read at –
// saving with an outdated revision is refused, and every saved state stays in the history.
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { getMyRequest } from "@/server/dal/requests";
import { calendarDay } from "@/server/domain/dates";
import { idParam } from "@/server/validation/common";
import { BackLink, Badge, Notice, PageHeader } from "@/components/ui/elements";
import { ROUTES, editRequestPath } from "@/components/layout/links";
import { MatchingExplainer } from "@/components/matches/matching-explainer";
import { RequestForm } from "@/components/requests/request-form";
import { platformPage } from "../../../gate";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };

export default async function EditRequestPage({ params, searchParams }: Props) {
  const id = idParam.safeParse((await params).id);
  if (!id.success) notFound();
  const page = await platformPage("site", editRequestPath(id.data));
  const p = page.t.platform;
  const f = p.requestForm;
  if (page.blocked) return <><PageHeader title={f.editTitle} />{page.blocked}</>;

  let request;
  try {
    request = await getMyRequest(page.viewer, id.data);
  } catch (error) {
    if (error instanceof AccessError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const status = page.viewer.site.status;
  const header = (
    <PageHeader
      title={f.editTitle}
      back={<BackLink href={ROUTES.myRequests}>{f.backToMyRequests}</BackLink>}
      actions={<Badge tone={request.status === "active" ? "solid" : "outline"}>{p.labels.offerStatus[request.status]}</Badge>}
    />
  );
  // Same rules as updateRequest(): say why instead of showing a form whose saving would fail.
  if (request.status === "closed") return <>{header}<Notice tone="attention">{p.errors.api.REQUEST_CLOSED}</Notice></>;
  if (status === "declined") return <>{header}<Notice tone="attention" title={p.gate.declinedTitle}>{p.gate.declinedText}</Notice></>;
  if (status !== "verified" && request.status !== "draft") return <>{header}<Notice tone="attention" title={p.gate.pendingTitle}>{p.errors.api.NOT_VERIFIED}</Notice></>;

  const catalogue = await getCatalogue();
  return (
    <>
      {header}
      {(await searchParams).saved === "1" && <Notice tone="success" live>{f.saved}</Notice>}
      {status === "pending" && <Notice tone="attention">{f.pendingNote}</Notice>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <RequestForm
          key={request.revision}
          mode="edit"
          requestId={request.id}
          revision={request.revision}
          status={request.status}
          initial={request.input}
          catalogue={catalogue}
          t={p}
          locale={page.locale}
          today={calendarDay()}
        />
        <MatchingExplainer t={p} />
      </div>
    </>
  );
}
