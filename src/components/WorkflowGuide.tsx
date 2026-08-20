import type { TextLayerAssessment } from "../models";
import type { AppPhase } from "./PhaseNavigation";

export interface WorkflowGuideMetrics {
  activePageCount: number;
  totalPageCount: number;
  currentPage: number;
  rotation: number;
  selectedOcrPageCount: number;
  textQuality?: TextLayerAssessment["quality"];
  hasOcr: boolean;
  blockCount: number;
  confirmedIndividualBlockCount: number;
  unclassifiedBlockCount: number;
  fieldRuleCount: number;
  hasNameRule: boolean;
  disciplineCount: number;
  resultCount: number;
  confirmedResultCount: number;
  warningResultCount: number;
}

interface WorkflowGuideProps {
  phase: AppPhase;
  metrics: WorkflowGuideMetrics;
  onPhaseChange: (phase: AppPhase) => void;
}

interface GuideStep {
  title: string;
  description: string;
  done?: boolean;
  optional?: boolean;
}

interface GuideContent {
  title: string;
  introduction: string;
  steps: GuideStep[];
  readyLabel: string;
  nextPhase?: AppPhase;
  nextLabel?: string;
}

export function WorkflowGuide({ phase, metrics, onPhaseChange }: WorkflowGuideProps) {
  const content = createGuide(phase, metrics);
  const firstOpenStep = content.steps.findIndex((step) => step.done === false && !step.optional);

  return (
    <details className="workflow-guide" key={phase} open>
      <summary>
        <span className="workflow-guide-icon" aria-hidden="true">?</span>
        <span>
          <strong>{content.title}</strong>
          <small>{content.introduction}</small>
        </span>
        <span className="workflow-guide-toggle">Anleitung</span>
      </summary>
      <div className="workflow-guide-body">
        <ol className="workflow-guide-steps">
          {content.steps.map((step, index) => {
            const current = firstOpenStep === index;
            return (
              <li
                className={`${step.done ? "is-done" : ""}${current ? " is-current" : ""}`}
                key={step.title}
              >
                <span className="guide-step-number" aria-hidden="true">
                  {step.done ? "✓" : index + 1}
                </span>
                <div>
                  <strong>{step.title}{step.optional ? " (optional)" : ""}</strong>
                  <p>{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="workflow-guide-footer">
          <span><strong>Weiter, wenn:</strong> {content.readyLabel}</span>
          {content.nextPhase && content.nextLabel ? (
            <button onClick={() => onPhaseChange(content.nextPhase!)} type="button">
              {content.nextLabel} →
            </button>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function createGuide(phase: AppPhase, metrics: WorkflowGuideMetrics): GuideContent {
  switch (phase) {
    case "file":
      return {
        title: "PDF vorbereiten",
        introduction: "Legen Sie fest, welche Seiten verarbeitet werden und wie herum sie gelesen werden.",
        steps: [
          {
            title: "Unwichtige Seiten ausschließen",
            description: `Links mit × beispielsweise Deckblätter oder Mannschaftslisten entfernen. Aktuell sind ${metrics.activePageCount} von ${metrics.totalPageCount} Seiten aktiv.`,
          },
          {
            title: "Jede relevante Seite aufrecht drehen",
            description: `Mit ↻ drehen, bis Überschrift und Teilnehmernamen normal lesbar sind. Seite ${metrics.currentPage} steht aktuell auf ${metrics.rotation}°.`,
          },
          {
            title: "Seiten kurz durchsehen",
            description: "Prüfen Sie, ob Einzel-Ergebnisse enthalten sind. Ausgeschlossene Seiten lassen sich mit + jederzeit zurückholen.",
          },
        ],
        readyLabel: "alle relevanten Seiten aktiv und visuell richtig ausgerichtet sind.",
        nextPhase: "ocr",
        nextLabel: "OCR prüfen",
      };
    case "ocr": {
      const textReady = metrics.textQuality === "good" || metrics.hasOcr;
      return {
        title: "Text prüfen und Scan-Seiten gemeinsam erkennen",
        introduction: "Moderne PDFs liefern Text direkt; mehrere Scan-Seiten können in einer kontrollierten Warteschlange erkannt werden.",
        steps: [
          {
            title: "Scan-Seiten für OCR auswählen",
            description: `Rechts einzelne Seiten anhaken oder „Aktuelle Seite“ beziehungsweise „Alle aktiven“ wählen. Aktuell sind ${metrics.selectedOcrPageCount} Seite(n) ausgewählt. Seiten mit guter Textebene brauchen normalerweise keine zusätzliche OCR.`,
            done: metrics.textQuality !== undefined && metrics.textQuality !== "unknown",
          },
          {
            title: "Einstellungen mit einer Vorschau prüfen",
            description: "Kontrast und Binarisierung einstellen, dann „Vorschau für Seite … erzeugen“ klicken. Oben mit „Original“ und „Optimiert“ vergleichen. Die Vorschau verändert die PDF-Datei nicht; die Drehung bleibt pro Seite individuell.",
          },
          {
            title: "Ausgewählte Seiten starten",
            description: "Unten auf „Seiten lokal erkennen“ klicken. Die Seiten werden nacheinander verarbeitet; Gesamtfortschritt und Status jeder Seite bleiben sichtbar. Bei Bedarf kann die gesamte Warteschlange abgebrochen werden.",
            done: textReady,
          },
          {
            title: "Wortboxen kontrollieren",
            description: "Nach dem Lauf einzelne Seiten links öffnen. Die Boxen sollten Namen, Zahlen und Zeiten treffen. Bei schlechten Ergebnissen nur diese Seiten auswählen, Einstellungen ändern und erneut erkennen.",
            done: metrics.hasOcr || metrics.textQuality === "good",
          },
        ],
        readyLabel: "Namen und Ergebniswerte auf allen benötigten Seiten als Text oder OCR-Boxen vorliegen.",
        nextPhase: "mapping",
        nextLabel: "Mapping beginnen",
      };
    }
    case "mapping": {
      const hasConfirmedBlock = metrics.confirmedIndividualBlockCount > 0;
      return {
        title: "Tabellenstruktur einmal vormachen",
        introduction: "Phraser muss wissen, welcher Bereich Einzel-Ergebnisse enthält und welche Spalte welches Feld bedeutet.",
        steps: [
          {
            title: "Ergebnisbereich markieren",
            description: "Rechts unter „1 · Ergebnisblöcke“ auf „Bereich aufziehen“ klicken und anschließend die eigentliche Ergebnistabelle auf der PDF umrahmen. Für eine reine Ergebnisseite genügt „Ganze Seite“.",
            done: metrics.blockCount > 0,
          },
          {
            title: "Block ausdrücklich klassifizieren",
            description: "Beim erzeugten Block „Einzel“ wählen. Mannschaft, Staffel oder irrelevante Bereiche entsprechend ausschließen. Ohne bestätigten Einzelblock gibt es keinen Export.",
            done: hasConfirmedBlock && metrics.unclassifiedBlockCount === 0,
          },
          {
            title: "Passenden Mapping-Modus wählen",
            description: "„Spalten“ für klassische Tabellen: je Spalte eine Beispielzelle anklicken. „Beispielteilnehmer“ für versetzte Layouts: alle Werte einer vollständigen Person vormachen.",
          },
          {
            title: "Text anklicken und Feld zuordnen",
            description: "Eine oder mehrere grüne Wortboxen in der PDF anklicken, rechts den Feldtyp wählen und „Auswahl zuordnen“ drücken. Mindestens vollständiger Name oder Nachname ist erforderlich; Platz, Jahrgang und Gesamtpunkte danach ergänzen.",
            done: metrics.hasNameRule,
          },
          {
            title: "Disziplinen und deren Werte ergänzen",
            description: `Unter „3 · Disziplinen“ beispielsweise „50 m Freistil“ anlegen. Danach deren Platz, Zeit, Punkte und Strafen genauso über Wortboxen zuordnen. Aktuell: ${metrics.disciplineCount} Disziplin(en), ${metrics.fieldRuleCount} Feldregel(n).`,
            optional: true,
          },
          {
            title: "Muster anwenden",
            description: "Ganz unten rechts „Muster auf Einzelblöcke anwenden“ klicken. Erst dadurch werden Teilnehmer-Vorschläge erzeugt und die nächste Phase geöffnet.",
            done: metrics.resultCount > 0,
          },
        ],
        readyLabel: "mindestens ein bestätigter Einzelblock und eine Namenszuordnung vorhanden sind; dann unten „Muster anwenden“ klicken.",
      };
    }
    case "participants":
      return {
        title: "Extrahierte Teilnehmer kontrollieren",
        introduction: "Alle Zeilen sind zunächst Vorschläge und werden nicht automatisch als richtig angenommen.",
        steps: [
          {
            title: "Teilnehmerzahl und Namen plausibilisieren",
            description: `${metrics.resultCount} Vorschläge wurden gefunden. Prüfen Sie fehlende, doppelte oder versehentlich zusammengeführte Personen.`,
            done: metrics.resultCount > 0,
          },
          {
            title: "Markierte Werte direkt korrigieren",
            description: "In jede Tabellenzelle kann geschrieben werden. Besonders Namen, Jahrgang, Platzierung, Zeiten und Punkte kontrollieren.",
          },
          {
            title: "Bei Unsicherheit die PDF-Quelle öffnen",
            description: "Auf „Quelle“ beim betreffenden Wert klicken. Rechts erscheinen Originalausschnitt, OCR-Rohwert und Confidence.",
          },
          {
            title: "Nur geprüfte Zeilen bestätigen",
            description: `${metrics.confirmedResultCount} von ${metrics.resultCount} Teilnehmern sind bestätigt. „Sichtbare bestätigen“ erst nach der Prüfung verwenden.`,
            done: metrics.resultCount > 0 && metrics.confirmedResultCount === metrics.resultCount,
          },
        ],
        readyLabel: "jede gewünschte Person vollständig geprüft und ausdrücklich bestätigt ist.",
        nextPhase: "review",
        nextLabel: "Warnungen prüfen",
      };
    case "review":
      return {
        title: "Warnungen und unsichere Werte auflösen",
        introduction: "Diese Ansicht bündelt Datensätze, bei denen noch fachliche Aufmerksamkeit nötig ist.",
        steps: [
          {
            title: "Filter „Nur Warnungen“ eingeschaltet lassen",
            description: `${metrics.warningResultCount} Datensätze haben noch Warnungen oder Fehler. Niedrige Confidence ist ein Prüfhinweis, kein automatisch falscher Wert.`,
            done: metrics.warningResultCount === 0,
          },
          {
            title: "Ursache in der Quelle prüfen",
            description: "Den betroffenen Wert öffnen und PDF-Ausschnitt mit Rohwert vergleichen. Danach den Tabellenwert korrigieren oder bewusst unverändert lassen.",
          },
          {
            title: "Bestätigung nochmals kontrollieren",
            description: `Exportiert werden nur bestätigte Zeilen. Aktuell bestätigt: ${metrics.confirmedResultCount} von ${metrics.resultCount}.`,
            done: metrics.resultCount > 0 && metrics.confirmedResultCount === metrics.resultCount,
          },
        ],
        readyLabel: "keine ungeklärten Fehler verbleiben und alle gewünschten Zeilen bestätigt sind.",
        nextPhase: "export",
        nextLabel: "Export vorbereiten",
      };
    case "export":
      return {
        title: "CSV vor dem Download abschließend prüfen",
        introduction: "Die Vorschau zeigt genau die Spalten und Werte, die in die Datei geschrieben werden.",
        steps: [
          {
            title: "Anzahl der Exportzeilen prüfen",
            description: `${metrics.confirmedResultCount} bestätigte Teilnehmer können exportiert werden. Unbestätigte Vorschläge bleiben absichtlich außen vor.`,
            done: metrics.confirmedResultCount > 0,
          },
          {
            title: "Reihenfolge der Disziplinen festlegen",
            description: "Disziplinen mit den Pfeilen oder per Ziehen in die gewünschte Reihenfolge bringen. Pro Disziplin werden fünf Spalten erzeugt.",
            optional: metrics.disciplineCount === 0,
          },
          {
            title: "Vorschau stichprobenartig vergleichen",
            description: "Namen, Gesamtwertung, Wettkampfdatum, Wettkampfname und Ort sowie die reservierten leeren Spalten kontrollieren.",
          },
          {
            title: "CSV herunterladen",
            description: "Erst danach den Download starten. Die Datei wird lokal als UTF-8 mit BOM, Semikolon und Windows-Zeilenumbrüchen erzeugt.",
          },
        ],
        readyLabel: "Zeilenzahl, Metadaten und Disziplinreihenfolge in der Vorschau stimmen.",
      };
  }
}
