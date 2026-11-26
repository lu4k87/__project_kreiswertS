// Marks the test pages (login); the frontend team replaces them per Figma.
export function TestNotice() {
  return (
    <p className="mb-4 rounded border border-amber-700 bg-amber-100 px-3 py-1.5 text-sm text-amber-950">
      For testing only – the frontend team replaces this page.
    </p>
  );
}

export const buttonClass =
  "justify-self-start rounded bg-neutral-900 px-3 py-1.5 font-semibold text-white disabled:opacity-60";
export const linkClass = "text-blue-700 underline";
