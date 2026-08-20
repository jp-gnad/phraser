import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import {
  describePdfError,
  startPdfLoad,
  type PdfLoadProgress,
} from "../pdf/pdfEngine";

export type PdfDocumentStatus = "idle" | "loading" | "ready" | "error";

export interface PdfDocumentState {
  status: PdfDocumentStatus;
  file?: File;
  document?: PDFDocumentProxy;
  progress?: PdfLoadProgress;
  error?: string;
}

const initialState: PdfDocumentState = { status: "idle" };

export function usePdfDocument() {
  const [state, setState] = useState<PdfDocumentState>(initialState);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const requestIdRef = useRef(0);

  const releaseCurrentDocument = useCallback(async () => {
    requestIdRef.current += 1;

    if (loadingTaskRef.current) {
      await loadingTaskRef.current.destroy();
    }
    loadingTaskRef.current = null;
  }, []);

  const openFile = useCallback(
    async (file: File) => {
      await releaseCurrentDocument();
      const requestId = requestIdRef.current;
      setState({ status: "loading", file, progress: { loaded: 0 } });

      try {
        const handle = await startPdfLoad(file, (progress) => {
          if (requestId === requestIdRef.current) {
            setState((current) => ({ ...current, progress }));
          }
        });
        loadingTaskRef.current = handle.task;
        const document = await handle.document;

        if (requestId !== requestIdRef.current) {
          await handle.task.destroy();
          return;
        }

        setState({ status: "ready", file, document, progress: { loaded: file.size, total: file.size, percent: 100 } });
      } catch (error) {
        if (requestId === requestIdRef.current) {
          loadingTaskRef.current = null;
          setState({ status: "error", file, error: describePdfError(error) });
        }
      }
    },
    [releaseCurrentDocument],
  );

  const reset = useCallback(async () => {
    await releaseCurrentDocument();
    setState(initialState);
  }, [releaseCurrentDocument]);

  useEffect(() => {
    return () => {
      void releaseCurrentDocument();
    };
  }, [releaseCurrentDocument]);

  return { ...state, openFile, reset };
}
