// Help, contact & legal (PG-28): frequently asked questions, contact, and the legal sections. The legal texts are
// labelled placeholders – the project team supplies them; nothing is invented here.
import { headers } from "next/headers";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { getViewerOrGuest } from "@/server/viewer";
import { Notice, PageHeader, Section } from "@/components/ui/elements";
import { FileTextIcon, InfoIcon, MailIcon } from "@/components/ui/icons";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default async function HelpPage() {
  const locale = await getLocale();
  const t = messages[locale];
  const h = t.platform.help;
  const viewer = await getViewerOrGuest(await headers());
  const legal = [
    { id: "legal-notice", title: h.legalTitle },
    { id: "privacy", title: h.privacyTitle },
    { id: "terms", title: h.termsTitle },
  ];

  return (
    <>
      <SiteHeader t={t} locale={locale} variant="public" current="help" isMember={viewer.role !== "guest"} />
      <main id="content" className="mx-auto grid w-full max-w-[1000px] grid-cols-[minmax(0,1fr)] content-start gap-8 px-5 py-8 sm:px-8 lg:py-10">
        <PageHeader title={h.title} />

        <Section title={h.faqTitle} icon={<InfoIcon size={18} />} id="faq">
          <div className="grid gap-2">
            {h.faq.map((entry) => (
              <details key={entry.q} className="group rounded-xl border border-line">
                <summary className="flex list-none items-center justify-between gap-4 rounded-xl px-4 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                  <h3 className="min-w-0 text-lg leading-snug font-semibold text-balance">{entry.q}</h3>
                  <span aria-hidden="true" className="flex-none text-lg leading-none transition-transform duration-150 group-open:rotate-45 motion-reduce:transition-none">
                    +
                  </span>
                </summary>
                <p className="border-t border-line px-4 py-3 text-[15px] leading-relaxed text-pretty">{entry.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <div id="contact" className="scroll-mt-6">
          <Section title={h.contactTitle} icon={<MailIcon size={18} />} id="contact-heading">
            <p className="prose-justify text-[15px] leading-relaxed">{h.contactText}</p>
          </Section>
        </div>

        {legal.map((entry) => (
          <div key={entry.id} id={entry.id} className="scroll-mt-6">
            <Section title={entry.title} icon={<FileTextIcon size={18} />} id={`${entry.id}-heading`}>
              <Notice tone="attention">{h.placeholder}</Notice>
            </Section>
          </div>
        ))}
      </main>
      <SiteFooter t={t} />
    </>
  );
}
