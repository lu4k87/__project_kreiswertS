// Enquiries of the own site (received and sent) with the listing they belong to (L1-017).
import Link from "next/link";
import type { PlatformMessages } from "@/i18n/platform";
import type { Enquiry } from "@/server/dal/enquiries";
import { Badge } from "@/components/ui/elements";
import { offerPath } from "@/components/layout/links";
import type { Formatters } from "@/components/offers/format";
import { ResponseForm } from "./response-form";

type Props = { enquiries: Enquiry[]; t: PlatformMessages; format: Formatters; canRespond: boolean };

export function EnquiryList({ enquiries, t, format, canRespond }: Props) {
  const e = t.enquiry;
  return (
    <ul className="grid gap-3">
      {enquiries.map((enquiry) => {
        const received = enquiry.direction === "received";
        return (
          <li key={enquiry.id} className="grid gap-2 rounded-xl border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Badge tone={received ? "solid" : "neutral"}>{received ? e.received : e.sent2}</Badge>
              <Badge tone={enquiry.response ? "neutral" : "attention"}>{enquiry.response ? e.responded : e.waiting}</Badge>
              <span className="text-[13px] text-muted">{format.dateTime(enquiry.createdAt)}</span>
            </div>
            <p className="text-[15px] leading-snug font-semibold">{t.labels.enquiryTopic[enquiry.topic]}</p>
            <Link href={offerPath(enquiry.offer.id)} className="block w-fit max-w-full text-[15px] leading-snug font-medium break-words underline underline-offset-4">
              {enquiry.offer.title}
            </Link>
            <p className="text-[13px] leading-normal text-muted">
              {`${t.common.listing} ${enquiry.offer.ref} · ${received ? e.fromSite : e.toSite}: ${enquiry.counterpart.companyName} – ${enquiry.counterpart.name}`}
            </p>
            <p className="text-[15px] leading-relaxed break-words whitespace-pre-line">{enquiry.message}</p>
            {enquiry.response ? (
              <div className="rounded-lg bg-mint px-3 py-2">
                <p className="text-[13px] font-semibold">
                  {e.response}
                  {enquiry.respondedAt && ` · ${format.dateTime(enquiry.respondedAt)}`}
                </p>
                <p className="text-[15px] leading-relaxed break-words whitespace-pre-line">{enquiry.response}</p>
              </div>
            ) : (
              received && canRespond && <ResponseForm enquiryId={enquiry.id} t={t} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
