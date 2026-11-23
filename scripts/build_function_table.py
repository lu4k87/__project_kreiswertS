"""Funktionsliste der Plattform als Word-Tabelle → CONTENT/Funktionen_KreiswertS.docx (de) und
CONTENT/Functions_KreiswertS_EN.docx (en, Inhalt in scripts/function_table_en.py) – für Google Docs.

In Google Drive hochladen → „Mit Google Docs öffnen“; Tabellen, Überschriften und Querformat bleiben erhalten.
Inhalt: Funktionsvergleich vom 2026-11-23 (eigener Stand, geplante Funktionen aus docs/FUNKTIONEN.md, Vorschläge
aus dem Vergleich mit anderen Plattformen).

    python3 scripts/build_function_table.py   # braucht soffice (LibreOffice)
"""
import html
import re
import shutil
import subprocess
import tempfile
import sys
import zipfile
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
OUT_NAME = "Funktionen_KreiswertS.docx"
TITLE = "KreiswertS – Funktionen der Plattform"
INTRO = ("Stand 23.11.2026 · bisherige, geplante und neue Funktionen, gruppiert nach Bereich. "
         "Seitenpfade sind Vorschläge; die Seiten legt das Frontend-Team nach Figma fest.")
HEAD_LEGEND = ["Stand", "Bedeutung"]

HEAD = ["Nr", "Funktion", "Was sie macht", "Wo in der App", "Wo im Code", "Stand", "Vorbild", "Beantwortet Fragen"]
HEAD_NOT = ["Nr", "Funktion", "Was sie macht", "Wo sie später hinge", "Grund", "Beantwortet Fragen"]

# Gruppe → Zeilen (Nr, Funktion, Was sie macht, Wo in der App, Wo im Code, Stand, Vorbild)
GROUPS = [
    ("A · Konto & Zugang", [
        (1, "Registrieren, Anmelden, Konto", "Betrieb legt ein Konto mit E-Mail und Passwort an, meldet sich an und ab. Die Konto-Seite zeigt, wer angemeldet ist.", "Seiten `/registrieren`, `/login`, `/konto` (bisher Testseiten)", "`server/auth.ts`, `/api/auth/*`", "fertig", "–"),
        (2, "Freischaltung der Firma", "Neues Konto steht zuerst auf „wartet“. Erst nach Prüfung sieht es Preise und Kontakte und darf Inserate einstellen → Schutz vor Fake-Konten.", "Hinweis nach dem Registrieren, Banner in `/konto` „wartet auf Prüfung“", "`server/viewer.ts`, Spalte `account_status`", "neu · Stufe 1", "Sfridoo, Orbio"),
        (3, "Konto löschen + Datenauskunft", "Betrieb löscht sein Konto oder lädt alle über ihn gespeicherten Daten herunter. Pflicht, sobald echte Daten drin sind.", "`/konto` → Abschnitt „Daten & Konto“", "Better Auth `deleteUser`, Export im Data Access Layer", "neu · Stufe 2", "eigener Vorschlag"),
    ]),
    ("B · Firmen", [
        (4, "Firmenprofil", "Eigene Seite je Betrieb: Name, Branche, Standort, was er abgibt und sucht. Kontaktdaten nur für Mitglieder.", "Seite `/firmen/[id]`, bearbeiten unter `/konto/firma`", "`GET`/`PATCH /api/sites/:id`, neu `dal/sites.ts`", "neu · Stufe 1", "Cyrkl, Proposal"),
        (5, "Firmenverzeichnis", "Liste aller Betriebe der Region, auch ohne aktuelles Inserat, filterbar nach Branche und Ort. Proposal: mindestens 10 Firmen.", "Seite `/firmen`", "`GET /api/sites`", "neu · Stufe 1", "Cyrkl"),
        (42, "Meine Partner + Firmen folgen", "Betrieb merkt sich Firmen und sieht sie getrennt als Abnehmer, Lieferanten und Gemerkte. Neue Inserate und Änderungen der Partner erscheinen als Hinweis.", "`/konto/partner`: 3 Listen, Knopf „Folgen“ im Firmenprofil", "Neue Tabelle `follows` (DB-Frage), `GET /api/partners`", "neu · Stufe 2", "Fragenkatalog"),
    ]),
    ("C · Inserate (Angebot + Bedarf)", [
        (6, "Angebote ansehen", "Liste der Kunststoff-Angebote. Gast: Titel, Material, Menge, Stadt · Mitglied: zusätzlich Preis, Beschreibung, Kontakt.", "Startseite bzw. `/angebote`, Detail `/angebote/[id]`", "`GET /api/offers`, `dal/offer-view.ts`", "fertig", "–"),
        (7, "Angebot einstellen", "Mitglied legt ein neues Angebot an, ändert es oder zieht es zurück.", "Formular `/inserat/neu`, „Meine Inserate“ unter `/konto/inserate`", "`POST`/`PATCH /api/offers`, `validation/offers.ts`", "neu · Stufe 1", "alle"),
        (8, "Bedarf einstellen", "Betrieb stellt ein, was er sucht: Material, Menge, Zeitraum, Höchstpreis. Ohne Bedarf kein Matching.", "Dasselbe Formular, Umschalter „Ich biete / Ich suche“", "Neue Tabelle für Bedarf (DB-Frage), `/api/requests`", "geplant", "Cyrkl, plasticker, IHK"),
        (9, "Materialpass", "Inserat beschreibt den Kunststoff genau: Form (Mahlgut, Granulat, Folie, Ballen), Farbe, Reinheit, Herkunft, Datenblatt → Abnehmer erkennt ohne Rückfrage, ob er es verarbeiten kann.", "Formular-Abschnitt „Material“, Detailseite Block „Materialpass“", "Spalten in `offers` + Bedarf, Zod-Schema", "neu · Stufe 1", "plasticker, Excess Materials Exchange"),
        (10, "Regelmäßiger Stoffstrom", "Einmalig oder laufend, z. B. „500 kg je Monat“. Laufende Mengen sind planbar → Dauer-Kooperation.", "Formularfeld „einmalig / je Woche / je Monat“, Kennzeichen „laufend“ in der Liste", "Spalte `frequency`", "neu · Stufe 1", "SHAREBOX"),
        (11, "Nebenprodukt oder Abfall", "Anbieter gibt an, ob das Material rechtlich Nebenprodukt oder Abfall ist, bei Abfall mit Abfallschlüssel → Abnehmer sieht, ob er es annehmen darf.", "Auswahl im Formular, Hinweis auf der Detailseite (keine Rechtsberatung)", "2 Spalten in `offers`", "neu · Stufe 1", "Sfridoo, empto"),
        (12, "Inserat läuft ab", "Entwurf, aktiv, reserviert, geschlossen oder abgelaufen. Ohne Verlängerung läuft es nach z. B. 60 Tagen ab → keine veralteten Einträge.", "`/konto/inserate`: Status je Inserat, Knopf „verlängern“", "Neuer Ablauf in `domain/status.ts` + Test", "neu · Stufe 1", "eigener Vorschlag"),
        (13, "Sichtbarkeit je Inserat", "Öffentlich, nur Mitglieder oder anonym bis zur angenommenen Anfrage → Wettbewerber sehen nicht, wo welche Reste anfallen.", "Auswahl im Formular, Detailseite „Firma verdeckt“", "Spalte `visibility`, Regel in `dal/offer-view.ts`", "neu · Stufe 2", "Rheaply"),
        (41, "Frist im Inserat", "Anbieter gibt an, bis wann das Material weg sein muss, z. B. „abholen bis 15.01.“. Dringende Inserate sind markiert und lassen sich nach Frist sortieren.", "Formularfeld „verfügbar bis“, Kennzeichen „dringend“ in Liste und Karte", "Spalte `available_until` in `offers`, Sortierung in `dal/offers.ts`", "neu · Stufe 1", "Fragenkatalog"),
        (43, "Statistik zum Inserat", "Zeigt je Inserat, wie oft es angesehen, gemerkt und angefragt wurde → Betrieb sieht, ob sein Inserat ankommt.", "`/konto/inserate`: Zahlen je Inserat", "Zähler je Inserat (DB-Frage), Anfragen aus `agreements`", "neu · Stufe 2", "Fragenkatalog"),
    ]),
    ("D · Suchen & Finden", [
        (14, "Karte", "Betriebe und Angebote als Punkte auf einer Karte, Klick öffnet Firma oder Angebot.", "Startseite oben, ganze Seite `/karte`", "`sites.latitude`/`longitude`, Daten über `/api/sites`", "geplant", "Proposal"),
        (15, "Suche nach Entfernung", "Nur Treffer im Umkreis, z. B. 10 km vom eigenen Standort.", "Filterleiste über Liste und Karte", "`maxDistanceKm` + `near`, Haversine in `dal/offers.ts`", "geplant", "Cyrkl"),
        (16, "Mehr Suchfilter", "Zusätzlich eingrenzen nach Form, Farbe, Menge von–bis, Höchstpreis, Einstelldatum.", "Filterleiste, Knopf „Mehr Filter“", "Zod-Schema + `dal/offers.ts`", "neu · Stufe 1", "Cyrkl, plasticker"),
        (17, "Passende Treffer mit Begründung", "Plattform schlägt passende Angebot-Bedarf-Paare vor und sagt warum: „Material passt · 7 km · Menge reicht“.", "Detailseite Block „Passt zu“, Übersicht `/konto/treffer`", "Funktion `matchReasons()` in `domain/`, `GET /api/matches`", "geplant", "Sfridoo, Orbio"),
        (18, "Karte mit Verbindungslinien", "Linien zwischen Betrieben, deren Angebot und Bedarf zusammenpassen; 3 durchgespielte Beispiel-Fälle als gekennzeichnete Demo-Daten.", "Karte: Ebene „Verbindungen“ einschaltbar, Auswahl „Szenario 1–3“", "`GET /api/network/links`, nutzt Nr 17", "neu · Stufe 1", "Proposal"),
        (19, "Suche merken + Hinweis in der App", "Suche speichern, z. B. „PE-Folie im Umkreis von 10 km“ → Hinweis, sobald etwas Passendes eingestellt wird.", "Knopf „Suche merken“ in der Filterleiste, Glocke in der Kopfzeile", "Tabellen `alerts` + `notifications`, Prüfung beim Anlegen eines Angebots", "geplant", "Rheaply"),
        (20, "E-Mail zur gemerkten Suche", "Hinweis aus Nr 19 zusätzlich per E-Mail.", "`/konto` → „Benachrichtigungen“ an/aus", "Mailversand, baut auf `notifications`", "neu · Stufe 2", "Rheaply"),
    ]),
    ("E · Kooperation", [
        (21, "Fester Ablauf", "Angefragt → Verhandlung → einig → läuft → abgeschlossen, dazu abgelehnt und abgebrochen; unsinnige Sprünge gesperrt.", "Statusleiste im Kooperations-Detail", "`domain/status.ts`", "fertig (nur Regeln)", "–"),
        (22, "Anfrage mit Nachricht", "Interessent fragt ein Angebot an, mit Wunschmenge und kurzer Nachricht.", "Knopf „Anfragen“ auf der Angebot-Detailseite → Dialog", "`POST /api/agreements`, erster Eintrag in `agreement_events`", "neu · Stufe 1", "Rheaply, Orbio"),
        (23, "Kooperation verwalten", "Beide Seiten sehen alle laufenden Kooperationen, verhandeln per Gegenangebot, bestätigen die Einigung; jeder Schritt mit Datum im Verlauf.", "`/konto/kooperationen`: Liste + Detail mit Zeitstrahl, Knöpfe „Annehmen / Ablehnen / Gegenangebot / Bestätigen“", "`PATCH /api/agreements/:id`, Prüfung mit `canTransition`, `agreement_events`", "geplant", "cirplus, empto"),
        (24, "Probe anfragen", "Vor der Einigung eine kleine Materialprobe anfordern; Anfrage und Ergebnis im Verlauf.", "Knopf im Kooperations-Detail, nur bis zur Einigung", "Ereignis `sample_requested`", "neu · Stufe 2", "cirplus, Orbio"),
        (25, "Abholtermin + Übergabe-Nachweis", "Termin vereinbaren; nach der Abholung bestätigen beide die tatsächliche Menge → Beleg und Grundlage für Nr 28.", "Kooperations-Detail, Abschnitt „Abholung“", "`pickup_date` (DB-Frage), `actualQuantityKg`, Bestätigungs-Felder", "neu · Stufe 2", "Resourcify"),
        (26, "Material-Tracking (Container)", "Weg einer Charge: gesammelt → sortiert → verarbeitet → geliefert → wiederverwendet.", "Kooperations-Detail, Zeitstrahl der Charge", "Tabellen `containers` + `container_events`", "geplant (nur vorsehen)", "cirplus"),
        (44, "Dokumente + Zahlungsstatus", "Vertrag, Lieferschein, Rechnung und Prüfzeugnis an der Kooperation ablegen. Zahlung von Hand als offen oder bezahlt markieren – ohne Zahlungsabwicklung.", "Kooperations-Detail, Abschnitt „Dokumente“", "Tabelle `agreement_documents` + Dateiablage (DB-Frage), Spalte `payment_status`", "neu · Stufe 2", "Fragenkatalog"),
        (45, "Problem melden", "Verzug, Transportschaden oder falsche Qualität an der Kooperation melden; Meldung und Klärung stehen im Verlauf.", "Knopf „Problem melden“ im Kooperations-Detail", "Ereignis `issue_reported` in `agreement_events`", "neu · Stufe 2", "Fragenkatalog"),
    ]),
    ("F · Auswertung & Wirkung", [
        (27, "Netzwerk-Übersicht", "Kennzahlen der Region: aktive Angebote und Bedarfe, Material ohne Abnehmer, meistgesuchte Materialien. Für Stadt und Wirtschaftsförderung.", "Öffentliche Seite `/uebersicht`: Kennzahl-Kacheln + Rangliste", "`GET /api/network/stats` (nur Abfragen)", "geplant", "SYNERGie"),
        (28, "Wirkung", "Wiederverwendete Kilo, vermiedene Entsorgung, eingespartes CO₂, je Jahr.", "`/uebersicht`, Abschnitt „Wirkung“ mit Jahresauswahl", "`GET /api/impact`, zählt nur abgeschlossene Kooperationen", "geplant", "Rheaply, Excess Materials Exchange"),
        (29, "Wirkungsbericht je Firma", "Betrieb lädt seinen Jahresbericht herunter: Kilo, CO₂, Zahl der Kooperationen – für den eigenen Nachhaltigkeitsbericht.", "`/konto/wirkung`, Knopf „Als CSV/PDF“", "`GET /api/impact?siteId=&year=`", "neu · Stufe 2", "Rheaply"),
        (30, "Einsparrechner", "Besucher gibt Material und Menge ein → Schätzung: gesparte Entsorgung, möglicher Erlös, vermiedenes CO₂. Anreiz zum Mitmachen.", "Öffentliche Seite `/rechner`, Link von der Startseite", "Reine Funktion in `domain/`, CO₂-Faktor aus `materials`", "neu · Stufe 2", "Cyrkl"),
    ]),
    ("G · Betrieb & Verwaltung", [
        (31, "Systemprüfung", "Meldet, ob Server und Datenbank laufen.", "Keine Seite", "`GET /api/health`", "fertig", "–"),
        (32, "Verwaltungsbereich", "Für die Betreiber: Konten freischalten und sperren (Nr 2), Materialkatalog pflegen, unpassende Inserate entfernen.", "Bereich `/admin`, nur Rolle Admin", "Rolle `admin`, Routen `/api/admin/*`", "neu · Stufe 2", "SYNERGie, Sfridoo"),
        (33, "Zweisprachig DE/EN", "Oberfläche zwischen Deutsch und Englisch umschaltbar.", "Sprachumschalter in der Kopfzeile", "API liefert Codes, Texte übersetzt das Frontend", "neu · Stufe 2", "eigener Vorschlag"),
        (34, "Import/Export + Handbuch", "Firmen und Materialien aus einer Tabelle einlesen und ausgeben → andere Region setzt die Plattform mit eigenen Daten auf.", "Keine Seite (Skript), Handbuch in `docs/`", "Skript in `scripts/`", "neu · Stufe 2", "Proposal"),
        (46, "Leitfaden-Seite", "Kurze Erklärseite: rechtliche Pflichten beider Seiten, Nebenprodukt oder Abfall, Ablauf einer Kooperation – mit Links zu den Quellen, keine Rechtsberatung.", "Öffentliche Seite `/leitfaden`, Link in der Fußzeile", "Statische Seite (Frontend), kein Backend", "neu · Stufe 1", "Fragenkatalog"),
    ]),
]

# Gruppe H: (Nr, Funktion, Was sie macht, Wo sie später hinge, Grund)
NOT_NOW = ("H · Bewusst nicht im Prototyp", [
    (35, "Zahlung + Transport-Vermittlung", "Bezahlen und Spedition direkt über die Plattform buchen.", "Kooperations-Detail", "Hoher Aufwand; cirplus bot das an und hat den Betrieb eingestellt"),
    (36, "Auktionen, Provision", "Material geht an den Höchstbietenden, Plattform verdient mit.", "Angebot-Detail", "Proposal: kein operativer Marktplatz"),
    (37, "KI-Inseratvorschlag, lernendes Matching", "KI füllt Inserate vor und lernt aus Abschlüssen, welche Paare passen.", "Formular, Nr 17", "Braucht viele echte Daten"),
    (38, "Preisspiegel", "Übliche Preise je Kunststoffart im Zeitverlauf.", "`/uebersicht`", "Erst ab vielen Inseraten aussagekräftig"),
    (39, "Labor, Zertifikate", "Materialprüfung und Gütesiegel durch die Plattform.", "Materialpass (Nr 9)", "Fachlich außerhalb des Projekts"),
    (40, "Bewertungen der Firmen", "Sterne oder Kommentare nach einer Kooperation.", "Firmenprofil (Nr 4)", "In kleinem regionalem Netz heikel"),
])

LEGEND = [
    ("fertig", "steht im Code"),
    ("geplant", "steht schon in docs/FUNKTIONEN.md"),
    ("neu · Stufe 1", "passt bis 10.01.2027 in den Prototyp"),
    ("neu · Stufe 2", "danach oder wenn Zeit bleibt"),
]
INTRO2 = ("Spalte „Beantwortet Fragen“: Abgleich mit dem Fragenkatalog des Teams vom 23.11.2026 "
          "(A1–A49 = Anbieter, B1–B45 = Abnehmer). Nr 41–46 sind aus diesem Abgleich neu entstanden.")
COMPARE_TITLE = "Abgleich mit dem Fragenkatalog"
COMPARE_INTRO = ("Der Fragenkatalog enthält 94 Fragen: 49 aus Sicht des Anbieters (A) und 45 aus Sicht des Abnehmers (B). "
                 "Jede Frage ist der Funktion zugeordnet, die sie beantwortet.")
SUMMARY_HEAD = ["Ergebnis", "Anzahl", "Fragen"]
SUMMARY_LABELS = ["Beantwortet durch Funktionen der Gruppen A–G", "Nur durch Gruppe H beantwortet (nicht im Prototyp)",
                  "Keine Plattform-Funktion (Entscheidung im Betrieb)"]
OPEN_TITLE = "Fragen ohne Funktion im Prototyp"
OPEN_HEAD = ["Frage", "Wortlaut", "Einordnung"]
QUESTION_NOTES = {
    "A1": ("Warum will ich meinen Abfall loswerden?", "Motivation des Betriebs → Stoff für das Problem Statement, keine Funktion."),
    "A2": ("Was passiert, wenn ich meinen Abfall nicht entsorge?", "Motivation des Betriebs → Stoff für das Problem Statement, keine Funktion."),
    "A10": ("Wie stelle ich sicher, dass die Zahlung möglichst schnell auf meinem Konto ist?", "Zahlungsabwicklung (Nr 35) ist nicht im Prototyp; Nr 44 zeigt nur, ob bezahlt ist."),
    "A12": ("Will ich weitere Partner für die Entsorgung?", "Entscheidung des Betriebs; das Firmenverzeichnis (Nr 5) zeigt die Auswahl."),
    "A19": ("Wie verringere ich den Abfall in meiner Produktion?", "Abfallvermeidung ist Beratung, außerhalb der Plattform (Cyrkl bietet das als Beratung an)."),
    "A31": ("Wie erfahre ich, welchen Preis andere Firmen für meinen Abfall zahlen würden?", "Preisspiegel (Nr 38) und Auktion (Nr 36) sind nicht im Prototyp; Anfragen und Gegenangebote (Nr 23) zeigen die Zahlungsbereitschaft."),
    "A36": ("Wie finde ich einen passenden Transporteur?", "Transport-Vermittlung (Nr 35) ist nicht im Prototyp; Nr 25 hält fest, wer abholt."),
    "A40": ("Welche Zahlungsarten gibt es?", "Zahlung läuft außerhalb der Plattform (Nr 35 nicht im Prototyp)."),
    "A41": ("Wie verringere ich das finanzielle Risiko beim Verkauf?", "Absicherung der Zahlung (Nr 35) fehlt; der Prototyp senkt das Risiko nur über Freischaltung (Nr 2) und Nachweise (Nr 25, 44)."),
    "B2": ("Wie sehe ich die Preisentwicklung für mein Material?", "Preisspiegel (Nr 38) ist erst ab vielen Inseraten aussagekräftig."),
    "B17": ("Wie stelle ich fest, ob ich Material überhaupt zukaufen muss?", "Entscheidung des Betriebs; der Einsparrechner (Nr 30) hilft bei der Abwägung."),
    "B29": ("Wie erkenne ich, ob der verlangte Preis angemessen ist?", "Preisspiegel (Nr 38) ist nicht im Prototyp; Preise mehrerer Angebote lassen sich vergleichen (Nr 6, 16)."),
}
SOURCES_TITLE = "Quellen"
SOURCES_INTRO = "Alle Links am 23.11.2026 geprüft (erreichbar)."
SOURCES_HEAD = ["Quelle", "Link"]
SOURCE_LABELS = ["Cyrkl – Marktplatz", "Cyrkl – Fallstudie (Circle Economy)", "Sfridoo – So funktioniert es", "Orbio – EU-Plattform Kreislaufwirtschaft",
                 "plasticker – Rohstoffbörse", "plastship – Materialsuche", "cirplus – Hinweis zur Liquidation", "cirplus – Abschlussbericht DBU",
                 "IHK-Recyclingbörse", "Rheaply – Funktionen", "Excess Materials Exchange – Profil", "SHAREBOX / SYNERGie – EU-Projekt (CORDIS)",
                 "Resourcify – Bericht der KfW", "empto – Handwerksblatt", "Studie „Digital Platforms for Industrial Symbiosis“ (2022)",
                 "Handlungshilfe Nebenprodukt-Status (NRW)", "Kreislaufwirtschaftsgesetz § 4 Nebenprodukte"]

# Abgleich mit dem Fragenkatalog des Teams: Funktion → Fragen (A = Anbieter, B = Abnehmer); gilt für beide Sprachen
COVERS = {
    2: "A35, A48", 4: "A14, A48, B38", 5: "A4, A45, B3, B27, B32", 6: "B3, B25, B35", 7: "A20",
    8: "A16, A28, B1, B14, B18, B33", 9: "A22, A27, A29, B13, B16, B21, B23, B42, B43, B44",
    10: "A11, A23, A24, B19, B24", 11: "A33, B13", 12: "B36", 14: "A46, A47, B4", 15: "A38, A47, B4, B39",
    16: "B25, B26", 17: "A4, A5, A28, A29, B20, B24, B28", 18: "A44, B37", 19: "A16, A43, B5, B31, B36",
    20: "B5, B31", 21: "A6, A34", 22: "A49, B7, B32", 23: "A6, A8, A30, A32, A34, B8, B9, B34",
    24: "A27, B42, B44", 25: "A7, A37, B10, B40", 26: "A39, B11", 27: "A16, A26, B31", 28: "A18",
    29: "A15, A18", 30: "A17, A18, A25, B22, B30",
    35: "A9, A10, A36, A38, A40, A41, B39, B41", 36: "A31, A32", 37: "B20, B28", 38: "A31, B2, B29, B30",
    39: "A27, B42, B43, B44", 40: "A14, A35, A48, B38",
    41: "A3", 42: "A11, A13, A43, A44, B5, B6, B35, B36, B37", 43: "A21, B15", 44: "A9, A42, B43",
    45: "A34, B12, B41, B45", 46: "A33",
}
ALL_QUESTIONS = [f"A{i}" for i in range(1, 50)] + [f"B{i}" for i in range(1, 46)]
SOURCE_URLS = [  # gleiche Reihenfolge wie SOURCE_LABELS
    "https://www.cyrkl.com/en/marketplace",
    "https://circle-economy.com/knowledge-hub/article/16280",
    "https://www.sfridoo.com/en/how-it-works/",
    "https://circulareconomy.europa.eu/platform/en/good-practices/orbio-digital-marketplace-enabling-industrial-symbiosis",
    "https://plasticker.de/recybase/listaog.php",
    "https://plastship.com/material-search/",
    "https://www.cirplus.com/",
    "https://opac.dbu.de/ab/DBU-Abschlussbericht-AZ-35500_87-Hauptbericht.pdf",
    "https://www.ihk.de/giessen-friedberg/geschaeftsbereiche/innovation/umwelt/kreislaufwirtschaft/recyclingboerse-ihk-3148746",
    "https://rheaply.com/features/",
    "https://www.third-derivative.org/portfolio/excess-materials-exchange",
    "https://cordis.europa.eu/project/id/680843",
    "https://www.kfw.de/stories/wirtschaft/innovation/resourcify/",
    "https://www.handwerksblatt.de/themen-specials/gruendernavi-fuer-gruender/ihr-digitaler-abfallassistent",
    "https://research-portal.uu.nl/en/publications/digital-platforms-for-industrial-symbiosis/",
    "https://umwelt.nrw.de/system/files/media/document/file/2023-01-30_handlungshilfe-zur-behordlichen-prufung-des-abfallrechtlichen-nebenproduktstatus.pdf",
    "https://www.gesetze-im-internet.de/krwg/__4.html",
]

WIDTHS = [3, 12, 26, 16, 15, 7, 8, 13]  # Prozent je Spalte
WIDTHS_NOT = [3, 16, 28, 15, 22, 16]


def cell(value) -> str:
    """Text escapen, `code` als Festbreitenschrift."""
    text = re.sub(r"`([^`]+)`", r'<font face="Consolas">\1</font>', html.escape(str(value)))
    return re.sub(r"^(https://\S+)$", r'<a href="\1">\1</a>', text)


def table(head, rows, widths, bold=2) -> str:
    """bold = Anzahl der ersten Spalten in Fettschrift (Nr + Funktion)."""
    th = "".join(f'<th bgcolor="#e8eef3" align="left" width="{w}%">{h}</th>' for h, w in zip(head, widths))
    body = "".join(
        "<tr>" + "".join(f'<td valign="top" width="{w}%">{"<b>" + cell(v) + "</b>" if i < bold else cell(v)}</td>'
                         for i, (v, w) in enumerate(zip(r, widths))) + "</tr>"
        for r in rows)
    return (f'<table width="100%" border="1" cellspacing="0" cellpadding="3">'
            f"<thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>")


def question_sets(t):
    """(in Gruppen A–G beantwortet, nur Gruppe H, ohne Funktion) – jeweils sortierte Fragen-Kürzel."""
    def of(rows):
        return {q for r in rows for q in COVERS.get(r[0], "").split(", ") if q}
    scope = of([r for _, rows in t.GROUPS for r in rows])
    later = of(t.NOT_NOW[1]) - scope
    none = set(ALL_QUESTIONS) - scope - later
    assert scope | later <= set(ALL_QUESTIONS), "unbekanntes Fragen-Kürzel in COVERS"
    assert later | none == set(t.QUESTION_NOTES), f"QUESTION_NOTES passt nicht: {sorted((later | none) ^ set(t.QUESTION_NOTES))}"
    return [[q for q in ALL_QUESTIONS if q in part] for part in (scope, later, none)]


def build_html(t) -> str:
    """t = Sprachinhalt (TITLE, INTRO, HEAD, GROUPS, NOT_NOW, QUESTION_NOTES, SOURCE_LABELS …)."""
    with_q = lambda rows: [r + (COVERS.get(r[0], "–"),) for r in rows]
    parts = [f"<h1>{t.TITLE}</h1>", f"<p>{t.INTRO}</p>", f"<p>{t.INTRO2}</p>",
             table(t.HEAD_LEGEND, t.LEGEND, [20, 80], bold=1)]
    for title, rows in t.GROUPS:
        parts += [f"<h2>{title}</h2>", table(t.HEAD, with_q(rows), WIDTHS)]
    parts += [f"<h2>{t.NOT_NOW[0]}</h2>", table(t.HEAD_NOT, with_q(t.NOT_NOW[1]), WIDTHS_NOT)]

    sets = question_sets(t)
    summary = [(label, len(qs), ", ".join(qs) if i else f"{qs[0]} … {qs[-1]}") for i, (label, qs) in enumerate(zip(t.SUMMARY_LABELS, sets))]
    open_rows = [(q, *t.QUESTION_NOTES[q]) for q in ALL_QUESTIONS if q in t.QUESTION_NOTES]
    parts += [f"<h2>{t.COMPARE_TITLE}</h2>", f"<p>{t.COMPARE_INTRO}</p>", table(t.SUMMARY_HEAD, summary, [45, 10, 45], bold=1),
              f"<h2>{t.OPEN_TITLE}</h2>", table(t.OPEN_HEAD, open_rows, [7, 38, 55], bold=1),
              f"<h2>{t.SOURCES_TITLE}</h2>", f"<p>{t.SOURCES_INTRO}</p>",
              table(t.SOURCES_HEAD, list(zip(t.SOURCE_LABELS, SOURCE_URLS, strict=True)), [35, 65], bold=1)]
    style = "body{font-family:Arial;font-size:9pt} h1,h2{font-family:Arial} h1{font-size:16pt} h2{font-size:12pt} th,td{font-size:9pt;vertical-align:top}"
    return f'<html><head><meta charset="utf-8"><style>{style}</style></head><body>{"".join(parts)}</body></html>'


def landscape(docx: Path) -> None:
    """Seite auf A4 quer stellen (7 Spalten passen hochkant nicht)."""
    tmp = docx.with_suffix(".tmp")
    with zipfile.ZipFile(docx) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                xml = re.sub(r"<w:pgSz [^>]*/>", '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>', data.decode())
                xml = re.sub(r"<w:pgMar [^>]*/>", '<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" '
                             'w:header="0" w:footer="0" w:gutter="0"/>', xml)
                data = xml.encode()
            zout.writestr(item, data)
    tmp.replace(docx)


def build_docx(t) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / Path(t.OUT_NAME).with_suffix(".html").name
        src.write_text(build_html(t), encoding="utf-8")
        subprocess.run(["soffice", f"-env:UserInstallation=file://{tmp}/lo", "--headless",
                        "--convert-to", "docx:MS Word 2007 XML", "--outdir", tmp, str(src)],
                       check=True, capture_output=True)
        out = Path(tmp) / t.OUT_NAME
        landscape(out)
        shutil.copy(out, ROOT / "CONTENT" / t.OUT_NAME)
    print(f"→ CONTENT/{t.OUT_NAME}")


def main() -> None:
    sys.dont_write_bytecode = True  # kein __pycache__ in scripts/
    sys.path.insert(0, str(Path(__file__).parent))
    import function_table_en as en
    build_docx(SimpleNamespace(**{k: v for k, v in globals().items() if k.isupper()}))
    build_docx(en)


if __name__ == "__main__":
    main()
