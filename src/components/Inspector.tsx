import type { PageRenderInfo } from "./PdfCanvas";
import { formatFileSize } from "../utils/fileValidation";
import type { PreprocessingRecipe } from "../models";
import type { OcrProgress } from "../ocr/ocrEngine";

interface InspectorProps {
  file: File;
  page: number;
  pageCount: number;
  renderInfo?: PageRenderInfo;
  recipe: PreprocessingRecipe;
  onRecipeChange: (recipe: PreprocessingRecipe) => void;
  onRunOcr: () => void;
  onCancelOcr: () => void;
  ocrProgress?: OcrProgress;
  ocrRunning: boolean;
  showOcr?: boolean;
}

const qualityLabels = {
  good: "Textebene erkannt",
  poor: "Textebene prüfen",
  missing: "Scan / keine Textebene",
  unknown: "Noch nicht analysiert",
} as const;

export function Inspector({
  file,
  page,
  pageCount,
  renderInfo,
  recipe,
  onRecipeChange,
  onRunOcr,
  onCancelOcr,
  ocrProgress,
  ocrRunning,
  showOcr = true,
}: InspectorProps) {
  const quality = renderInfo?.assessment.quality ?? "unknown";

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
            <dd>{pageCount}</dd>
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
        <p className="inspector-note">
          Eine gute PDF-Textebene wird direkt verwendet. Für Scans kann die Seite lokal optimiert
          und mit deutschem Sprachmodell erkannt werden.
        </p>
      </section>

      {showOcr ? <section className="inspector-section ocr-settings">
        <span className="inspector-kicker">Bildvorverarbeitung</span>
        <h3>OCR für Seite {page}</h3>

        <label className="range-control">
          <span><span>Kontrast</span><strong>{recipe.contrast.toFixed(2)}</strong></span>
          <input
            max="2"
            min="0.7"
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
            onChange={(event) => onRecipeChange({ ...recipe, grayscale: event.target.checked })}
            type="checkbox"
          />
          Graustufen
        </label>
        <label className="check-control">
          <input
            checked={recipe.adaptiveThreshold}
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
            onChange={(event) => onRecipeChange({ ...recipe, denoise: event.target.checked })}
            type="checkbox"
          />
          Entrauschen
        </label>
        <label className="check-control">
          <input
            checked={recipe.cropDarkBorders}
            onChange={(event) =>
              onRecipeChange({ ...recipe, cropDarkBorders: event.target.checked })
            }
            type="checkbox"
          />
          Dunkle Scanränder entfernen
        </label>

        {ocrRunning || ocrProgress ? (
          <div className="ocr-progress" aria-live="polite">
            <div><span>{ocrProgress?.status ?? "OCR wird vorbereitet"}</span><strong>{Math.round((ocrProgress?.progress ?? 0) * 100)} %</strong></div>
            <progress max="1" value={ocrProgress?.progress ?? 0} />
          </div>
        ) : null}

        {ocrRunning ? (
          <button className="danger-button" onClick={onCancelOcr} type="button">Abbrechen</button>
        ) : (
          <button className="primary-button full-width" onClick={onRunOcr} type="button">
            {renderInfo?.tokens.some((token) => token.source === "ocr") ? "OCR erneut ausführen" : "OCR lokal durchführen"}
          </button>
        )}
        <p className="inspector-note">OCR-Kern, Sprachmodell und Bilddaten bleiben auf diesem Gerät.</p>
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
