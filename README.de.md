[English](README.md) · **Deutsch**

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

Voraussetzungen: Node.js ≥ 20.9 ([`.nvmrc`](.nvmrc)) und PostgreSQL 17. Läuft gleich auf Linux, macOS und Windows; nur Schritt 1 unterscheidet sich.

```bash
# 1. PostgreSQL installieren, starten + Nutzer/Datenbank anlegen (einmal je Rechner)
scripts/setup-postgres.sh       # Linux (apt, braucht sudo) · macOS (Homebrew)
# Windows (PowerShell als Administrator, winget):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-postgres.ps1

# 2. Abhängigkeiten + Umgebung
npm install
cp .env.example .env            # dann BETTER_AUTH_SECRET setzen: openssl rand -base64 32 (Windows: copy)

# 3. Tabellen anlegen (aus src/server/db/*.ts)
npm run db:push

# 4. Starten
npm run dev                     # Entwicklung → http://localhost:3000
npm run build && npm start      # wie im Betrieb
```

Prüfen: <http://localhost:3000/api/health> antwortet `{"ok":true,"db":"up"}`.

Login ausprobieren: Startseite → „Konto erstellen“ (`/register`) → „Einloggen“ (`/login`) → `/account`. Startseite, Login und Registrieren sind nach Figma gebaut (DE/EN-Schalter im Kopf, Sprache im Cookie `locale`); `/account` ist noch eine Testseite ohne Design. Die Registrierung fragt Firmenname, USt-IdNr., Material-Interesse, Benutzername, geschäftliche E-Mail und Passwort ab (mind. 8 Zeichen mit Zahl und Großbuchstabe); einloggen geht mit Benutzername oder E-Mail. Login geht nur über `http://localhost:3000` (Better Auth prüft die Herkunft gegen `BETTER_AUTH_URL`).

## Wer arbeitet wo

| Bereich | Ordner | Team |
|---|---|---|
| Oberfläche (Seiten, Komponenten, Texte DE/EN) | `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/components/`, `src/i18n/` | Frontend (Startseite + Login: Backend auf Wunsch von MK, 2026-11-25) |
| API (Route Handler) | `src/app/api/` | Backend |
| Login, Validierung, Zugriffsregeln | `src/server/` (`auth.ts`, `validation/`, `dal/`) | Backend |
| Datenmodell | `src/server/db/schema.ts` | Datenbank + Backend |

- Das Frontend holt Daten nur über `src/app/api/*` oder über Funktionen aus `src/server/dal/`, nie direkt aus `src/server/db/`.
- Gemeinsame Typen: Zod-Schemas in `src/server/validation/` liefern Prüfung und TypeScript-Typ zugleich.
- **Frontend-Team:** Leitfaden auf Englisch (Einstieg, Daten holen, Login, Gast/Mitglied, DE/EN, Styling) → [`docs/FRONTEND.md`](docs/FRONTEND.md).
- **Architektur auf einen Blick:** Schichten, Stand aller Funktionen, Komponenten, Weg einer Anfrage, API je Funktion, Server-Funktionen, Datenbank, Werkzeuge → [`docs/architecture.html`](docs/architecture.html) (Deutsch: [`docs/architecture.de.html`](docs/architecture.de.html), Bild: [`docs/architecture.png`](docs/architecture.png)); nach Änderungen beide neu bauen: `python3 scripts/architecture/make.py`.

## API (Stand jetzt)

| Methode + Pfad | Zweck |
|---|---|
| `GET /api/health` | Server + Datenbank erreichbar? |
| `GET /api/offers?materialId=&city=&limit=` | Angebote; Gast: Titel, Material, Menge, Stadt · Mitglied: zusätzlich Preis, Beschreibung, Kontakt |
| `POST /api/auth/sign-up/email` · `POST /api/auth/sign-in/email` · `POST /api/auth/sign-out` · `GET /api/auth/get-session` | Better Auth (Registrieren, Login, Logout, Session) |

Seiten dazu: `/login` und `/register` (nach Figma; der Server prüft die Felder der Registrierung in [`src/server/validation/registration.ts`](src/server/validation/registration.ts)) sowie die Testseite `/account` – Fehler von Better Auth erscheinen als Satz auf Deutsch oder Englisch ([`src/lib/auth-errors.ts`](src/lib/auth-errors.ts)). Kennzahlen der Startseite (Betriebe, Angebote) liefert `getPlatformStats()` in [`src/server/dal/stats.ts`](src/server/dal/stats.ts).

Weitere Funktionen (Karte + Suche, Bedarf, Kooperation, Übersicht, Wirkung …) sind in [`docs/FEATURES.md`](docs/FEATURES.md) geplant; Endpunkte folgen, wenn die Funktion an der Reihe ist.

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
- **Login vor echten Daten:** Registrierung ist offen, jede Session gilt sofort als Mitglied und sieht Kontaktdaten; die Registrierung verrät, ob eine E-Mail schon existiert (422). Vorschlag: E-Mail-Bestätigung + Freischaltung (`approved`) in `src/server/auth.ts`/`viewer.ts`; im Betrieb `next start` nur hinter einem Proxy, der `X-Forwarded-For` setzt (sonst greift das Rate-Limit nicht).
- **Status-Werte:** erlaubte Werte für `offers.status`, `users.account_status`; `agreements.status` → Vorschlag in [`docs/FEATURES.md`](docs/FEATURES.md#offene-db-fragen-für-die-db-verantwortlichen) (dort auch Bedarf, Benachrichtigungen, Verlauf).

## Prüfen vor dem Commit

```bash
npm run check    # TypeScript + Tests (vitest)
npm run build    # Produktions-Build
```
