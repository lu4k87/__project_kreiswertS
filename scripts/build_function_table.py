"""Funktionsliste der Plattform als Word-Tabelle → CONTENT/Funktionen_KreiswertS.docx (für Google Docs).

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
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "CONTENT" / "Funktionen_KreiswertS.docx"

HEAD = ["Nr", "Funktion", "Was sie macht", "Wo in der App", "Wo im Code", "Stand", "Vorbild"]
HEAD_NOT = ["Nr", "Funktion", "Was sie macht", "Wo sie später hinge", "Grund"]

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
WIDTHS = [4, 14, 30, 19, 18, 8, 9]  # Prozent je Spalte
WIDTHS_NOT = [4, 18, 34, 18, 26]


def cell(value) -> str:
    """Text escapen, `code` als Festbreitenschrift."""
    return re.sub(r"`([^`]+)`", r'<font face="Consolas">\1</font>', html.escape(str(value)))


def table(head, rows, widths, bold=2) -> str:
    """bold = Anzahl der ersten Spalten in Fettschrift (Nr + Funktion)."""
    th = "".join(f'<th bgcolor="#e8eef3" align="left" width="{w}%">{h}</th>' for h, w in zip(head, widths))
    body = "".join(
        "<tr>" + "".join(f'<td valign="top" width="{w}%">{"<b>" + cell(v) + "</b>" if i < bold else cell(v)}</td>'
                         for i, (v, w) in enumerate(zip(r, widths))) + "</tr>"
        for r in rows)
    return (f'<table width="100%" border="1" cellspacing="0" cellpadding="3">'
            f"<thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>")


def build_html() -> str:
    parts = [
        "<h1>KreiswertS – Funktionen der Plattform</h1>",
        "<p>Stand 23.11.2026 · bisherige, geplante und neue Funktionen, gruppiert nach Bereich. "
        "Seitenpfade sind Vorschläge; die Seiten legt das Frontend-Team nach Figma fest.</p>",
        table(["Stand", "Bedeutung"], LEGEND, [20, 80], bold=1),
    ]
    for title, rows in GROUPS:
        parts += [f"<h2>{title}</h2>", table(HEAD, rows, WIDTHS)]
    parts += [f"<h2>{NOT_NOW[0]}</h2>", table(HEAD_NOT, NOT_NOW[1], WIDTHS_NOT)]
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


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "Funktionen_KreiswertS.html"
        src.write_text(build_html(), encoding="utf-8")
        subprocess.run(["soffice", f"-env:UserInstallation=file://{tmp}/lo", "--headless",
                        "--convert-to", "docx:MS Word 2007 XML", "--outdir", tmp, str(src)],
                       check=True, capture_output=True)
        out = Path(tmp) / "Funktionen_KreiswertS.docx"
        landscape(out)
        shutil.copy(out, OUT)
    print(f"→ {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
