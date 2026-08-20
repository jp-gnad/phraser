import type { PageRotation } from "../models";

interface ViewerToolbarProps {
  page: number;
  pageCount: number;
  previousPage?: number;
  nextPage?: number;
  zoom: number;
  rotation: PageRotation;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onRotate: () => void;
  showTokens: boolean;
  onShowTokensChange: (visible: boolean) => void;
  viewMode: "original" | "optimized";
  optimizedAvailable: boolean;
  onViewModeChange: (mode: "original" | "optimized") => void;
}

export function ViewerToolbar({
  page,
  pageCount,
  previousPage,
  nextPage,
  zoom,
  rotation,
  onPageChange,
  onZoomChange,
  onRotate,
  showTokens,
  onShowTokensChange,
  viewMode,
  optimizedAvailable,
  onViewModeChange,
}: ViewerToolbarProps) {
  return (
    <div className="viewer-toolbar" role="toolbar" aria-label="PDF-Ansicht">
      <div className="toolbar-group">
        <button
          aria-label="Vorherige Seite"
          disabled={previousPage === undefined}
          onClick={() => previousPage !== undefined && onPageChange(previousPage)}
          type="button"
        >
          ←
        </button>
        <span className="page-position">
          <strong>{page}</strong>
          <span>/ {pageCount}</span>
        </span>
        <button
          aria-label="Nächste Seite"
          disabled={nextPage === undefined}
          onClick={() => nextPage !== undefined && onPageChange(nextPage)}
          type="button"
        >
          →
        </button>
      </div>

      <div className="toolbar-segmented" aria-label="Seitenansicht">
        <button
          aria-pressed={viewMode === "original"}
          className={viewMode === "original" ? "is-active" : ""}
          onClick={() => onViewModeChange("original")}
          type="button"
        >
          Original
        </button>
        <button
          aria-pressed={viewMode === "optimized"}
          className={viewMode === "optimized" ? "is-active" : ""}
          disabled={!optimizedAvailable}
          onClick={() => onViewModeChange("optimized")}
          type="button"
        >
          OCR-optimiert
        </button>
        <label>
          <input
            checked={showTokens}
            onChange={(event) => onShowTokensChange(event.target.checked)}
            type="checkbox"
          />
          Boxen
        </label>
      </div>

      <div className="toolbar-group">
        <button
          aria-label="Verkleinern"
          disabled={zoom <= 0.5}
          onClick={() => onZoomChange(Math.max(0.5, zoom - 0.15))}
          type="button"
        >
          −
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)} %</span>
        <button
          aria-label="Vergrößern"
          disabled={zoom >= 2.5}
          onClick={() => onZoomChange(Math.min(2.5, zoom + 0.15))}
          type="button"
        >
          +
        </button>
        <button
          aria-label={`Seite im Uhrzeigersinn drehen, aktuell ${rotation} Grad`}
          onClick={onRotate}
          title="OCR-Ausrichtung dieser Seite um 90° drehen"
          type="button"
        >
          ↻
        </button>
        <span className="rotation-label">{rotation}°</span>
      </div>
    </div>
  );
}
