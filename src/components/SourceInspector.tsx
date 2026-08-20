import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { NormalizedRect } from "../models";
import { renderPageToCanvas } from "../pdf/renderPage";

export interface SourceInspection {
  page: number;
  bounds: NormalizedRect[];
  raw: string;
  corrected?: string;
  confidence?: number;
  sourceKind?: string;
}

interface SourceInspectorProps {
  document: PDFDocumentProxy;
  inspection: SourceInspection;
  onClose: () => void;
}

export function SourceInspector({ document, inspection, onClose }: SourceInspectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    void renderPageToCanvas(document, inspection.page, 2, controller.signal)
      .then((source) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) return;
        const bounds = inspection.bounds.length ? unionBounds(inspection.bounds) : { x: 0, y: 0, width: 1, height: 1 };
        const paddingX = Math.max(bounds.width * 0.2, 0.015);
        const paddingY = Math.max(bounds.height * 1.2, 0.015);
        const x = Math.max(0, bounds.x - paddingX) * source.width;
        const y = Math.max(0, bounds.y - paddingY) * source.height;
        const width = Math.min(1 - Math.max(0, bounds.x - paddingX), bounds.width + paddingX * 2) * source.width;
        const height = Math.min(1 - Math.max(0, bounds.y - paddingY), bounds.height + paddingY * 2) * source.height;
        const scale = Math.min(1, 520 / Math.max(width, 1));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
      })
      .catch(() => setError("Originalausschnitt konnte nicht gerendert werden."));
    return () => controller.abort();
  }, [document, inspection]);

  return (
    <aside className="inspector source-inspector" aria-label="PDF-Quelle">
      <section className="inspector-section source-heading">
        <div><span className="inspector-kicker">Quellverknüpfung</span><h2>Seite {inspection.page}</h2></div>
        <button aria-label="Quellansicht schließen" onClick={onClose} type="button">×</button>
      </section>
      <section className="inspector-section">
        <span className="inspector-kicker">Originalausschnitt</span>
        {error ? <p className="warning-note">{error}</p> : <canvas className="source-crop" ref={canvasRef} />}
      </section>
      <section className="inspector-section source-values">
        <dl>
          <div><dt>OCR-/PDF-Rohwert</dt><dd>{inspection.raw || "–"}</dd></div>
          <div><dt>Korrigierter Wert</dt><dd>{inspection.corrected || inspection.raw || "–"}</dd></div>
          <div><dt>Confidence</dt><dd>{inspection.confidence === undefined ? "–" : `${Math.round(inspection.confidence)} %`}</dd></div>
          <div><dt>Quelle</dt><dd>{inspection.sourceKind === "ocr" ? "OCR" : inspection.sourceKind === "pdf-text" ? "PDF-Textebene" : "manuell"}</dd></div>
        </dl>
        <p>Die markierten Boxen im Viewer zeigen die exakte Position der exportierten Quelle.</p>
      </section>
    </aside>
  );
}

function unionBounds(bounds: NormalizedRect[]): NormalizedRect {
  const x = Math.min(...bounds.map((item) => item.x));
  const y = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  return { x, y, width: right - x, height: bottom - y };
}

