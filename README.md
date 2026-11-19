# KreiswertS

Plattform-Prototyp für den zirkulären Kunststoff-Materialaustausch in Kamp-Lintfort: Betriebe stellen Kunststoff-Reste als Angebote ein, andere Betriebe finden und matchen sie.

Proof of Concept, kein operativer Marktplatz. Alle Firmendaten im Prototyp sind Demo-Daten.

## Tech-Stack

| Schicht | Baustein |
|---|---|
| Sprache · Framework · Laufzeit | TypeScript · Next.js (App Router, Seiten + API in einem Projekt) · Node.js ≥ 20.9 |
| Benutzeroberfläche | React · Tailwind CSS v4 (Frontend-Team, Einstieg `src/app/globals.css`) |
| Backend & Sicherheit | Better Auth (Login, Session-Cookie) · Zod (Eingaben prüfen) · Data Access Layer (wer darf was sehen) |
| Daten | Drizzle ORM · PostgreSQL |

Jede Anfrage durchläuft fünf Stationen auf dem Server. Das Beispiel dafür ist [`src/app/api/offers/route.ts`](src/app/api/offers/route.ts):

```text
Browser ──▶ 1 Next.js Route ──▶ 2 Better Auth ──▶ 3 Zod ──▶ 4 Data Access Layer ──▶ 5 Drizzle ──SQL──▶ PostgreSQL
            (Einstieg)          (Gast/Mitglied?)  (gültig?)  (was darf er sehen?)    (sichere Abfrage)
```

Der Browser greift nie direkt auf die Datenbank zu.

## Lokal starten

Voraussetzungen: Node.js ≥ 20.9 ([`.nvmrc`](.nvmrc)) und PostgreSQL.

```bash
# 1. PostgreSQL installieren + Nutzer/Datenbank anlegen (einmal je Rechner, braucht sudo)
scripts/setup-postgres.sh

# 2. Abhängigkeiten + Umgebung
npm install
cp .env.example .env            # dann BETTER_AUTH_SECRET setzen: openssl rand -base64 32

# 3. Tabellen anlegen (aus src/server/db/*.ts)
npm run db:push

# 4. Starten
npm run dev                     # Entwicklung → http://localhost:3000
npm run build && npm start      # wie im Betrieb
```

Prüfen: <http://localhost:3000/api/health> antwortet `{"ok":true,"db":"up"}`.

## Wer arbeitet wo

| Bereich | Ordner | Team |
|---|---|---|
| Oberfläche (Seiten, Komponenten) | `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/components/` | Frontend |
| API (Route Handler) | `src/app/api/` | Backend |
| Login, Validierung, Zugriffsregeln | `src/server/` (`auth.ts`, `validation/`, `dal/`) | Backend |
| Datenmodell | `src/server/db/schema.ts` | Datenbank + Backend |

- Das Frontend holt Daten nur über `src/app/api/*` oder über Funktionen aus `src/server/dal/`, nie direkt aus `src/server/db/`.
- Gemeinsame Typen: Zod-Schemas in `src/server/validation/` liefern Prüfung und TypeScript-Typ zugleich.

## API (Stand jetzt)

| Methode + Pfad | Zweck |
|---|---|
| `GET /api/health` | Server + Datenbank erreichbar? |
| `GET /api/offers?materialId=&city=&limit=` | Angebote; Gast: Titel, Material, Menge, Stadt · Mitglied: zusätzlich Preis, Beschreibung, Kontakt |
| `POST /api/auth/sign-up/email` · `POST /api/auth/sign-in/email` · `POST /api/auth/sign-out` · `GET /api/auth/get-session` | Better Auth (Registrieren, Login, Logout, Session) |

Weitere Funktionen (Karte + Suche, Bedarf, Kooperation, Übersicht, Wirkung …) sind in [`docs/FUNKTIONEN.md`](docs/FUNKTIONEN.md) geplant; Endpunkte folgen, wenn die Funktion an der Reihe ist.

## Datenbank

- `src/server/db/schema.ts` bildet das ER-Diagramm vom 2026-11-18 ab (sites, users, materials, offers, agreements).
- `src/server/db/auth-schema.ts` erzeugt Better Auth (`npm run auth:schema`), nicht von Hand ändern.
- Steht die echte Datenbank, holt `npm run db:pull` deren Stand ins Projekt; Änderungen am Modell gehen über die DB-Verantwortlichen.

| Befehl | Wirkung |
|---|---|
| `npm run db:push` | Schema direkt in die lokale DB schreiben (Entwicklung) |
| `npm run db:pull` | Schema aus einer bestehenden DB lesen |
| `npm run db:generate` · `npm run db:migrate` | SQL-Migrationen erzeugen · ausführen |
| `npm run db:studio` | Datenbank im Browser ansehen |

### Offen (mit den DB-Verantwortlichen klären)

- **Login doppelt:** Better Auth braucht eigene Tabellen (`auth_users`, `auth_accounts` mit Passwort-Hash, `auth_sessions`). Die Tabelle `users` aus dem ER-Diagramm wird dadurch ersetzt oder angepasst.
- **Typen:** `DATETIME` gibt es in PostgreSQL nicht (hier `TIMESTAMP`). Preise als `FLOAT`/`INTEGER` → besser `NUMERIC`. CO₂-Faktoren als `INTEGER` → besser `NUMERIC`.
- **1:1 Standort–Login:** `users.site_id` ist im Diagramm nicht eindeutig (`UNIQUE` fehlt).
- **Status-Werte:** erlaubte Werte für `offers.status`, `users.account_status`; `agreements.status` → Vorschlag in [`docs/FUNKTIONEN.md`](docs/FUNKTIONEN.md#offene-db-fragen-für-die-db-verantwortlichen) (dort auch Bedarf, Benachrichtigungen, Verlauf).

## Prüfen vor dem Commit

```bash
npm run check    # TypeScript + Tests (vitest)
npm run build    # Produktions-Build
```
