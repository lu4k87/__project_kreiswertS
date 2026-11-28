// Create request (PG-18): the request form with an empty draft. Every site that is not declined may draft.
import { getCatalogue } from "@/server/dal/catalogue";
import { calendarDay } from "@/server/domain/dates";
import { BackLink, Notice, PageHeader } from "@/components/ui/elements";
import { ROUTES } from "@/components/layout/links";
import { MatchingExplainer } from "@/components/matches/matching-explainer";
import { RequestForm } from "@/components/requests/request-form";
import { newRequestInput } from "@/components/requests/request-form-state";
import { platformPage } from "../../gate";

export default async function NewRequestPage() {
  const page = await platformPage("site", ROUTES.newRequest);
  const p = page.t.platform;
  const f = p.requestForm;
  if (page.blocked) return <><PageHeader title={f.createTitle} />{page.blocked}</>;
  const back = <BackLink href={ROUTES.myRequests}>{f.backToMyRequests}</BackLink>;
  if (page.viewer.site.status === "declined") {
    return (
      <>
        <PageHeader title={f.createTitle} back={back} />
        <Notice tone="attention" title={p.gate.declinedTitle}>{p.gate.declinedText}</Notice>
      </>
    );
  }
  const catalogue = await getCatalogue();
  return (
    <>
      <PageHeader title={f.createTitle} back={back} intro={p.requestSearch.createText} />
      {page.viewer.site.status === "pending" && <Notice tone="attention">{f.pendingNote}</Notice>}
      <RequestForm mode="create" initial={newRequestInput(catalogue)} catalogue={catalogue} t={p} locale={page.locale} today={calendarDay()} aside={<MatchingExplainer t={p} />} />
    </>
  );
}
