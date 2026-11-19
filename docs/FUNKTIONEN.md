# Funktionen: Plan für die Umsetzung

Was die Plattform Betrieben bieten soll und was dafür in Datenmodell und Backend nötig ist. Grundlage: Ideen-Liste des Teams vom 2026-11-19 (6 Funktionen) und das Proposal (`CONTENT/KreiswertS_Proposal.pdf`). Weitere Funktionen kommen hinzu → Abschnitt „Neue Funktion aufnehmen“.

Stand 2026-11-19: Nur das Konzept und die Status-Abläufe ([`src/server/domain/status.ts`](../src/server/domain/status.ts)) sind vorbereitet. Endpunkte entstehen erst, wenn die Funktion an der Reihe ist.

## Überblick

| Nr | Funktion | Bis 10.01.2027 | Neu im Datenmodell nötig |
|---|---|---|---|
| 1 | Karte + Suche, Benachrichtigungen | ja | `alerts` (Suche merken) · `notifications` |
| 2 | Angebot + Bedarf, Begründung des Matches | ja | **Bedarf** (`requests` oder Typ-Spalte, offen) |
| 3 | Kooperation organisieren | ja | Spalten in `agreements` · `agreement_events` |
| 4 | Material-Tracking (Container) | nur vorsehen | `containers` · `container_events` |
| 5 | Netzwerk-Übersicht | ja | nichts, braucht aber Bedarf aus Nr 2 |
| 6 | Wirkung (Impact) | ja | nichts, nur Typ `numeric` für CO₂-Faktoren |

## Ein Muster für alle Abläufe

Kooperation (3) und Container (4) folgen demselben Muster, Übersicht (5) und Wirkung (6) lesen nur daraus:

```text
Datensatz mit status ──▶ Wechsel nur laut Flow (status.ts) ──▶ jeder Wechsel als Zeile im Verlauf (*_events)
                                                                   └──▶ Übersicht, Wirkung, Zeitstrahl in der UI
```

- **Status-Werte** stehen einmal in `status.ts` (klein, `snake_case`, ≤ 20 Zeichen) → DB, API, Tests und UI nutzen dieselben Werte.
- **Verlauf** (`*_events`: wer, wann, von → nach, Notiz) statt nur aktuellem Status → Zeitstrahl, Auswertungen, Nachvollziehbarkeit.
- **Wer darf welchen Wechsel** (Käufer/Verkäufer) prüft der Data Access Layer, nicht die Oberfläche.

## 1 Karte + Suche

- **Filter:** Materialart (`materials.id`/`category`), Menge, Entfernung, Verfügbarkeit (`offers.availableFrom`, `status`), Preis (nur für Mitglieder sichtbar).
- **Entfernung:** Haversine-Formel in SQL über `sites.latitude/longitude`. Für eine Region reicht das, PostGIS ist erst bei vielen Tausend Standorten nötig.
- **Benachrichtigung** („PE-Folie im Umkreis von 10 km“): Tabelle `alerts` (Standort, Material oder Kategorie, Umkreis km, Mindestmenge). Beim Anlegen eines Angebots wird geprüft, welche `alerts` passen → Eintrag in `notifications` (Anzeige in der App). E-Mail-Versand ist erst ein späterer Schritt.
- **Geplant:** `GET /api/offers?…&maxDistanceKm=&near=<siteId>` (Erweiterung) · `GET/POST/DELETE /api/alerts` · `GET /api/notifications`.

## 2 Angebot + Bedarf

- **Bedarf fehlt im Datenmodell** → mit den DB-Verantwortlichen klären (siehe „Offene DB-Fragen“).
- **Begründung des Matches** („Material passt · 7 km · Menge reicht“): reine Funktion `matchReasons(offer, request)` im Backend, ohne eigene Tabelle → einzeln testbar, Gründe erweiterbar.
- **„Material passt“:** zuerst gleiches Material oder gleiche Kategorie. Eine Verträglichkeits-Tabelle (z. B. PE-LD ↔ PE-HD) kommt nur dazu, wenn das Team sie fachlich liefert.

## 3 Kooperation

Status (in `status.ts`, Spalte `agreements.status`):

```text
requested ──▶ negotiation ──▶ agreed ──▶ in_progress ──▶ completed
    │              │             │            │
    └──────────────┴─▶ rejected  └────────────┴─▶ cancelled
```

- `rejected` = Anfrage abgelehnt (nur vor der Einigung) · `cancelled` = abgebrochen (bis zum Abschluss) → Übersicht und Wirkung zählen nur `completed`.
- **Vorhanden:** Menge, Preis, `buyerConfirmedAt`/`sellerConfirmedAt` (beide gesetzt → `agreed`), `actualQuantityKg`, `completedAt`.
- **Fehlt:** Abholtermin (`pickup_date`), Materialqualität (`quality_notes`, später evtl. Klassen) · Verlauf `agreement_events`, auch für Gegenangebote in der Verhandlung.

## 4 Material-Tracking (vorgesehen, nicht im Prototyp)

```text
collected ──▶ sorting ──▶ processing ──▶ available ──▶ reserved ──▶ delivered ──▶ reused
```

- Tabellen `containers` (Kennung, Material, Menge, Standort, optional `agreement_id`) + `container_events` (Status-Wechsel mit Ort und Zeit).
- Umsetzung später: Flow in `status.ts` ergänzen, Tabellen anlegen; der Rest folgt dem Muster oben.
- Im Prototyp höchstens als einfache Status-Liste einer Kooperation.

## 5 Netzwerk-Übersicht

Nur Abfragen, keine neuen Tabellen: aktive Angebote und Bedarfe · ungematchte Materialien (Angebot/Bedarf ohne offene Kooperation) · am meisten gesuchte Materialien (Bedarfe + `alerts` je Material).

## 6 Wirkung

- Wiederverwendete Menge = Summe `actualQuantityKg` aller `completed` · vermiedene Entsorgung = dieselbe Menge (Annahme, im Bericht als solche kennzeichnen) · CO₂ = Menge × `impactFactorUsed`.
- Filter nach Jahr über `completedAt`; der Faktor wird beim Abschluss festgeschrieben, spätere Katalogänderungen ändern alte Werte nicht.

## Offene DB-Fragen (für die DB-Verantwortlichen)

Ergänzt die Liste in der [README](../README.md#offen-mit-den-db-verantwortlichen-klären):

1. **Bedarf:** eigene Tabelle `requests` (Standort, Material, Menge, Zeitraum, Höchstpreis, Status) oder eine Tabelle `listings` mit `type = offer/request`? Empfehlung: eigene Tabelle, weil getrennte Felder und einfacheres Matchen und Zählen.
2. **Status-Werte** von `agreements.status` wie oben (7 Werte) → als `CHECK`-Regel oder PostgreSQL-`ENUM` festschreiben.
3. **`agreements`:** Spalten `pickup_date`, `quality_notes`; Tabelle `agreement_events` für den Verlauf.
4. **`alerts`** + **`notifications`** für Benachrichtigungen.
5. **Typen:** `impact_factor_*` und `agreed_price_eur_per_kg` als `NUMERIC` (heute `INTEGER`; 0,4 €/kg ginge verloren).
6. **Später:** `containers` + `container_events` (Nr 4).

## Neue Funktion aufnehmen

1. Zeile in „Überblick“ + kurzer Abschnitt hier (Was, Daten, Logik, offen).
2. Hat sie einen Ablauf → Flow in `status.ts` + Test; braucht sie Daten → Punkt unter „Offene DB-Fragen“.
3. Umsetzung nach dem Muster in [`src/app/api/offers/route.ts`](../src/app/api/offers/route.ts): Route → Login → Zod → Data Access Layer → Drizzle.
