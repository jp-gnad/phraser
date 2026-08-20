import type { OCRToken, OcrPageResult, PreprocessingRecipe } from "../models";
import { cacheOcrResult, getCachedOcrResult } from "../storage/database";

export interface OcrProgress {
  progress: number;
  status: string;
  fromCache?: boolean;
}

export class OcrEngine {
  private worker?: import("tesseract.js").Worker;

  async recognize(
    image: HTMLCanvasElement,
    page: number,
    documentFingerprint: string,
    recipe: PreprocessingRecipe,
    onProgress: (progress: OcrProgress) => void,
    signal?: AbortSignal,
  ): Promise<OcrPageResult> {
    const cacheKey = createOcrCacheKey(documentFingerprint, page, recipe);
    const cached = await getCachedOcrResult(cacheKey);
    if (cached) {
      onProgress({ progress: 1, status: "OCR-Ergebnis aus lokalem Cache", fromCache: true });
      return cached;
    }

    const tesseract = await import("tesseract.js");
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    const handleAbort = () => void this.terminate();
    signal?.addEventListener("abort", handleAbort, { once: true });

    try {
      this.worker ??= await tesseract.createWorker("deu", tesseract.OEM.LSTM_ONLY, {
        workerPath: `${baseUrl}tesseract/worker.min.js`,
        corePath: `${baseUrl}tesseract/core`,
        langPath: `${baseUrl}tesseract/lang`,
        gzip: true,
        cacheMethod: "write",
        logger: (message) => {
          onProgress({ progress: message.progress, status: translateOcrStatus(message.status) });
        },
      });

      if (signal?.aborted) throw new DOMException("OCR abgebrochen", "AbortError");

      const { data } = await this.worker.recognize(
        image,
        { rotateAuto: false },
        { text: true, blocks: true },
      );
      const tokens = flattenWords(data.blocks, page, image.width, image.height);
      const result: OcrPageResult = {
        page,
        tokens,
        aggregateConfidence: data.confidence,
        language: "deu",
        renderScale: image.width,
        recipe,
        cacheKey,
        createdAt: new Date().toISOString(),
      };
      await cacheOcrResult(result);
      onProgress({ progress: 1, status: "OCR abgeschlossen" });
      return result;
    } finally {
      signal?.removeEventListener("abort", handleAbort);
    }
  }

  async terminate(): Promise<void> {
    const worker = this.worker;
    this.worker = undefined;
    if (worker) await worker.terminate();
  }
}

function flattenWords(
  blocks: import("tesseract.js").Block[] | null,
  page: number,
  width: number,
  height: number,
): OCRToken[] {
  const tokens: OCRToken[] = [];
  for (const [blockIndex, block] of (blocks ?? []).entries()) {
    for (const [paragraphIndex, paragraph] of block.paragraphs.entries()) {
      for (const [lineIndex, line] of paragraph.lines.entries()) {
        for (const [wordIndex, word] of line.words.entries()) {
          const confidence = Math.max(0, Math.min(100, word.confidence));
          tokens.push({
            id: `ocr-${page}-${blockIndex}-${paragraphIndex}-${lineIndex}-${wordIndex}`,
            text: word.text,
            confidence,
            confidenceLevel: confidence >= 90 ? "safe" : confidence >= 70 ? "review" : "critical",
            page,
            bounds: {
              x: word.bbox.x0 / width,
              y: word.bbox.y0 / height,
              width: (word.bbox.x1 - word.bbox.x0) / width,
              height: (word.bbox.y1 - word.bbox.y0) / height,
            },
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

function createOcrCacheKey(
  fingerprint: string,
  page: number,
  recipe: PreprocessingRecipe,
): string {
  return `ocr-v1:${fingerprint}:${page}:${JSON.stringify(recipe)}`;
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

