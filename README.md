# Phraser

Phraser ist ein lokales Arbeitswerkzeug zur Digitalisierung von Einzel-Wettkampfergebnissen aus modernen Text-PDFs und historischen Scans. Das Ziel ist keine unkontrollierte Vollautomatik: PDF-Text und OCR-Geometrie werden automatisch erfasst, die semantische Tabellenstruktur wird einmal visuell zugeordnet und jede unsichere Ableitung bleibt überprüfbar.

Der aktuelle Stand ist **Phase 1 – Basis**. Bereits funktionsfähig sind der lokale PDF-Upload, Dateiprüfung, PDF.js-Rendering, Mehrseitennavigation, Zoom, Rotation und eine erste transparente Einschätzung der vorhandenen Textebene. OCR, Mapping, Extraktion, Kontrolltabelle, Templates und CSV-Export folgen in den dokumentierten Entwicklungsphasen und werden nicht als bereits fertig dargestellt.

## Produktprinzip

```text
PDF lokal öffnen
  → Textlage erkennen oder später OCR ausführen
  → Einzel-Ergebnisbereiche explizit klassifizieren
  → Layout einmal visuell zuordnen
  → weitere Teilnehmer als prüfbare Vorschläge extrahieren
  → Ergebnisse korrigieren und validieren
  → exakt standardisierte Wide-Format-CSV exportieren
```

Mannschafts-, Staffel- und Relay-Blöcke werden nicht exportiert. Eine Einzel-Gesamtwertung eines Athleten bleibt dagegen einschließlich Gesamtplatz, Gesamtpunkten und beliebig vieler Einzeldisziplinen erhalten.

## Phase-1-Funktionen

- PDF per Dateiauswahl oder Drag & Drop öffnen
- PDF-Signatur und Dateigröße vor dem Parsen prüfen
- Datei vollständig im Browser an PDF.js übergeben
- PDF.js-Worker als lokales Build-Asset ausliefern
- Seiten einzeln rendern und Renderaufträge bei Seitenwechsel abbrechen
- Seiten wechseln, zoomen und drehen
- vorhandene Textebene pro angezeigter Seite konservativ einschätzen
- verständliche Fehlerzustände für ungültige und kennwortgeschützte PDFs
- dynamischer GitHub-Pages-Unterpfad ohne fest codierten Repositorynamen

## Architektur

Die Anwendung ist modular nach PDF, OCR, Vorverarbeitung, Mapping, Extraktion, Ergebniskontrolle, Validierung, Templates, Metadaten, Export, Modellen und Speicherung getrennt. Persistente Domänendaten sind serialisierbar; laufende PDF.js-/Worker-Objekte bleiben flüchtig.

Der vollständige Architekturentwurf beschreibt:

- Bibliotheksentscheidungen und Datenschutzgrenzen
- TypeScript-Datenmodell und State-Flow
- Komponentenstruktur
- PDF-, OCR- und Vorverarbeitungspipeline
- Spalten- und Beispielteilnehmer-Mapping
- geometrische Teilnehmererkennung
- dynamische Disziplinverwaltung
- Metadaten-Gültigkeitsbereiche
- Template-Versionierung
- exakten CSV-Generator
- Risiken, Gegenmaßnahmen und Phasenplan

Siehe [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Die zugehörigen TypeScript-Schnittstellen liegen in [src/models](src/models).

## Installation

Voraussetzung ist Node.js 22.12 oder neuer.

```bash
npm install
```

Das Repository enthält zusätzlich einen `pnpm-lock.yaml` für reproduzierbare CI-Installationen. Lokale Entwicklung ist mit npm oder pnpm möglich.

## Lokale Entwicklung

```bash
npm run dev
```

Vite zeigt die lokale Adresse in der Konsole an. PDFs werden aus Sicherheitsgründen über diese lokale Webadresse und nicht über `file://` geöffnet.

## Prüfungen

```bash
npm run typecheck
npm test
npm run build
```

`npm run build` führt zuerst die strikte TypeScript-Prüfung und danach den Vite-Production-Build aus. Das statische Ergebnis liegt in `dist/`.

## GitHub Pages

Der Workflow `.github/workflows/deploy-pages.yml` testet und baut bei einem Push auf `main` und veröffentlicht anschließend `dist/` über GitHub Pages. In den Repository-Einstellungen muss unter **Pages → Build and deployment** als Quelle **GitHub Actions** ausgewählt sein.

Der Workflow setzt `VITE_BASE_PATH` aus dem tatsächlichen Repositorynamen. Quellcode und Worker verwenden importierte Asset-URLs; dadurch gibt es keine fest codierten Root-Pfade und das Projekt funktioniert unter `https://<name>.github.io/<repository>/`.

Für einen manuellen Unterpfad-Build:

```bash
VITE_BASE_PATH=/mein-pfad/ npm run build
```

Unter PowerShell:

```powershell
$env:VITE_BASE_PATH = "/mein-pfad/"
npm run build
```

## Verwendete Bibliotheken

- **React** für die komponentenbasierte Arbeitsoberfläche
- **TypeScript** für ein explizites, erweiterbares Domänenmodell
- **Vite** für Entwicklung, Worker-/Asset-Bundling und statischen Build
- **PDF.js (`pdfjs-dist`)** für lokales PDF-Parsen, Rendering und Textebenen-Zugriff
- **Vitest** für schnelle Unit- und spätere Regressionstests

Für spätere Phasen ist Tesseract.js als browserlokale OCR-Engine vorgesehen. Es wird erst als implementiert gelten, wenn reale Seitenbilder mit echten Bounding Boxes und Confidence-Werten verarbeitet werden.

## Datenschutz

Die hochgeladene PDF wird in Phase 1 ausschließlich als `ArrayBuffer` im aktuellen Browser verarbeitet und nicht persistiert. Es gibt kein Backend, keine Cloud-OCR, keine externe KI-API und keine Analytics. Auch Schriftarten und PDF-Worker werden aus dem erzeugten Anwendungsbundle geladen; während der Dokumentverarbeitung sind keine externen Dienste erforderlich.

Spätere lokale Sitzungs- und Template-Speicherung verwendet IndexedDB. PDF-Inhalte, Namen, OCR-Daten und Wettkampfergebnisse dürfen nicht an Telemetrie- oder Analysedienste gelangen.

## Mapping-Editor und Templates

Der geplante Mapping-Editor unterstützt klassische Spalten und einen markierten Beispielteilnehmer. Alle Regeln speichern normalisierte Seitenkoordinaten und stabile Disziplin-IDs. Ergebnisblöcke werden explizit als `Einzel`, `Mannschaft / Staffel` oder `Ignorieren` bestätigt.

Templates enthalten Layout-, Feld-, Disziplin- und globale Regeln, aber keine Teilnehmerdaten. Sie werden versioniert in IndexedDB gespeichert und können später als JSON importiert beziehungsweise exportiert werden. Geometrische Ähnlichkeit darf nur einen Template-Vorschlag erzeugen.

## Wettkampf-Metadaten

Das Datenmodell unterstützt Dokument-, Seiten-, Block- und Personenebene. Exportrelevant sind Gender, Altersklasse, Verbandsstruktur, Wettkampf-Enddatum, Name und Ort. Wettkampf-Code, Bahnlänge, Land, Regelwerk und Wertung bleiben in Version 1 intern und erweitern das Standard-CSV nicht ungefragt.

## CSV-Schema

Der geplante Export ist UTF-8 mit BOM, Semikolon-getrennt und enthält genau eine Person pro Zeile. Er beginnt mit:

```text
Nachname;Vorname;Gender;Altersklasse;Jahrgang;Ortsgruppe;Bezirk;Landesverband;Bundesverband;Gesamtplatzierung;Gesamtpunktzahl;;;
```

Danach folgen pro definierter Einzeldisziplin exakt fünf Spalten:

```text
Platzierung Disziplin X;Zeit Disziplin X;Punkte Disziplin X;Strafe code Disziplin X;Strafe Disziplin X
```

Am Ende stehen exakt `Datum`, `Wettkampf Name` und `Wettkampfort`. Die zwei leeren reservierten Spalten nach `Gesamtpunktzahl` sind strukturelle Invarianten und werden vor jedem Download geprüft.

## OCR-Einschränkungen

Historische Scans können durch Schräglage, Vergilbung, Durchscheinen, geringe Auflösung und ungewöhnliche Schriften uneindeutig bleiben. Vorverarbeitung und OCR liefern deshalb keine automatische Wahrheitsbehauptung. Rohwert, normalisierter beziehungsweise korrigierter Wert, Confidence und PDF-Quelle bleiben getrennt erhalten. Unsichere Zeiten, Namen oder Zuordnungen müssen sichtbar geprüft werden.

## Bekannte Einschränkungen von Phase 1

- noch keine OCR und Bildvorverarbeitung
- noch keine Bounding-Box-Overlays und Ergebnisblock-Auswahl
- noch kein Mapping oder automatische Teilnehmererkennung
- noch keine editierbare Kontrolltabelle und PDF-Quellnavigation
- noch keine IndexedDB-Sitzungen oder Templates
- noch keine CSV-Vorschau und kein Export
- kennwortgeschützte PDFs werden noch nicht entsperrt
- Desktop-Ansicht ist priorisiert; eine mobile Mapping-Oberfläche ist kein V1-Ziel

Die Abgrenzung ist beabsichtigt: Jede Phase bleibt ausführbar, ohne spätere Funktionen mit Dummy-Daten vorzutäuschen.
