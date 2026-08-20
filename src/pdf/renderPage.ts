import type { PDFDocumentProxy } from "pdfjs-dist";

export async function renderPageToCanvas(
  document: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation: 0 });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Die PDF-Seite kann nicht gerendert werden.");

  const renderTask = page.render({ canvas, canvasContext: context, viewport });
  const handleAbort = () => renderTask.cancel();
  signal?.addEventListener("abort", handleAbort, { once: true });
  try {
    await renderTask.promise;
    return canvas;
  } finally {
    signal?.removeEventListener("abort", handleAbort);
  }
}

