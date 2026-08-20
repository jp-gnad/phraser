import type { PageRenderInfo } from "./PdfCanvas";
import { formatFileSize } from "../utils/fileValidation";

interface InspectorProps {
  file: File;
  page: number;
  pageCount: number;
  renderInfo?: PageRenderInfo;
}

const qualityLabels = {
  good: "Textebene erkannt",
  poor: "Textebene prüfen",
  missing: "Scan / keine Textebene",
  unknown: "Noch nicht analysiert",
} as const;

export function Inspector({ file, page, pageCount, renderInfo }: InspectorProps) {
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
          Die automatische Qualitätsentscheidung und OCR werden in Phase 2 ergänzt. In Phase 1
          dient dieser Wert nur als transparente Ersteinschätzung.
        </p>
      </section>

      <section className="inspector-section next-step-card">
        <span className="inspector-kicker">Danach</span>
        <h3>Einzelbereiche markieren</h3>
        <p>
          Ergebnisblöcke werden später ausdrücklich als Einzel, Mannschaft/Staffel oder
          ignoriert klassifiziert. Nur bestätigte Einzelblöcke dürfen in den Export.
        </p>
        <button disabled type="button">In Phase 3 verfügbar</button>
      </section>
    </aside>
  );
}

