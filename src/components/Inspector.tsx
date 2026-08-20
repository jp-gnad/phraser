import type { PageRenderInfo } from "./PdfCanvas";
import { formatFileSize } from "../utils/fileValidation";
import type {
  ConfidenceThresholds,
  OcrBatchPageState,
  PageRotation,
  PreprocessingRecipe,
} from "../models";
import type { OcrProgress } from "../ocr/ocrEngine";

interface InspectorProps {
  file: File;
  page: number;
  pageCount: number;
  activePageCount: number;
  activePages: number[];
  selectedOcrPages: number[];
  ocrPageStates: Record<number, OcrBatchPageState>;
  pageRotations: Record<number, PageRotation>;
  rotation: PageRotation;
  renderInfo?: PageRenderInfo;
  recipe: PreprocessingRecipe;
  onRecipeChange: (recipe: PreprocessingRecipe) => void;
  onPreviewOcr: () => void;
  onRunOcr: () => void;
  onCancelOcr: () => void;
  onOcrPageSelectionChange: (pages: number[]) => void;
  ocrProgress?: OcrProgress;
  ocrRunning: boolean;
  previewProgress?: OcrProgress;
  previewRunning: boolean;
  showOcr?: boolean;
  confidenceThresholds: ConfidenceThresholds;
  onConfidenceThresholdsChange: (thresholds: ConfidenceThresholds) => void;
}

const qualityLabels = {
  good: "Textebene erkannt",
  poor: "Textebene prüfen",
  missing: "Scan / keine Textebene",
  unknown: "Noch nicht analysiert",
} as const;

const ocrPageStateLabels: Record<OcrBatchPageState, string> = {
  queued: "wartet",
  running: "läuft",
  completed: "fertig",
  failed: "Fehler",
};

export function Inspector({
  file,
  page,
  pageCount,
  activePageCount,
  activePages,
  selectedOcrPages,
  ocrPageStates,
  pageRotations,
  rotation,
  renderInfo,
  recipe,
  onRecipeChange,
  onPreviewOcr,
  onRunOcr,
  onCancelOcr,
  onOcrPageSelectionChange,
  ocrProgress,
  ocrRunning,
  previewProgress,
  previewRunning,
  showOcr = true,
  confidenceThresholds,
  onConfidenceThresholdsChange,
}: InspectorProps) {
  const quality = renderInfo?.assessment.quality ?? "unknown";
  const settingsBusy = ocrRunning || previewRunning;

  return (
    <aside className="inspector" aria-label="Dokumenteigenschaften">
      <section className="inspector-section">
        <span className="inspector-kicker">Dokument</span>
        <h2 title={file.name}>{file.name}</h2>
        <dl className="property-list">
          <div>
            <dt>Dateigröße</dt>
            <dd>{formatFileSize(file.size)}</dd>
          </div>
          <div>
            <dt>Seiten</dt>
            <dd>{activePageCount} aktiv · {pageCount} gesamt</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd><span className="status-dot is-ready" />Geöffnet</dd>
          </div>
        </dl>
      </section>

      <section className="inspector-section">
        <span className="inspector-kicker">Aktuelle Seite</span>
        <h3>Seite {page}</h3>
        <div className={`quality-card quality-${quality}`}>
          <span className="quality-icon" aria-hidden="true">
            {quality === "good" ? "T" : quality === "unknown" ? "…" : "!"}
          </span>
          <div>
            <strong>{qualityLabels[quality]}</strong>
            <span>
              {renderInfo
                ? `${renderInfo.assessment.tokenCount} Textelemente auf dieser Seite`
                : "Analyse läuft beim Anzeigen der Seite"}
            </span>
          </div>
        </div>
        <dl className="property-list compact-properties">
          <div>
            <dt>OCR-Ausrichtung</dt>
            <dd>{rotation}°</dd>
          </div>
        </dl>
        <p className="inspector-note">
          Eine gute PDF-Textebene wird direkt verwendet. Für Scans kann die Seite lokal optimiert
          und mit deutschem Sprachmodell erkannt werden.
        </p>
      </section>

      {showOcr ? <section className="inspector-section ocr-settings">
        <span className="inspector-kicker">OCR-Seitenauswahl</span>
        <h3>{selectedOcrPages.length} Seite{selectedOcrPages.length === 1 ? "" : "n"} ausgewählt</h3>
        <p className="inspector-note ocr-selection-note">
          Wählen Sie alle Scan-Seiten, die mit denselben Einstellungen erkannt werden sollen.
          Sie werden stabil nacheinander verarbeitet.
        </p>
        <div className="ocr-selection-actions">
          <button
            disabled={ocrRunning || !activePages.includes(page)}
            onClick={() => onOcrPageSelectionChange([page])}
            type="button"
          >
            Aktuelle Seite
          </button>
          <button
            disabled={ocrRunning || selectedOcrPages.length === activePages.length}
            onClick={() => onOcrPageSelectionChange(activePages)}
            type="button"
          >
            Alle aktiven
          </button>
          <button
            disabled={ocrRunning || selectedOcrPages.length === 0}
            onClick={() => onOcrPageSelectionChange([])}
            type="button"
          >
            Leeren
          </button>
        </div>
        <div className="ocr-page-checklist" aria-label="Seiten für OCR auswählen">
          {activePages.map((pageNumber) => {
            const state = ocrPageStates[pageNumber];
            return (
              <label
                className={`ocr-page-choice${selectedOcrPages.includes(pageNumber) ? " is-selected" : ""}${state ? ` is-${state}` : ""}`}
                key={pageNumber}
              >
                <input
                  checked={selectedOcrPages.includes(pageNumber)}
                  disabled={ocrRunning}
                  onChange={(event) => onOcrPageSelectionChange(
                    event.target.checked
                      ? [...selectedOcrPages, pageNumber]
                      : selectedOcrPages.filter((selectedPage) => selectedPage !== pageNumber),
                  )}
                  type="checkbox"
                />
                <span>
                  Seite {pageNumber} · {pageRotations[pageNumber] ?? 0}°
                  {pageNumber === page ? " · aktuell" : ""}
                </span>
                {state ? <strong>{ocrPageStateLabels[state]}</strong> : null}
              </label>
            );
          })}
        </div>

        <div className="ocr-settings-heading">
          <span className="inspector-kicker">Gemeinsame Einstellungen</span>
          <h3>Bildvorverarbeitung</h3>
          <p>Diese Einstellungen gelten für alle ausgewählten Seiten. Die Seitendrehung bleibt individuell.</p>
        </div>

        <label className="range-control">
          <span><span>Kontrast</span><strong>{recipe.contrast.toFixed(2)}</strong></span>
          <input
            max="2"
            min="0.7"
            disabled={settingsBusy}
            onChange={(event) => onRecipeChange({ ...recipe, contrast: Number(event.target.value) })}
            step="0.05"
            type="range"
            value={recipe.contrast}
          />
        </label>

        <label className="range-control">
          <span><span>Schräglage</span><strong>{recipe.deskewDegrees ?? 0}°</strong></span>
          <input
            max="3"
            min="-3"
            disabled={settingsBusy}
            onChange={(event) =>
              onRecipeChange({ ...recipe, deskewDegrees: Number(event.target.value) })
            }
            step="0.25"
            type="range"
            value={recipe.deskewDegrees ?? 0}
          />
        </label>

        <label className="check-control">
          <input
            checked={recipe.grayscale}
            disabled={settingsBusy}
            onChange={(event) => onRecipeChange({ ...recipe, grayscale: event.target.checked })}
            type="checkbox"
          />
          Graustufen
        </label>
        <label className="check-control">
          <input
            checked={recipe.adaptiveThreshold}
            disabled={settingsBusy}
            onChange={(event) =>
              onRecipeChange({ ...recipe, adaptiveThreshold: event.target.checked })
            }
            type="checkbox"
          />
          Adaptive Binarisierung
        </label>
        {!recipe.adaptiveThreshold ? (
          <label className="range-control">
            <span><span>Schwellwert</span><strong>{recipe.threshold ?? 155}</strong></span>
            <input
              max="230"
              min="60"
              disabled={settingsBusy}
              onChange={(event) => onRecipeChange({ ...recipe, threshold: Number(event.target.value) })}
              step="1"
              type="range"
              value={recipe.threshold ?? 155}
            />
          </label>
        ) : null}
        <label className="check-control">
          <input
            checked={recipe.denoise}
            disabled={settingsBusy}
            onChange={(event) => onRecipeChange({ ...recipe, denoise: event.target.checked })}
            type="checkbox"
          />
          Entrauschen
        </label>
        <label className="check-control">
          <input
            checked={recipe.cropDarkBorders}
            disabled={settingsBusy}
            onChange={(event) =>
              onRecipeChange({ ...recipe, cropDarkBorders: event.target.checked })
            }
            type="checkbox"
          />
          Dunkle Scanränder entfernen
        </label>

        <div className="ocr-preview-card">
          <strong>Einstellungen vorab ansehen</strong>
          <p>
            Erzeugt nur für Seite {page} ein optimiertes Bild – ohne Texterkennung und ohne
            die PDF-Datei zu verändern.
          </p>
          <button
            className="secondary-button full-width"
            disabled={ocrRunning || previewRunning}
            onClick={onPreviewOcr}
            type="button"
          >
            {previewRunning ? "Vorschau wird erstellt …" : `Vorschau für Seite ${page} erzeugen`}
          </button>
          {previewRunning || previewProgress ? (
            <div className="ocr-preview-progress" aria-live="polite">
              <span>{previewProgress?.status ?? "Vorschau wird vorbereitet"}</span>
              <strong>{Math.round((previewProgress?.progress ?? 0) * 100)} %</strong>
              <progress max="1" value={previewProgress?.progress ?? 0} />
            </div>
          ) : null}
          <small>Danach oben zwischen „Original“ und „Optimiert“ wechseln.</small>
        </div>

        <div className="confidence-settings">
          <strong>Confidence-Grenzen</strong>
          <label className="range-control">
            <span><span>sicher ab</span><strong>{confidenceThresholds.safe} %</strong></span>
            <input
              max="100"
              min={confidenceThresholds.review + 1}
              disabled={settingsBusy}
              onChange={(event) => onConfidenceThresholdsChange({ ...confidenceThresholds, safe: Number(event.target.value) })}
              type="range"
              value={confidenceThresholds.safe}
            />
          </label>
          <label className="range-control">
            <span><span>prüfen ab</span><strong>{confidenceThresholds.review} %</strong></span>
            <input
              max={confidenceThresholds.safe - 1}
              min="1"
              disabled={settingsBusy}
              onChange={(event) => onConfidenceThresholdsChange({ ...confidenceThresholds, review: Number(event.target.value) })}
              type="range"
              value={confidenceThresholds.review}
            />
          </label>
        </div>

        {ocrRunning || ocrProgress ? (
          <div className="ocr-progress" aria-live="polite">
            <div><span>{ocrProgress?.status ?? "OCR wird vorbereitet"}</span><strong>{Math.round((ocrProgress?.progress ?? 0) * 100)} %</strong></div>
            <progress max="1" value={ocrProgress?.progress ?? 0} />
          </div>
        ) : null}

        {ocrRunning ? (
          <button className="danger-button" onClick={onCancelOcr} type="button">Abbrechen</button>
        ) : (
          <button
            className="primary-button full-width"
            disabled={previewRunning || selectedOcrPages.length === 0}
            onClick={onRunOcr}
            type="button"
          >
            {selectedOcrPages.length === 0
              ? "Mindestens eine Seite auswählen"
              : `${selectedOcrPages.length} Seite${selectedOcrPages.length === 1 ? "" : "n"} lokal erkennen`}
          </button>
        )}
        <p className="inspector-note">Die Seitendrehung wird vor jeder Erkennung angewendet. OCR-Kern, Sprachmodell und Bilddaten bleiben auf diesem Gerät.</p>
      </section> : (
        <section className="inspector-section next-step-card">
          <span className="inspector-kicker">Arbeitsstand</span>
          <h3>Quellenansicht aktiv</h3>
          <p>Wechseln Sie zu OCR für Scanerkennung oder zu Mapping, um Ergebnisblöcke und Felder zuzuordnen.</p>
        </section>
      )}
    </aside>
  );
}
