// Individual match (PG-22): one request against one offer, explained per criterion. The viewer owns one of them.
import { notFound } from "next/navigation";
import { AccessError } from "@/server/access";
import { getCatalogue } from "@/server/dal/catalogue";
import { getMatch } from "@/server/dal/matches";
import { idParam } from "@/server/validation/common";
import { BackLink, PageHeader } from "@/components/ui/elements";
import { ROUTES, matchPath } from "@/components/layout/links";
import { makeFormatters } from "@/components/offers/format";
import { MatchDetailView } from "@/components/matches/match-detail-view";
import { platformPage } from "../../../gate";

type Props = { params: Promise<{ requestId: string; offerId: string }> };

export default async function MatchPage({ params }: Props) {
  const raw = await params;
  const requestId = idParam.safeParse(raw.requestId);
  const offerId = idParam.safeParse(raw.offerId);
  if (!requestId.success || !offerId.success) notFound();
  const page = await platformPage("site", matchPath(requestId.data, offerId.data));
  const p = page.t.platform;
  if (page.blocked) return <><PageHeader title={p.matches.detailTitle} />{page.blocked}</>;

  let detail;
  try {
    detail = await getMatch(page.viewer, requestId.data, offerId.data);
  } catch (error) {
    if (!(error instanceof AccessError)) throw error;
    if (error.code === "NOT_FOUND") notFound();
    const gate = await platformPage("browse", matchPath(requestId.data, offerId.data));
    return gate.blocked ?? notFound();
  }
  const catalogue = await getCatalogue();
  return (
    <MatchDetailView
      detail={detail}
      catalogue={catalogue}
      t={p}
      locale={page.locale}
      format={makeFormatters(page.locale, p, catalogue.units)}
      back={<BackLink href={ROUTES.matches}>{p.matches.backToMatches}</BackLink>}
    />
  );
}
