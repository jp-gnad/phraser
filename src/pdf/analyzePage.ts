import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OCRToken, TextLayerAssessment } from "../models";
import { assessTextLayer, textItemsToTokens, type TextItemLike } from "./pageAnalysis";

export interface AnalyzedPdfPage {
  width: number;
  height: number;
  assessment: TextLayerAssessment;
  tokens: OCRToken[];
}

export async function analyzePdfPage(
  document: PDFDocumentProxy,
  pageNumber: number,
): Promise<AnalyzedPdfPage> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  const content = await page.getTextContent();
  const items = content.items.filter(
    (item): item is typeof item & TextItemLike => "str" in item,
  );
  return {
    width: viewport.width,
    height: viewport.height,
    assessment: assessTextLayer(items),
    tokens: textItemsToTokens(items, viewport, pageNumber),
  };
}

