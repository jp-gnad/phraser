import type { ConfidenceThresholds, OCRToken, OcrPageResult, PageRotation, PreprocessingRecipe } from "../models";
import { cacheOcrResult, getCachedOcrResult } from "../storage/database";
import { inversePageRotation, rotateNormalizedRect } from "../utils/geometry";

export interface OcrProgress {
  progress: number;
  status: string;
  fromCache?: boolean;
}

export class OcrEngine {
  private worker?: import("tesseract.js").Worker;
  private workerInitialization?: Promise<import("tesseract.js").Worker>;
  private workerGeneration = 0;
  private progressHandler?: (progress: OcrProgress) => void;

  async recognize(
    image: HTMLCanvasElement,
    page: number,
    documentFingerprint: string,
    renderScale: number,
    pageRotation: PageRotation,
    recipe: PreprocessingRecipe,
    thresholds: ConfidenceThresholds,
    onProgress: (progress: OcrProgress) => void,
    signal?: AbortSignal,
  ): Promise<OcrPageResult> {
    throwIfAborted(signal);
    const cacheKey = createOcrCacheKey(documentFingerprint, page, renderScale, pageRotation, recipe);
    const cached = await getCachedOcrResult(cacheKey);
    throwIfAborted(signal);
    if (cached) {
      onProgress({ progress: 1, status: "OCR-Ergebnis aus lokalem Cache", fromCache: true });
      return applyThresholds(cached, thresholds);
    }

    const tesseract = await import("tesseract.js");
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    const handleAbort = () => void this.terminate();
    this.progressHandler = onProgress;
    signal?.addEventListener("abort", handleAbort, { once: true });

    try {
      throwIfAborted(signal);
      const worker = await this.getOrCreateWorker(tesseract, baseUrl);
      throwIfAborted(signal);

      const { data } = await worker.recognize(
        image,
        { rotateAuto: false },
        { text: true, blocks: true },
      );
      throwIfAborted(signal);
      const tokens = flattenWords(
        data.blocks,
        page,
        image.width,
        image.height,
        pageRotation,
        thresholds,
      );
      const result: OcrPageResult = {
        page,
        tokens,
        aggregateConfidence: data.confidence,
        language: "deu",
        renderScale,
        pageRotation,
        recipe,
        cacheKey,
        createdAt: new Date().toISOString(),
      };
      await cacheOcrResult(result);
      throwIfAborted(signal);
      onProgress({ progress: 1, status: "OCR abgeschlossen" });
      return result;
    } finally {
      if (this.progressHandler === onProgress) this.progressHandler = undefined;
      signal?.removeEventListener("abort", handleAbort);
    }
  }

  async terminate(): Promise<void> {
    this.workerGeneration += 1;
    const worker = this.worker;
    const initialization = this.workerInitialization;
    this.worker = undefined;
    this.workerInitialization = undefined;
    this.progressHandler = undefined;
    try {
      if (worker) await worker.terminate();
      if (initialization) await initialization;
    } catch {
      // Initialisierung und laufende Erkennung dürfen beim Abbruch kontrolliert verwerfen.
    }
  }

  private async getOrCreateWorker(
    tesseract: typeof import("tesseract.js"),
    baseUrl: string,
  ): Promise<import("tesseract.js").Worker> {
    if (this.worker) return this.worker;
    if (this.workerInitialization) return this.workerInitialization;

    const generation = this.workerGeneration;
    const initialization = (async () => {
      const worker = await tesseract.createWorker("deu", tesseract.OEM.LSTM_ONLY, {
        workerPath: `${baseUrl}tesseract/worker.min.js`,
        corePath: `${baseUrl}tesseract/core`,
        langPath: `${baseUrl}tesseract/lang`,
        gzip: true,
        cacheMethod: "write",
        logger: (message) => {
          this.progressHandler?.({
            progress: message.progress,
            status: translateOcrStatus(message.status),
          });
        },
      });
      if (generation !== this.workerGeneration) {
        try {
          await worker.terminate();
        } finally {
          throw new DOMException("OCR abgebrochen", "AbortError");
        }
      }
      this.worker = worker;
      return worker;
    })();
    this.workerInitialization = initialization;
    try {
      return await initialization;
    } finally {
      if (this.workerInitialization === initialization) this.workerInitialization = undefined;
    }
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("OCR abgebrochen", "AbortError");
}

function flattenWords(
  blocks: import("tesseract.js").Block[] | null,
  page: number,
  width: number,
  height: number,
  pageRotation: PageRotation,
  thresholds: ConfidenceThresholds,
): OCRToken[] {
  const tokens: OCRToken[] = [];
  for (const [blockIndex, block] of (blocks ?? []).entries()) {
    for (const [paragraphIndex, paragraph] of block.paragraphs.entries()) {
      for (const [lineIndex, line] of paragraph.lines.entries()) {
        for (const [wordIndex, word] of line.words.entries()) {
          const confidence = Math.max(0, Math.min(100, word.confidence));
          const recognizedBounds = {
            x: word.bbox.x0 / width,
            y: word.bbox.y0 / height,
            width: (word.bbox.x1 - word.bbox.x0) / width,
            height: (word.bbox.y1 - word.bbox.y0) / height,
          };
          tokens.push({
            id: `ocr-${page}-${blockIndex}-${paragraphIndex}-${lineIndex}-${wordIndex}`,
            text: word.text,
            confidence,
            confidenceLevel: confidence >= thresholds.safe ? "safe" : confidence >= thresholds.review ? "review" : "critical",
            page,
            bounds: rotateNormalizedRect(recognizedBounds, inversePageRotation(pageRotation)),
            source: "ocr",
            lineId: `ocr-line-${page}-${blockIndex}-${paragraphIndex}-${lineIndex}`,
            blockId: `ocr-block-${page}-${blockIndex}`,
          });
        }
      }
    }
  }
  return tokens;
}

function applyThresholds(result: OcrPageResult, thresholds: ConfidenceThresholds): OcrPageResult {
  return {
    ...result,
    tokens: result.tokens.map((token) => ({
      ...token,
      confidenceLevel: token.confidence >= thresholds.safe
        ? "safe"
        : token.confidence >= thresholds.review
          ? "review"
          : "critical",
    })),
  };
}

function createOcrCacheKey(
  fingerprint: string,
  page: number,
  renderScale: number,
  pageRotation: PageRotation,
  recipe: PreprocessingRecipe,
): string {
  return `ocr-v2:${fingerprint}:${page}:${pageRotation}:${renderScale}:${JSON.stringify(recipe)}`;
}

function translateOcrStatus(status: string): string {
  const labels: Record<string, string> = {
    "loading tesseract core": "OCR-Kern wird geladen",
    "initializing tesseract": "OCR wird initialisiert",
    "loading language traineddata": "Deutsches Sprachmodell wird geladen",
    "initializing api": "Sprachmodell wird initialisiert",
    "recognizing text": "Text wird erkannt",
  };
  return labels[status] ?? status;
}
