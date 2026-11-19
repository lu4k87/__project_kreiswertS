// Platzhalter: Die Oberfläche baut das Frontend-Team (siehe README „Wer arbeitet wo“).
export default function Home() {
  return (
    <main>
      <h1>KreiswertS</h1>
      <p>Backend läuft. Die Oberfläche folgt vom Frontend-Team.</p>
      <ul>
        <li><a href="/api/health">/api/health</a> – Server + Datenbank</li>
        <li><a href="/api/offers">/api/offers</a> – Angebote (Gast-Sicht ohne Login)</li>
      </ul>
    </main>
  );
}
