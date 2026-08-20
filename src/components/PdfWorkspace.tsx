import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PreprocessingRecipe } from "../models";
import { OcrEngine, type OcrProgress } from "../ocr/ocrEngine";
import { preprocessPage } from "../preprocessing/preprocessPage";
import { renderPageToCanvas } from "../pdf/renderPage";
import { Inspector } from "./Inspector";
import { OptimizedPageCanvas } from "./OptimizedPageCanvas";
import { PageRail } from "./PageRail";
import { PdfCanvas, type PageRenderInfo } from "./PdfCanvas";
import { TokenOverlay } from "./TokenOverlay";
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
  const [showTokens, setShowTokens] = useState(true);
  const [viewMode, setViewMode] = useState<"original" | "optimized">("original");
  const [optimizedPages, setOptimizedPages] = useState<Record<number, HTMLCanvasElement>>({});
  const [ocrProgress, setOcrProgress] = useState<OcrProgress>();
  const [ocrRunning, setOcrRunning] = useState(false);
  const [recipe, setRecipe] = useState<PreprocessingRecipe>({
    grayscale: true,
    contrast: 1.2,
    adaptiveThreshold: true,
    threshold: 155,
    denoise: false,
    deskewDegrees: 0,
    cropDarkBorders: true,
  });
  const ocrEngineRef = useRef(new OcrEngine());
  const abortControllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    setPage(1);
    setPageInfo({});
    setRenderError(undefined);
    setOptimizedPages({});
    setViewMode("original");
  }, [document]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      void ocrEngineRef.current.terminate();
    };
  }, []);

  const handleRenderInfo = useCallback(
    (info: PageRenderInfo) => {
      setRenderError(undefined);
      setPageInfo((current) => ({ ...current, [page]: info }));
    },
    [page],
  );

  const handleRenderError = useCallback((message: string) => setRenderError(message), []);

  async function runOcr() {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setOcrRunning(true);
    setRenderError(undefined);
    setRotation(0);

    try {
      setOcrProgress({ progress: 0.03, status: "PDF-Seite wird in OCR-Auflösung gerendert" });
      const source = await renderPageToCanvas(document, page, 2.5, controller.signal);
      const optimized = await preprocessPage(
        source,
        recipe,
        (progress) => setOcrProgress({ progress: progress * 0.18, status: "Bild wird optimiert" }),
        controller.signal,
      );
      setOptimizedPages((current) => ({ ...current, [page]: optimized }));
      setViewMode("optimized");

      const fingerprint = document.fingerprints[0] ?? `${file.name}-${file.size}-${file.lastModified}`;
      const result = await ocrEngineRef.current.recognize(
        optimized,
        page,
        fingerprint,
        recipe,
        (progress) =>
          setOcrProgress({
            ...progress,
            progress: 0.18 + progress.progress * 0.82,
          }),
        controller.signal,
      );
      setPageInfo((current) => {
        const previous = current[page];
        if (!previous) return current;
        return {
          ...current,
          [page]: { ...previous, tokens: result.tokens },
        };
      });
      setShowTokens(true);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setRenderError(error instanceof Error ? error.message : "OCR ist fehlgeschlagen.");
      }
    } finally {
      setOcrRunning(false);
      abortControllerRef.current = undefined;
    }
  }

  function cancelOcr() {
    abortControllerRef.current?.abort();
    setOcrProgress({ progress: 0, status: "OCR abgebrochen" });
  }

  const currentInfo = pageInfo[page];
  const optimizedPage = optimizedPages[page];

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
            onShowTokensChange={setShowTokens}
            onViewModeChange={setViewMode}
            onZoomChange={setZoom}
            optimizedAvailable={Boolean(optimizedPage)}
            page={page}
            pageCount={document.numPages}
            showTokens={showTokens}
            viewMode={viewMode}
            zoom={zoom}
          />
          <div className="canvas-viewport">
            {renderError ? (
              <div className="canvas-error" role="alert">{renderError}</div>
            ) : null}
            <div className="canvas-sheet">
              <div className={viewMode === "optimized" && optimizedPage ? "is-visually-hidden" : undefined}>
                <PdfCanvas
                  document={document}
                  onError={handleRenderError}
                  onRenderInfo={handleRenderInfo}
                  page={page}
                  rotation={rotation}
                  zoom={zoom}
                />
              </div>
              {viewMode === "optimized" && optimizedPage && currentInfo ? (
                <OptimizedPageCanvas
                  displayHeight={currentInfo.height}
                  displayWidth={currentInfo.width}
                  source={optimizedPage}
                />
              ) : null}
              {showTokens && currentInfo ? (
                <TokenOverlay
                  rotation={rotation}
                  selectedTokenIds={[]}
                  tokens={currentInfo.tokens}
                />
              ) : null}
            </div>
          </div>
        </main>
        <Inspector
          file={file}
          page={page}
          pageCount={document.numPages}
          renderInfo={currentInfo}
          recipe={recipe}
          onRecipeChange={setRecipe}
          onRunOcr={() => void runOcr()}
          onCancelOcr={cancelOcr}
          ocrProgress={ocrProgress}
          ocrRunning={ocrRunning}
        />
      </div>
    </section>
  );
}
