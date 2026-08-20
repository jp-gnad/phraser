import { useEffect, useRef } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { TextLayerAssessment } from "../models";
import {
  assessTextLayer,
  textItemsToTokens,
  type TextItemLike,
} from "../pdf/pageAnalysis";

export interface PageRenderInfo {
  width: number;
  height: number;
  assessment: TextLayerAssessment;
  tokens: import("../models").OCRToken[];
}

interface PdfCanvasProps {
  document: PDFDocumentProxy;
  page: number;
  zoom: number;
  rotation: number;
  onRenderInfo: (info: PageRenderInfo) => void;
  onError: (message: string) => void;
}

export function PdfCanvas({
  document,
  page,
  zoom,
  rotation,
  onRenderInfo,
  onError,
}: PdfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    let renderTask: RenderTask | undefined;

    async function renderPage() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const pdfPage = await document.getPage(page);
        if (!active) return;

        const viewport = pdfPage.getViewport({ scale: zoom, rotation });
        const outputScale = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        renderTask = pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });

        const [textContent] = await Promise.all([pdfPage.getTextContent(), renderTask.promise]);
        if (!active) return;

        const items = textContent.items.filter(
          (item): item is typeof item & TextItemLike => "str" in item,
        );
        onRenderInfo({
          width: viewport.width,
          height: viewport.height,
          assessment: assessTextLayer(items),
          tokens: textItemsToTokens(items, pdfPage.getViewport({ scale: 1, rotation: 0 }), page),
        });
      } catch (error) {
        if (!active || (error instanceof Error && error.name === "RenderingCancelledException")) {
          return;
        }
        onError("Diese Seite konnte nicht dargestellt werden.");
      }
    }

    void renderPage();

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, onError, onRenderInfo, page, rotation, zoom]);

  return <canvas className="pdf-canvas" ref={canvasRef} />;
}
