// Platzhalter: Die Oberfläche baut das Frontend-Team (siehe README „Wer arbeitet wo“).
const linkClass = "text-blue-700 underline";

export default function Home() {
  return (
    <main className="mx-auto max-w-md p-5">
      <h1 className="text-2xl font-bold">KreiswertS</h1>
      <p>Backend läuft. Die Oberfläche folgt vom Frontend-Team.</p>
      <h2 className="mt-4 mb-1 text-lg font-bold">Testseiten Login</h2>
      <ul className="list-disc pl-5">
        <li><a href="/registrieren" className={linkClass}>Registrieren</a></li>
        <li><a href="/login" className={linkClass}>Login</a></li>
        <li><a href="/konto" className={linkClass}>Mein Konto</a></li>
      </ul>
      <h2 className="mt-4 mb-1 text-lg font-bold">API</h2>
      <ul className="list-disc pl-5">
        <li><a href="/api/health" className={linkClass}>/api/health</a> – Server + Datenbank</li>
        <li><a href="/api/offers" className={linkClass}>/api/offers</a> – Angebote (Gast-Sicht ohne Login)</li>
      </ul>
    </main>
  );
}
