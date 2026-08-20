import { useCallback, useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Inspector } from "./Inspector";
import { PageRail } from "./PageRail";
import { PdfCanvas, type PageRenderInfo } from "./PdfCanvas";
import { ViewerToolbar } from "./ViewerToolbar";

interface PdfWorkspaceProps {
  file: File;
  document: PDFDocumentProxy;
  onReplaceFile: () => void;
}

export function PdfWorkspace({ file, document, onReplaceFile }: PdfWorkspaceProps) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pageInfo, setPageInfo] = useState<Record<number, PageRenderInfo>>({});
  const [renderError, setRenderError] = useState<string>();

  useEffect(() => {
    setPage(1);
    setPageInfo({});
    setRenderError(undefined);
  }, [document]);

  const handleRenderInfo = useCallback(
    (info: PageRenderInfo) => {
      setRenderError(undefined);
      setPageInfo((current) => ({ ...current, [page]: info }));
    },
    [page],
  );

  const handleRenderError = useCallback((message: string) => setRenderError(message), []);

  return (
    <section className="workspace" aria-label="PDF-Arbeitsbereich">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">Dokument geöffnet</span>
          <h1>{file.name}</h1>
        </div>
        <button className="secondary-button" onClick={onReplaceFile} type="button">
          Andere PDF öffnen
        </button>
      </div>

      <div className="workspace-grid">
        <PageRail currentPage={page} onPageChange={setPage} pageCount={document.numPages} />
        <main className="viewer-panel">
          <ViewerToolbar
            onPageChange={setPage}
            onRotate={() => setRotation((current) => (current + 90) % 360)}
            onZoomChange={setZoom}
            page={page}
            pageCount={document.numPages}
            zoom={zoom}
          />
          <div className="canvas-viewport">
            {renderError ? (
              <div className="canvas-error" role="alert">{renderError}</div>
            ) : null}
            <div className="canvas-sheet">
              <PdfCanvas
                document={document}
                onError={handleRenderError}
                onRenderInfo={handleRenderInfo}
                page={page}
                rotation={rotation}
                zoom={zoom}
              />
            </div>
          </div>
        </main>
        <Inspector
          file={file}
          page={page}
          pageCount={document.numPages}
          renderInfo={pageInfo[page]}
        />
      </div>
    </section>
  );
}

