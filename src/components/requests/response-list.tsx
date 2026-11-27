// Responses to requests (L2-003): received ones for the requester (with a one-time reply), the own sent ones for
// the responder. Each item names the request version it answered – an edit of the request does not change that.
import Link from "next/link";
import type { PlatformMessages } from "@/i18n/platform";
import type { ResponseView } from "@/server/dal/requests";
import { Badge } from "@/components/ui/elements";
import { offerPath, requestPath } from "@/components/layout/links";
import type { Formatters } from "@/components/offers/format";
import { ReplyForm } from "./reply-form";

type Props = { responses: ResponseView[]; t: PlatformMessages; format: Formatters; canReply: boolean; showRequest?: boolean };

export function ResponseList({ responses, t, format, canReply, showRequest = false }: Props) {
  const r = t.responses;
  return (
    <ul className="grid gap-3">
      {responses.map((response) => {
        const received = response.direction === "received";
        return (
          <li key={response.id} className="grid gap-2 rounded-xl border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Badge tone={received ? "solid" : "neutral"}>{received ? r.received : r.sent}</Badge>
              <Badge tone={response.reply ? "neutral" : "attention"}>{response.reply ? r.replied : r.noReply}</Badge>
              <span className="text-[13px] text-muted">{format.dateTime(response.createdAt)}</span>
            </div>
            {showRequest && (
              <Link href={requestPath(response.request.id)} className="block w-fit max-w-full text-[15px] leading-snug font-semibold break-words underline underline-offset-4">
                {response.request.title}
              </Link>
            )}
            <p className="text-[13px] leading-normal text-muted">
              <span translate="no">{response.request.ref}</span> · {received ? r.from : r.to}: {response.otherSite.companyName} – {response.otherSite.name}
            </p>
            {response.offer && (
              <p className="text-[15px]">
                {r.viaOffer}:{" "}
                <Link href={offerPath(response.offer.id)} className="font-medium underline underline-offset-4">
                  {response.offer.title}
                </Link>{" "}
                <span className="text-[13px] text-muted" translate="no">
                  ({response.offer.ref})
                </span>
              </p>
            )}
            <p className="max-w-[68ch] text-[15px] leading-relaxed break-words whitespace-pre-line">{response.message}</p>
            {response.answeredOlder && <p className="text-[13px] leading-normal text-notice">{r.answeredOlder}</p>}
            {response.reply ? (
              <div className="rounded-lg bg-mint px-3 py-2">
                <p className="text-[13px] font-semibold">
                  {r.replied}
                  {response.repliedAt && ` · ${format.dateTime(response.repliedAt)}`}
                </p>
                <p className="max-w-[68ch] text-[15px] leading-relaxed break-words whitespace-pre-line">{response.reply}</p>
              </div>
            ) : (
              received && canReply && <ReplyForm responseId={response.id} t={t} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
