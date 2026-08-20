interface PageRailProps {
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function PageRail({ pageCount, currentPage, onPageChange }: PageRailProps) {
  return (
    <aside className="page-rail" aria-label="PDF-Seiten">
      <div className="page-rail-heading">
        <span>Seiten</span>
        <span>{pageCount}</span>
      </div>
      <div className="page-list">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
          <button
            aria-current={page === currentPage ? "page" : undefined}
            className={page === currentPage ? "page-tile is-active" : "page-tile"}
            key={page}
            onClick={() => onPageChange(page)}
            type="button"
          >
            <span className="page-paper" aria-hidden="true">
              {page}
            </span>
            <span>Seite {page}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

