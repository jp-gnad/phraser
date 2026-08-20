interface ViewerToolbarProps {
  page: number;
  pageCount: number;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onRotate: () => void;
}

export function ViewerToolbar({
  page,
  pageCount,
  zoom,
  onPageChange,
  onZoomChange,
  onRotate,
}: ViewerToolbarProps) {
  return (
    <div className="viewer-toolbar" role="toolbar" aria-label="PDF-Ansicht">
      <div className="toolbar-group">
        <button
          aria-label="Vorherige Seite"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
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
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          →
        </button>
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
        <button aria-label="Im Uhrzeigersinn drehen" onClick={onRotate} type="button">
          ↻
        </button>
      </div>
    </div>
  );
}

