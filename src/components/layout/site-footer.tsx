// Page footer: copyright and legal links (targets are placeholders until the pages exist).
import type { Messages } from "@/i18n/messages";
import { PLACEHOLDER_HREF } from "./links";

export function SiteFooter({ t }: { t: Messages }) {
  const links = [t.footer.privacy, t.footer.terms, t.footer.contact];
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-6 text-sm text-muted sm:px-8">
        <p>{t.footer.copyright}</p>
        <nav aria-label={t.common.footerNav}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((label) => (
              <li key={label}>
                <a href={PLACEHOLDER_HREF} className="hover:text-ink hover:underline">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
