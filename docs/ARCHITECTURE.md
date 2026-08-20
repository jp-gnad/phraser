# Architektur und Implementierungsplan

## 1. Leitprinzipien

Phraser ist eine statische, vollständig lokale Browseranwendung. PDF-Inhalte, erkannte Namen und Ergebnisdaten werden weder hochgeladen noch an externe Analyse- oder OCR-Dienste gesendet. Automatisierung darf Daten vorschlagen, aber kein unsicheres Mapping als bestätigt behandeln.

Vier Regeln bestimmen die Architektur:

1. Jede interpretierte Zelle behält Rohwert, Geometrie, Seite und Confidence als Provenienz.
2. Semantik entsteht aus einem expliziten Benutzer-Mapping; Heuristiken liefern nur prüfbare Vorschläge.
3. Einzel-, Mannschafts-/Staffel- und ignorierte Blöcke werden vor dem Export explizit klassifiziert.
4. Exportdaten werden aus validiertem Domänenzustand erzeugt, nie direkt aus OCR-Tokens.

## 2. Technologieentscheidungen

| Bereich | Entscheidung | Begründung |
| --- | --- | --- |
| Anwendung | React, TypeScript, Vite | Statische Ausgabe, kleine Integrationsfläche, gute Worker- und Asset-Unterstützung, GitHub-Pages-kompatibel. |
| PDF | PDF.js (`pdfjs-dist`) | Etablierte lokale Rendering- und Textebenen-API mit Koordinaten und eigenem Worker. |
| OCR | Tesseract.js mit einem dedizierten Worker | Browserlokal, Bounding Boxes und Confidence; Seiten werden kontrolliert nacheinander verarbeitet. Sprachdaten, Worker und WASM-Kerne werden als versionierte statische Assets ausgeliefert, damit keine Dokumentdaten abfließen. |
| Vorverarbeitung | Canvas/OffscreenCanvas plus eigener Worker | Deterministische lokale Filter; Originalpixel bleiben unverändert. OpenCV.js wird erst ergänzt, wenn Deskew-/Entrauschqualität den zusätzlichen Download rechtfertigt. |
| Zustand | React-Reducer für UI, versionierte Domain-Commands für Änderungen | Explizite, testbare Zustandsübergänge und natürliches Undo/Redo ohne versteckte Mutation. |
| Persistenz | IndexedDB mit kleinen Repository-Adaptern | Asynchron, browserlokal und für strukturierte Sitzungen/OCR-Caches geeignet. PDF-Dateien werden standardmäßig nicht persistiert. |
| Validierung | Reine TypeScript-Regeln und Schema-Migrationen | Fachliche Warnungen bleiben von UI und Speicherung unabhängig; keine Validierung löscht Werte. |
| Tests | Vitest plus realer Browser-OCR-Smoke-Test | Schnelle Tests für Normalisierung, Geometrie, Extraktion und exakte CSV-Bytes; der reale Worker-/WASM-/Sprachdatenpfad wird zusätzlich im Browser geprüft. |

Nicht gewählt werden Cloud-OCR, Backend-Services, serverseitige Datenbanken und externe Analytics. Eine OCR-Bibliothek ist erst dann „integriert“, wenn reale Bilddaten verarbeitet und echte Wort-Geometrien ausgegeben werden; Phase 1 deklariert OCR daher ausdrücklich nicht als fertig.

## 3. Modulstruktur

```text
src/
  components/       UI-Shell, Upload, Viewer, Mapping, Kontrolle
  pdf/              Laden, Textebene, Rendering, Seitenmetadaten
  ocr/              Worker-Steuerung, OCR-Token, Cache
  preprocessing/    unveränderliche Filterrezepte und Canvas-Worker
  mapping/          Regeln, Editor-Interaktionen, geometrische Zuordnung
  extraction/       Block-/Zeilen-/Teilnehmererkennung
  results/          Kontrolltabelle und Quellenverknüpfung
  validation/       feld- und datensatzbezogene Befunde
  templates/        Versionierung, Import/Export, Migration
  metadata/         Gültigkeitsbereiche und Prioritätsauflösung
  export/           CSV-Plan, Vorschau, Quotierung, Download
  models/           serialisierbare Domänentypen
  storage/          IndexedDB-Repositories
  utils/            formatunabhängige Hilfsfunktionen
```

PDF.js- oder Tesseract-Objekte werden nicht im persistenten Domänenmodell gespeichert. Persistiert werden nur serialisierbare DTOs.

## 4. Internes Datenmodell

Die vollständigen TypeScript-Schnittstellen liegen unter `src/models`. Zentral sind:

- `DocumentSession`: Wurzel einer wiederherstellbaren Bearbeitungssitzung.
- `DocumentPage`: normalisierte Seitengröße, Textebenenqualität und Verarbeitungslage.
- `OCRToken`: Text, Confidence und normierte Bounding Box (`0..1`) unabhängig von Zoom und DPR.
- `ResultBlock`: explizite Blockklassifikation und blockbezogene Metadaten.
- `MappingTemplate`: versionierte Regeln, Disziplinen, globale Regeln und Layout-Fingerprint.
- `IndividualCompetitionResult`: genau ein Athlet und genau eine CSV-Datenzeile.
- `ExtractedValue`: Rohwert, optional normalisierter Wert, Confidence und Quellenreferenzen.
- `ValidationIssue`: nichtdestruktiver Befund mit Feldpfad und Quellenbezug.

IDs sind stabile UUIDs. Seitenzahlen sind an der Benutzeroberfläche 1-basiert. Geometrie ist auf die unrotierte Seite normalisiert; Transformationen für Rotation und Zoom erfolgen ausschließlich in der Darstellungs-/Mapping-Schicht.

## 5. State-Flow

```text
Datei im Speicher
  -> PDF-Dokumenthandle (flüchtig)
  -> Seitendeskriptoren + Texttokens
  -> ggf. Renderbild -> Vorverarbeitung -> OCR-Tokens
  -> vom Benutzer bestätigte Ergebnisblöcke
  -> Mapping-Regeln + globale Werte + Disziplinen
  -> Extraktionsvorschläge
  -> bestätigte/korrigierte Einzelergebnisse
  -> Validierungsbefunde
  -> Exportplan + CSV-Vorschau
  -> UTF-8-BOM-Download
```

Domain-Commands enthalten `apply`/`revert`-Daten und erzeugen einen neuen serialisierbaren Zustand. Nach jeder relevanten Änderung werden abhängige Extraktionen als `stale` markiert. Ein Export ist nur aus der aktuell validierten Revision möglich. Automatisches Speichern schreibt gedrosselt in IndexedDB; die PDF bleibt in Phase 1 nur im Arbeitsspeicher.

## 6. Komponentenstruktur

- `AppShell`: Arbeitsbereich, Phasenstatus und Datenschutzanzeige.
- `PdfUpload`: Dateiauswahl, Drag & Drop, Typ-/Größenprüfung.
- `PdfViewer`: Canvas, Seitennavigation, Zoom, Rotation und Renderstatus.
- `PageRail`: Seiten-/Blockstatus ohne vorzeitige Parallelverarbeitung.
- `Inspector`: Datei-/Seiteninformationen, OCR-Einstellungen und kontextbezogene Mapping-Eigenschaften.
- `BlockClassifier`: Einzel/Mannschaft oder Staffel/Ignorieren.
- `MappingEditor`: Auswahl-Overlay, Spaltenmodus, Beispielteilnehmermodus.
- `MetadataEditor` und `DisciplineEditor`: Gültigkeitsbereiche und sortierbare Disziplinen.
- `ResultsGrid`: virtuelle, editierbare Kontrolltabelle mit Quellnavigation.
- `ExportReview`: Disziplinreihenfolge, Schema- und Fehlerübersicht, CSV-Vorschau.

Schwere Flächen werden phasenweise lazy geladen. Das Viewer-Canvas und das geometrische Overlay besitzen denselben normalisierten Koordinatenraum.

## 7. PDF-Pipeline

1. Dateityp und PDF-Signatur prüfen; PDF als `ArrayBuffer` lesen.
2. PDF.js-Worker lokal aus dem Build laden und Dokument öffnen.
3. Pro angeforderter Seite `getTextContent()` lesen, Transform-Matrizen in normalisierte Boxen überführen und Textqualität bewerten.
4. Qualität anhand Tokenzahl, druckbarer Zeichen, Flächenabdeckung, Zeichenentropie und plausibler Wortgruppen klassifizieren. Ein einzelner Grenzwert entscheidet nicht.
5. Bei guter Textebene werden PDF-Texttokens als Quelle verwendet; bei schlechter/fehlender Textebene wird die Seite für OCR vorgemerkt.
6. Viewer rendert nur sichtbare/angeforderte Seiten. Render-Tasks werden bei Seitenwechsel abgebrochen.

PDF.js wandelt beim Viewport bereits das PDF-Koordinatensystem in Canvas-Koordinaten um. Persistiert wird danach eine normierte Box, nicht ein Pixelwert.

## 8. OCR- und Vorverarbeitungspipeline

1. Seite mit konfigurierbarer OCR-Auflösung rendern.
2. Original-`ImageBitmap` unverändert behalten; Filter erzeugen abgeleitete Bitmaps.
3. Filterrezept: Randabschätzung, Graustufen, lokaler Kontrast, adaptive Binarisierung, optionales Entrauschen und konservativer Deskew-Winkel.
4. Tesseract-Worker mit lokaler deutscher/englischer Sprachdatei ausführen.
5. Wörter in `OCRToken` mit normierter Box, Rohtext, Confidence und Pipeline-Rezept umwandeln.
6. Ergebnis über Hash aus Dokumentfingerprint, Seitennummer, Auflösung, Sprache und Filterrezept cachen.
7. Abbruchsignal beendet Render-/OCR-Auftrag; eine Seite läuft, weitere Seiten stehen in einer priorisierten Queue.

Die UI kann Original und optimiertes Bild vergleichen. Kein Filter überschreibt das Original. Unterhalb der konfigurierbaren Confidence-Grenzen entstehen `warning`- bzw. `error`-Befunde.

## 9. Mapping-Algorithmus

### Modus A: Spalten

Spaltenregeln speichern normalisierte X-Intervalle, erwartete Feldart und optional eine Disziplin-ID. Tokens werden zuerst in Zeilen geclustert: Die vertikale Überlappung und die Distanz relativ zur medianen Zeichenhöhe bestimmen die Zugehörigkeit. Innerhalb einer Zeile werden Tokens nach X sortiert und nur dann zu einem Feld verbunden, wenn Lücke und Baseline plausibel sind. Header-/Footer- und manuelle Ignorierbereiche werden vorher entfernt.

### Modus B: Beispielteilnehmer

Der markierte Beispielblock definiert einen Anker, eine normierte Blockbox und pro Feld relative Boxen. Weitere Ankerkandidaten werden aus Formatmerkmalen und Textklassen gesucht. Für jeden Kandidaten entsteht ein geometrischer Ähnlichkeitsscore aus relativer Position, Skalierung, Zeilenabständen, vorhandenen Feldern und Formatkompatibilität. Ein Kandidat wird als Vorschlag ausgegeben, nie still bestätigt. Fehlende oder konkurrierende Felder senken Confidence und erzeugen Befunde.

Feldregeln sind hierarchisch: `disciplineResult` verweist auf eine stabile `disciplineId`, während `disciplineField` Rank, Zeit, Punkte, Strafcode oder Strafe bezeichnet. Dadurch ist die Disziplinzahl nicht fest codiert.

## 10. Teilnehmererkennung

1. Nur explizit als `individual` klassifizierte Ergebnisblöcke betreten.
2. Anker gemäß Mapping (z. B. Name oder Gesamtplatz) suchen.
3. Aus wiederkehrenden Anker-Y-Positionen robuste Blockhöhen mittels Median/MAD schätzen.
4. Kandidatenblöcke bilden; bei Überlappungen ein Konfliktobjekt statt willkürlicher Auswahl erzeugen.
5. Relative Feldregeln anwenden und Quellenreferenzen sammeln.
6. Personenscore als gewichtetes Minimum kritischer Felder und geometrischer Konsistenz berechnen; niedrige Einzelwerte dürfen nicht durch viele sichere Felder verdeckt werden.
7. Fachliche Validierung ausführen. Gleichstände sind zulässig; DNS/DNF/DQ bleiben Text.
8. Vorschläge in der Kontrolltabelle anzeigen und den Bestätigungsstatus getrennt speichern.

Team-Schlüsselwörter erzeugen nur Warnungen. Exportfilter verwenden ausschließlich die explizite Blockklassifikation plus Benutzerbestätigung.

## 11. Disziplinverwaltung

`DisciplineDefinition[]` legt Anzahl und Reihenfolge auf Wettkampfebene fest. Ergebnisse referenzieren IDs, nicht Arraypositionen. Umsortieren ändert `order`, nie die Zuordnung. Jede Disziplin besitzt immer dieselben fünf exportierbaren Unterfelder; fehlende Teilnehmerwerte bleiben leer. Disziplinnamen werden intern und in der Exportübersicht angezeigt, während die standardisierte CSV-Kopfzeile laufende Nummern verwendet.

## 12. Metadatenauflösung

Globale Werte sind Regeln mit einem Gültigkeitsbereich: Dokument, Seitenauswahl, Ergebnisblock oder Person. Bei der Auflösung gilt die spezifischste Regel; bei gleicher Spezifität gewinnt die neueste explizite Benutzeränderung. Konflikte werden angezeigt. Zusätzliche Metadaten wie Wettkampf-Code und Bahnlänge bleiben intern und erweitern das V1-CSV nicht.

## 13. Template-System

Templates werden versioniert in IndexedDB gespeichert. Enthalten sind nur Layout-/Mappingregeln, Disziplinen, globale Regeln und optionale Klassifikationshinweise, keine Teilnehmerdaten oder PDF-Inhalte. Import validiert Schema und Versionsnummer; Migrationen sind reine Funktionen. JSON-Export nutzt ein Envelope mit Produkt-, Schema- und Erstellungsinformationen. Geometrische Fingerprints dürfen passende Templates vorschlagen, aber nie automatisch anwenden.

## 14. CSV-Generator

Der Generator arbeitet in vier Schritten:

1. `ExportPlan` friert bestätigte Einzelpersonen und die gewählte Disziplinreihenfolge ein.
2. Kopfzeile erzeugen: 11 feste Felder, zwei tatsächlich leere Headerzellen, pro Disziplin exakt fünf Felder, drei Endfelder.
3. Pro Person genau eine Datenzeile erzeugen. Gender und Jahrgang werden nur bei eindeutiger Regel normalisiert; Zeit nutzt `normalizedTime`, sonst den erhaltenen Rohwert.
4. Jede Zelle nach RFC-4180-artigen Regeln für Semikolon, Anführungszeichen und Zeilenumbrüche quotieren; CRLF und UTF-8-BOM verwenden.

Vor dem Download verifiziert ein Invariantentest Spaltenzahl, Leerfeldpositionen 12/13, fünf Spalten je Disziplin, Endspalten und ausgeschlossene Blöcke. Der Dateiname wird separat bereinigt und verändert keine Daten.

## 15. Technische Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
| --- | --- |
| OCR-WASM und Sprachdaten sind groß | Lazy Load, lokale versionierte Assets, ein Worker, Fortschritt und Cache. |
| Historische Layouts sind semantisch uneindeutig | Benutzerdefinierte Blöcke/Anker, Confidence, Konfliktanzeige, keine stille Bestätigung. |
| PDF-Koordinaten, Rotation und HiDPI driften | Ein normierter Quellraum plus zentral getestete Transformationen. |
| Große PDFs erschöpfen Speicher | Sichtbarkeitsbasiertes Rendering, Bitmap-Freigabe, begrenzter LRU-Cache. |
| IndexedDB kann vom Browser geräumt werden | Sitzungs-/Template-JSON-Export, Quotenwarnung, PDF nicht voraussetzen. |
| Browserunterschiede bei Canvas/WASM | Feature-Erkennung, konservative Fallbacks, Regressionstests in Chromium/Firefox/WebKit. |
| OCR-Correkturen verlieren Provenienz | Rohwert und Quellbox unveränderlich, Korrektur als separate Revision. |
| GitHub-Pages-Unterpfad bricht Worker/Assets | alle Assets als Imports/`import.meta.url`; `VITE_BASE_PATH` im Workflow. |
| CSV-Fehler sind schwer sichtbar | Exportvorschau plus strukturelle Invariantentests auf Byte-Ebene. |

## 16. Phasenplan und Abnahmekriterien

1. **Basis:** Vite/TypeScript, statischer Unterpfad, Upload, lokaler PDF.js-Viewer, Navigation/Zoom, Fehlerzustände.
2. **OCR:** Textebenenbewertung, Rendering-Pipeline, Vorverarbeitung, echte OCR-Tokens, Fortschritt/Abbruch/Cache.
3. **Mapping:** Blockklassifikation, Overlays, Auswahl, Spalten- und Beispielmodus, globale Werte.
4. **Disziplinmodell:** dynamische Definitionen und hierarchische Feldregeln.
5. **Extraktion:** Vorschläge für Teilnehmerblöcke, Confidence, Konflikte, Einzel-Gesamtwertung.
6. **Kontrolle:** editierbare Tabelle, Validierung, Undo/Redo, PDF-Quellnavigation.
7. **Templates:** IndexedDB, CRUD, Import/Export, Migration.
8. **CSV:** exaktes dynamisches Schema, Reihenfolge, Vorschau, Download.
9. **Qualität:** historische Regressionstests, Performancebudgets, Browsermatrix, GitHub-Pages-Abnahme.

Nach jeder Phase müssen TypeScript-Prüfung, Unit-Tests und Production-Build grün sein. Die beschriebenen Phasen 1 bis 9 sind im aktuellen V1-Arbeitsbereich umgesetzt; verbleibende Grenzen sind im README ausdrücklich dokumentiert.
