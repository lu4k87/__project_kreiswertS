# Frontend: so baut ihr die App auf

Für das Frontend-Team. Das Backend (Login, Zugriffsregeln, Datenbank, erster Endpunkt) steht schon; diese Seite zeigt, wo eure Seiten hingehören, wie sie an Daten und Login kommen und was ihr beim Backend anfragt.

Kurz: **Ein Next.js-Projekt für alles.** Ihr baut Seiten in `src/app/` und Bausteine in `src/components/`. Daten kommen nur über die fertigen Backend-Funktionen bzw. `/api/*`, nie direkt aus der Datenbank.

## 1. Loslegen

1. Projekt einrichten wie in der [README „Lokal starten“](../README.md#lokal-starten) (Node.js ≥ 20.9, PostgreSQL, `.env`, `npm run db:push`).
2. `npm run dev` → <http://localhost:3000>. Immer über genau diese Adresse öffnen, nicht `127.0.0.1` oder die IP: Login prüft die Herkunft gegen `BETTER_AUTH_URL`.
3. Testen: Startseite → „Testseiten Login“ → registrieren → `/konto` zeigt die eigene Session; <http://localhost:3000/api/offers> zeigt Angebote (ohne Login in der Gast-Sicht).
4. Design: Figma-Link in [`CONTENT/Figma.txt`](../CONTENT/Figma.txt), Funktionen in [`docs/FUNKTIONEN.md`](FUNKTIONEN.md).

## 2. Wer arbeitet wo

| Ordner | Inhalt | Wer |
|---|---|---|
| `src/app/**/page.tsx`, `src/app/**/layout.tsx` | Seiten: ein Ordner = eine Adresse (`src/app/angebote/page.tsx` → `/angebote`) | **Frontend** |
| `src/components/` | Wiederverwendbare Bausteine (Button, Karte, Filter …), Ordner legt ihr an | **Frontend** |
| `src/app/globals.css` | Tailwind CSS v4 + eure Design-Tokens aus Figma | **Frontend** |
| `public/` | Bilder, Icons, Logos (`public/logo.svg` → `/logo.svg`), Ordner legt ihr an | **Frontend** |
| `src/app/api/` | Endpunkte (Route Handler) | Backend |
| `src/server/` | Login, Prüfung, Zugriffsregeln, Datenbank | Backend + DB |
| `src/lib/` | Helfer für beide Seiten (`auth-client.ts`, `auth-errors.ts`) | Backend, ihr nutzt sie |

Vorschlag für `src/components/` (anpassen, wie es zu Figma passt):

```text
src/components/
├── ui/        Button, Input, Card, Badge … (Grundbausteine aus Figma)
├── layout/    Header, Navigation, Footer
└── offers/    OfferCard, OfferList, OfferFilter … (je Funktion ein Ordner)
```

Import immer mit `@/` statt `../../`: `import { OfferCard } from "@/components/offers/offer-card";`

## 3. Was ihr vom Backend nutzen dürft

| Erlaubt | Wofür |
|---|---|
| `fetch("/api/…")` | Daten in Client-Komponenten (Browser) |
| `@/server/dal/*` (Funktionen) | Daten in Server-Komponenten (Seite wird auf dem Server gebaut) |
| `@/server/viewer` → `getViewer()` | Gast oder Mitglied? (Server-Komponenten) |
| `@/server/validation/*` | Eingaben/Filter prüfen + TypeScript-Typen |
| `@/server/domain/status` | Status-Werte und erlaubte Wechsel (z. B. Kooperation) |
| `@/lib/auth-client` → `authClient` | Registrieren, Login, Logout, Session im Browser |
| `@/lib/auth-errors` → `authErrorText()` | Login-Fehler als deutscher Satz |
| **Nie:** `@/server/db/*` | Datenbank direkt – umgeht die Zugriffsregeln |

- Meldet der Build `"server-only" cannot be imported from a Client Component`: ihr habt Server-Code in eine Datei mit `"use client"` geholt → dort `fetch("/api/…")` nehmen. Reine Typen (`import type { … }`) dürfen überall stehen.
- **Was ein Gast sieht, entscheidet das Backend**, nicht die Oberfläche. Ausblenden im Frontend ist kein Schutz – fehlt ein Feld in der Antwort, darf die Rolle es nicht sehen.

## 4. Daten holen: zwei Wege

**Faustregel:** Lesen (Listen, Details) → Server-Komponente. Interaktiv (Formular, Karte, Live-Filter) → kleine Client-Komponente mit `"use client"`, die nur diesen Teil übernimmt.

### a) Server-Komponente (Standard)

Kein Ladezustand nötig, Login-Cookie wird automatisch mitgelesen. Filter kommen aus der Adresse (`/angebote?city=Moers`), z. B. aus einem normalen `<form method="get">`.

```tsx
// src/app/angebote/page.tsx
import { headers } from "next/headers";
import { getViewer } from "@/server/viewer";
import { listOffers } from "@/server/dal/offers";
import { offerListQuery } from "@/server/validation/offers";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AngebotePage({ searchParams }: Props) {
  const viewer = await getViewer(await headers());
  const parsed = offerListQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : offerListQuery.parse({}); // ungültiger Filter → ohne Filter
  const offers = await listOffers(viewer, query);

  return (
    <main>
      <form method="get">
        <input name="city" defaultValue={query.city ?? ""} placeholder="Stadt" />
        <button type="submit">Suchen</button>
      </form>
      <ul>
        {offers.map((offer) => (
          <li key={offer.id}>
            {offer.title} · {offer.materialName} · {offer.availableQuantityKg} kg · {offer.city}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

### b) Client-Komponente über `/api/…`

Für Teile, die ohne Neuladen reagieren sollen. Das Login-Cookie geht automatisch mit (gleiche Adresse).

```tsx
// src/components/offers/offer-search.tsx
"use client";
import { useEffect, useState } from "react";
import type { GuestOffer, MemberOffer } from "@/server/dal/offer-view";

type OffersResponse = { role: "guest" | "member"; offers: (GuestOffer | MemberOffer)[] };

export function OfferSearch({ city }: { city: string }) {
  const [data, setData] = useState<OffersResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ city });
    fetch(`/api/offers?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(setData)
      .catch(() => setError("Angebote konnten nicht geladen werden."));
  }, [city]);

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Lädt …</p>;
  return <p>{data.offers.length} Angebote</p>;
}
```

Jede Liste braucht drei Zustände aus Figma: **lädt**, **leer** („Keine Angebote gefunden“), **Fehler**.

## 5. Gast und Mitglied

Jede Antwort sagt, wer fragt (`role`); Mitglieder bekommen mehr Felder.

| Feld (`GET /api/offers`) | Gast | Mitglied |
|---|---|---|
| `id`, `title`, `materialName`, `availableQuantityKg`, `city` | ✅ | ✅ |
| `priceEurPerKg`, `description`, `contactName`, `contactEmail`, `contactPhone` | – | ✅ |

```ts
import type { GuestOffer, MemberOffer } from "@/server/dal/offer-view";

/** Hat dieses Angebot die Mitglieder-Felder? */
export const isMemberOffer = (offer: GuestOffer | MemberOffer): offer is MemberOffer => "priceEurPerKg" in offer;
```

Gast-Ansicht: an der Stelle von Preis/Kontakt ein Hinweis „Einloggen, um Preis und Kontakt zu sehen“ mit Link zu `/login`.

## 6. Login, Registrieren, Konto

Die Seiten `/login`, `/registrieren`, `/konto` sind **Testseiten ohne Design** und zeigen, wie es funktioniert. Ersetzt sie nach Figma (gleiche Adressen); danach `src/app/_test/` löschen.

| Aufgabe | Aufruf (Browser) |
|---|---|
| Registrieren | `await authClient.signUp.email({ name, email, password })` |
| Einloggen | `await authClient.signIn.email({ email, password })` |
| Abmelden | `await authClient.signOut()` |
| Session in Client-Komponente | `const { data: session, isPending } = authClient.useSession()` |
| Fehler anzeigen | `const { error } = await …; if (error) setError(authErrorText(error))` |

- Nach Login/Logout `router.refresh()` aufrufen, damit Server-Komponenten die neue Rolle sehen (Muster: [`src/app/login/page.tsx`](../src/app/login/page.tsx)).
- Passwort: 8 bis 128 Zeichen (Better Auth). Formularfelder mit `autoComplete="email"` / `"current-password"` / `"new-password"`.

Seite nur für Mitglieder (Server-Komponente):

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/viewer";

export default async function NurMitgliederPage() {
  const viewer = await getViewer(await headers());
  if (viewer.role === "guest") redirect("/login");
  return <main>…</main>;
}
```

## 7. Status anzeigen (Kooperation)

Status-Werte stehen einmal in [`src/server/domain/status.ts`](../src/server/domain/status.ts); DB, API und Oberfläche nutzen dieselben Werte. Ihr ordnet nur Text und Farbe zu – TypeScript meldet, wenn ein Status fehlt:

```ts
import type { CooperationStatus } from "@/server/domain/status";

export const COOPERATION_LABEL: Record<CooperationStatus, string> = {
  requested: "Angefragt",
  negotiation: "In Verhandlung",
  agreed: "Vereinbart",
  in_progress: "Läuft",
  completed: "Abgeschlossen",
  rejected: "Abgelehnt",
  cancelled: "Abgebrochen",
};
```

Welche Knöpfe (z. B. „Annehmen“) ein Status zeigt: `canTransition(cooperationFlow, from, to)` aus derselben Datei. Ob der Nutzer den Wechsel darf, prüft trotzdem das Backend.

## 8. Gestaltung (Tailwind CSS v4)

- Farben, Schriften, Abstände aus Figma **einmal** als Tokens in [`src/app/globals.css`](../src/app/globals.css) anlegen, dann überall die Klassen nutzen statt fester Werte:

```css
@import "tailwindcss";

@theme {
  --color-brand: #1f7a4d;        /* Beispielwerte → aus Figma übernehmen */
  --color-brand-dark: #145536;
  --font-sans: "Inter", system-ui, sans-serif;
}
/* → Klassen bg-brand, text-brand-dark, font-sans */
```

- Schriften über `next/font` in [`src/app/layout.tsx`](../src/app/layout.tsx) laden (kein externer Link im HTML).
- Header und Navigation, die auf jeder Seite stehen, gehören in `src/app/layout.tsx`.
- Seitensprache ist Deutsch (`<html lang="de">`).

## 9. Seiten und Daten: was es schon gibt

Adressen sind ein Vorschlag (deutsch wie `/login`, `/konto`); abstimmen und hier eintragen.

| Seite | Adresse | Daten vom Backend |
|---|---|---|
| Login, Registrieren, Konto | `/login`, `/registrieren`, `/konto` | ✅ Better Auth – Testseiten nach Figma ersetzen |
| Angebote: Liste + Suche | `/angebote` | ✅ `GET /api/offers?materialId=&city=&limit=` (max. 100) |
| Karte | `/karte` | ⏳ Koordinaten + Entfernung fehlen noch in der Antwort |
| Material-Filter (Auswahlliste) | – | ⏳ Liste der Materialien fehlt (`GET /api/materials`) |
| Angebot: Detail · einstellen | `/angebote/[id]` · `/angebote/neu` | ⏳ fehlt |
| Bedarf | `/bedarf` | ⏳ Datenmodell noch offen |
| Kooperationen | `/kooperationen`, `/kooperationen/[id]` | ⏳ Endpunkte fehlen · ✅ Status-Werte in `status.ts` |
| Benachrichtigungen | `/benachrichtigungen` | ⏳ geplant |
| Netzwerk-Übersicht · Wirkung | `/netzwerk` · `/wirkung` | ⏳ geplant |

**Seite braucht Daten, die es noch nicht gibt:**

1. Beim Backend anfragen mit: Seite · welche Felder · welche Filter/Sortierung · Gast oder nur Mitglied.
2. Backend legt zuerst den **Typ** der Antwort fest (wie `GuestOffer`/`MemberOffer`).
3. Bis der Endpunkt steht: Seite mit Beispieldaten in genau diesem Typ bauen, Stelle mit `// MOCK` markieren → später nur die Datenquelle tauschen.

## 10. Vor jedem Commit

```bash
npm run check    # TypeScript + Tests – muss grün sein
npm run build    # Produktions-Build – zeigt z. B. Server-/Client-Fehler
```

- Keine echten Firmen- oder Kontaktdaten einchecken: das Repo ist öffentlich, im Prototyp nur Demo-Daten.
- `.env` nie einchecken, nie in Screenshots zeigen.
- Neue npm-Pakete kurz mit dem Backend abstimmen (vitest bleibt auf 4.x).
