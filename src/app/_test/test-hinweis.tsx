// Kennzeichnung der Testseiten (Login); das Frontend-Team ersetzt sie nach Figma.
export function TestHinweis() {
  return (
    <p className="mb-4 rounded border border-amber-700 bg-amber-100 px-3 py-1.5 text-sm text-amber-950">
      Nur zum Testen – das Frontend-Team ersetzt diese Seite.
    </p>
  );
}

export const buttonClass =
  "justify-self-start rounded bg-neutral-900 px-3 py-1.5 font-semibold text-white disabled:opacity-60";
export const linkClass = "text-blue-700 underline";
