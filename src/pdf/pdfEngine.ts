import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfLoadProgress {
  loaded: number;
  total?: number;
  percent?: number;
}

export interface PdfLoadHandle {
  task: PDFDocumentLoadingTask;
  document: Promise<PDFDocumentProxy>;
}

export function startPdfLoad(
  file: File,
  onProgress: (progress: PdfLoadProgress) => void,
): Promise<PdfLoadHandle> {
  return file.arrayBuffer().then((buffer) => {
    assertPdfSignature(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 1024)));

    const task = getDocument({ data: new Uint8Array(buffer) });
    task.onProgress = ({ loaded, total }) => {
      onProgress({
        loaded,
        total: total || undefined,
        percent: total ? Math.min(100, Math.round((loaded / total) * 100)) : undefined,
      });
    };

    return { task, document: task.promise };
  });
}

function assertPdfSignature(bytes: Uint8Array): void {
  const signature = new TextDecoder("latin1").decode(bytes);
  if (!signature.includes("%PDF-")) {
    throw new Error("Die Datei enthält keine gültige PDF-Signatur.");
  }
}

export function describePdfError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "PasswordException") {
      return "Die PDF ist kennwortgeschützt und kann in Phase 1 noch nicht geöffnet werden.";
    }

    if (/Invalid PDF|PDF-Signatur/i.test(error.message)) {
      return "Die Datei ist beschädigt oder keine gültige PDF-Datei.";
    }

    if (/Missing PDF/i.test(error.message)) {
      return "Die PDF-Datei konnte nicht gelesen werden.";
    }
  }

  return "Die PDF konnte nicht geöffnet werden. Bitte prüfen Sie die Datei und versuchen Sie es erneut.";
}

