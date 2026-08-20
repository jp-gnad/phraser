interface PageRailProps {
  pageCount: number;
  currentPage: number;
  excludedPages: number[];
  canManagePages: boolean;
  onPageChange: (page: number) => void;
  onPageExclusionToggle: (page: number) => void;
}

export function PageRail({
  pageCount,
  currentPage,
  excludedPages,
  canManagePages,
  onPageChange,
  onPageExclusionToggle,
}: PageRailProps) {
  const includedCount = pageCount - excludedPages.length;

  return (
    <aside className="page-rail" aria-label="PDF-Seiten">
      <div className="page-rail-heading">
        <span>Seiten</span>
        <span title={`${includedCount} von ${pageCount} Seiten aktiv`}>{includedCount}/{pageCount}</span>
      </div>
      <div className="page-list">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => {
          const excluded = excludedPages.includes(page);
          return (
            <div className={`page-tile-card${excluded ? " is-excluded" : ""}`} key={page}>
              <button
                aria-current={page === currentPage ? "page" : undefined}
                className={page === currentPage ? "page-tile is-active" : "page-tile"}
                disabled={excluded && !canManagePages}
                onClick={() => onPageChange(page)}
                type="button"
              >
                <span className="page-paper" aria-hidden="true">
                  {page}
                </span>
                <span>{excluded ? "Ausgeschlossen" : `Seite ${page}`}</span>
              </button>
              {canManagePages ? (
                <button
                  aria-label={excluded ? `Seite ${page} wieder aufnehmen` : `Seite ${page} ausschließen`}
                  className="page-exclusion-toggle"
                  disabled={!excluded && includedCount <= 1}
                  onClick={() => onPageExclusionToggle(page)}
                  title={excluded ? "Seite wieder für OCR und Extraktion aufnehmen" : "Seite von OCR und Extraktion ausschließen"}
                  type="button"
                >
                  {excluded ? "+" : "×"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
