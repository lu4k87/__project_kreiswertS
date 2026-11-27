// Page footer: copyright, prototype note and the links to help, guide (function no. 46), contact and the legal
// sections (PG-28).
import Link from "next/link";
import type { Messages } from "@/i18n/messages";
import { ROUTES } from "./links";

export function SiteFooter({ t }: { t: Messages }) {
  const links = [
    { label: t.footer.help, href: ROUTES.help },
    { label: t.footer.guide, href: ROUTES.guide },
    { label: t.footer.privacy, href: `${ROUTES.help}#privacy` },
    { label: t.footer.terms, href: `${ROUTES.help}#terms` },
    { label: t.footer.contact, href: `${ROUTES.help}#contact` },
  ];
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-6 text-sm text-muted sm:px-8">
        <p>
          {t.footer.copyright} {t.footer.prototype}
        </p>
        <nav aria-label={t.common.footerNav}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-ink hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
