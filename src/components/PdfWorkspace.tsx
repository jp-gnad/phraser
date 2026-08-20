import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type {
  BlockClassification,
  ConfidenceThresholds,
  DisciplineDefinition,
  GlobalFieldRule,
  MappingRule,
  MappingTarget,
  MappingTemplate,
  NormalizedRect,
  OcrBatchPageState,
  PageRotation,
  PreprocessingRecipe,
  ResultBlock,
  IndividualCompetitionResult,
  WorkspaceDomainState,
  WorkspaceMetadata,
} from "../models";
import { extractResults } from "../extraction/extractResults";
import { useUndoableState } from "../hooks/useUndoableState";
import { OcrEngine, type OcrProgress } from "../ocr/ocrEngine";
import {
  combineOcrBatchProgress,
  normalizeOcrPageSelection,
  OcrBatchRunController,
} from "../ocr/ocrBatch";
import { analyzePdfPage } from "../pdf/analyzePage";
import { renderPageToCanvas } from "../pdf/renderPage";
import { preprocessPage } from "../preprocessing/preprocessPage";
import { loadWorkspaceSession, saveWorkspaceSession } from "../storage/database";
import { normalizeGender, normalizeTime } from "../utils/normalization";
import { validateResult } from "../validation/validateResult";
import { CsvExportPanel } from "./CsvExportPanel";
import { Inspector } from "./Inspector";
import { MappingInspector } from "./MappingInspector";
import { OptimizedPageCanvas } from "./OptimizedPageCanvas";
import { PageRail } from "./PageRail";
import { PdfCanvas, type PageRenderInfo } from "./PdfCanvas";
import type { AppPhase } from "./PhaseNavigation";
import { RegionOverlay } from "./RegionOverlay";
import { ResultsGrid } from "./ResultsGrid";
import { SourceInspector, type SourceInspection } from "./SourceInspector";
import { TokenOverlay } from "./TokenOverlay";
import { ViewerToolbar } from "./ViewerToolbar";
import { WorkflowGuide, type WorkflowGuideMetrics } from "./WorkflowGuide";

interface PdfWorkspaceProps {
  file: File;
  document: PDFDocumentProxy;
  activePhase: AppPhase;
  onPhaseChange: (phase: AppPhase) => void;
  onReplaceFile: () => void;
}

const initialDomainState: WorkspaceDomainState = {
  schemaVersion: 1,
  mappingMode: "columns",
  resultBlocks: [],
  fieldRules: [],
  disciplines: [],
  metadata: {},
  globalRules: [],
  results: [],
  excludedPages: [],
  pageRotations: {},
};

export function PdfWorkspace({
  file,
  document,
  activePhase,
  onPhaseChange,
  onReplaceFile,
}: PdfWorkspaceProps) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pageInfo, setPageInfo] = useState<Record<number, PageRenderInfo>>({});
  const [renderError, setRenderError] = useState<string>();
  const [showTokens, setShowTokens] = useState(true);
  const [viewMode, setViewMode] = useState<"original" | "optimized">("original");
  const [optimizedPages, setOptimizedPages] = useState<Record<number, HTMLCanvasElement>>({});
  const [ocrProgress, setOcrProgress] = useState<OcrProgress>();
  const [ocrRunning, setOcrRunning] = useState(false);
  const [previewProgress, setPreviewProgress] = useState<OcrProgress>();
  const [previewRunning, setPreviewRunning] = useState(false);
  const [ocrSelectedPages, setOcrSelectedPages] = useState<number[]>([1]);
  const [ocrPageStates, setOcrPageStates] = useState<Record<number, OcrBatchPageState>>({});
  const [recipe, setRecipe] = useState<PreprocessingRecipe>({
    grayscale: true,
    contrast: 1.2,
    adaptiveThreshold: true,
    threshold: 155,
    denoise: false,
    deskewDegrees: 0,
    cropDarkBorders: true,
  });
  const [confidenceThresholds, setConfidenceThresholds] = useState<ConfidenceThresholds>({ safe: 90, review: 70 });
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string>();
  const [drawingBlock, setDrawingBlock] = useState(false);
  const [extractionBusy, setExtractionBusy] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<string>();
  const [sessionReady, setSessionReady] = useState(false);
  const [sourceInspection, setSourceInspection] = useState<SourceInspection>();
  const ocrEngineRef = useRef(new OcrEngine());
  const ocrRunControllerRef = useRef(new OcrBatchRunController());
  const previewRunControllerRef = useRef(new OcrBatchRunController());
  const domain = useUndoableState(initialDomainState);
  const sessionId = useMemo(
    () => document.fingerprints[0] ?? `${file.name}-${file.size}-${file.lastModified}`,
    [document.fingerprints, file.lastModified, file.name, file.size],
  );
  const allPages = useMemo(
    () => Array.from({ length: document.numPages }, (_, index) => index + 1),
    [document.numPages],
  );
  const includedPages = useMemo(
    () => allPages.filter((pageNumber) => !domain.state.excludedPages.includes(pageNumber)),
    [allPages, domain.state.excludedPages],
  );
  const navigablePages = activePhase === "file" ? allPages : includedPages;
  const navigationIndex = navigablePages.indexOf(page);
  const previousPage = navigationIndex > 0 ? navigablePages[navigationIndex - 1] : undefined;
  const nextPage = navigationIndex >= 0 && navigationIndex < navigablePages.length - 1
    ? navigablePages[navigationIndex + 1]
    : undefined;
  const rotation = domain.state.pageRotations[page] ?? 0;

  useEffect(() => {
    let active = true;
    setPage(1);
    setPageInfo({});
    setRenderError(undefined);
    setOptimizedPages({});
    setOcrProgress(undefined);
    previewRunControllerRef.current.cancel();
    setPreviewProgress(undefined);
    setPreviewRunning(false);
    setOcrSelectedPages([1]);
    setOcrPageStates({});
    setViewMode("original");
    setSelectedTokenIds([]);
    setActiveBlockId(undefined);
    setSessionReady(false);
    domain.reset(initialDomainState);
    void loadWorkspaceSession(sessionId).then((saved) => {
      if (!active) return;
      if (saved?.schemaVersion === 1) {
        domain.reset({
          ...initialDomainState,
          ...saved,
          globalRules: saved.globalRules ?? [],
          excludedPages: saved.excludedPages ?? [],
          pageRotations: saved.pageRotations ?? {},
        });
        setActiveBlockId(saved.resultBlocks[0]?.id);
        setWorkspaceMessage("Lokale Sitzung wiederhergestellt.");
      }
      setSessionReady(true);
    });
    return () => {
      active = false;
    };
  }, [document, sessionId]);

  useEffect(() => {
    if (!sessionReady) return;
    const timeout = window.setTimeout(() => {
      void saveWorkspaceSession(sessionId, domain.state);
    }, 550);
    return () => window.clearTimeout(timeout);
  }, [domain.state, sessionId, sessionReady]);

  useEffect(() => {
    if (activePhase === "mapping") {
      setShowTokens(true);
      setSourceInspection(undefined);
      setSelectedTokenIds([]);
    }
  }, [activePhase]);

  useEffect(() => {
    setOcrSelectedPages((current) => {
      const normalized = normalizeOcrPageSelection(current, includedPages);
      return arraysEqual(current, normalized) ? current : normalized;
    });
    setOcrPageStates((current) => Object.fromEntries(
      Object.entries(current).filter(([pageNumber]) => includedPages.includes(Number(pageNumber))),
    ));
  }, [includedPages]);

  useEffect(() => {
    if (activePhase !== "ocr") return;
    setOcrSelectedPages((current) => {
      if (current.length > 0) return current;
      const fallback = includedPages.includes(page) ? page : includedPages[0];
      return fallback ? [fallback] : [];
    });
  }, [activePhase, includedPages, page]);

  useEffect(() => {
    if (activePhase === "file" || !domain.state.excludedPages.includes(page)) return;
    setPage(findNearestPage(page, includedPages));
  }, [activePhase, domain.state.excludedPages, includedPages, page]);

  useEffect(() => {
    return () => {
      ocrRunControllerRef.current.cancel();
      previewRunControllerRef.current.cancel();
      void ocrEngineRef.current.terminate();
    };
  }, []);

  const handleRenderInfo = useCallback(
    (info: PageRenderInfo) => {
      setRenderError(undefined);
      setPageInfo((current) => {
        const previous = current[page];
        const hasOcr = previous?.tokens.some((token) => token.source === "ocr");
        return { ...current, [page]: hasOcr && previous ? { ...info, tokens: previous.tokens } : info };
      });
    },
    [page],
  );

  const handleRenderError = useCallback((message: string) => setRenderError(message), []);

  function changePage(nextPage: number) {
    if (activePhase !== "file" && domain.state.excludedPages.includes(nextPage)) return;
    cancelOcrPreview();
    setPage(nextPage);
    setSelectedTokenIds([]);
    setDrawingBlock(false);
    const nextBlock = domain.state.resultBlocks.find((block) => block.pages.includes(nextPage));
    setActiveBlockId(nextBlock?.id);
  }

  function togglePageExclusion(targetPage: number) {
    const currentlyExcluded = domain.state.excludedPages.includes(targetPage);
    if (currentlyExcluded) {
      domain.update((current) => ({
        ...current,
        excludedPages: current.excludedPages.filter((pageNumber) => pageNumber !== targetPage),
      }));
      setWorkspaceMessage(`Seite ${targetPage} ist wieder für OCR und Extraktion aktiv.`);
      return;
    }

    if (includedPages.length <= 1) {
      setWorkspaceMessage("Mindestens eine PDF-Seite muss aktiv bleiben.");
      return;
    }

    if (ocrRunning && ocrSelectedPages.includes(targetPage)) cancelOcr();
    cancelOcrPreview();
    const remainingPages = includedPages.filter((pageNumber) => pageNumber !== targetPage);
    domain.update((current) => {
      const resultBlocks = current.resultBlocks.flatMap((block) => {
        if (!block.pages.includes(targetPage)) return [block];
        const pages = block.pages.filter((pageNumber) => pageNumber !== targetPage);
        if (pages.length === 0) return [];
        const boundsByPage = { ...block.boundsByPage };
        delete boundsByPage[targetPage];
        return [{ ...block, pages, boundsByPage }];
      });
      const retainedBlockIds = new Set(resultBlocks.map((block) => block.id));
      return {
        ...current,
        excludedPages: [...current.excludedPages, targetPage].sort((left, right) => left - right),
        resultBlocks,
        fieldRules: current.fieldRules.filter((rule) => rule.samplePage !== targetPage),
        globalRules: removePageFromGlobalRules(current.globalRules, targetPage, retainedBlockIds),
        results: [],
      };
    });
    setSourceInspection(undefined);
    setSelectedTokenIds([]);
    setDrawingBlock(false);
    if (targetPage === page) setPage(findNearestPage(targetPage, remainingPages));
    setWorkspaceMessage(`Seite ${targetPage} ausgeschlossen. Sie wird nicht per OCR verarbeitet oder extrahiert.`);
  }

  function rotateCurrentPage() {
    if (ocrRunning) cancelOcr();
    cancelOcrPreview();
    const nextRotation = ((rotation + 90) % 360) as PageRotation;
    domain.update((current) => ({
      ...current,
      pageRotations: { ...current.pageRotations, [page]: nextRotation },
      results: [],
    }));
    setPageInfo((current) => {
      const currentPageInfo = current[page];
      if (!currentPageInfo) return current;
      return {
        ...current,
        [page]: {
          ...currentPageInfo,
          tokens: currentPageInfo.tokens.filter((token) => token.source !== "ocr"),
        },
      };
    });
    setOptimizedPages((current) => {
      if (!current[page]) return current;
      const next = { ...current };
      delete next[page];
      return next;
    });
    setOcrPageStates((current) => {
      if (!current[page]) return current;
      const next = { ...current };
      delete next[page];
      return next;
    });
    setViewMode("original");
    setOcrProgress(undefined);
    setSelectedTokenIds([]);
    setWorkspaceMessage(`Seite ${page} auf ${nextRotation}° gedreht. OCR berücksichtigt diese Ausrichtung beim nächsten Lauf.`);
  }

  async function runOcrPreview() {
    const controller = previewRunControllerRef.current.start();
    if (!controller) return;
    const previewPage = page;
    const previewRotation = rotation;
    const isCurrentPreview = () => previewRunControllerRef.current.isCurrent(controller);
    const ensureCurrentPreview = () => {
      if (!isCurrentPreview() || controller.signal.aborted) {
        throw new DOMException("Vorschau abgebrochen", "AbortError");
      }
    };
    setPreviewRunning(true);
    setPreviewProgress({ progress: 0.03, status: `Seite ${previewPage} wird gerendert` });
    setRenderError(undefined);

    try {
      const source = await renderPageToCanvas(
        document,
        previewPage,
        2.5,
        controller.signal,
        previewRotation,
      );
      ensureCurrentPreview();
      const optimized = await preprocessPage(
        source,
        recipe,
        (progress) => {
          if (!isCurrentPreview()) return;
          setPreviewProgress({
            progress: 0.08 + progress * 0.92,
            status: "OCR-Einstellungen werden auf die Vorschau angewendet",
          });
        },
        controller.signal,
      );
      ensureCurrentPreview();
      setOptimizedPages((current) => ({ ...current, [previewPage]: optimized }));
      setViewMode("optimized");
      setPreviewProgress({ progress: 1, status: `Vorschau für Seite ${previewPage} ist bereit` });
      setWorkspaceMessage(
        `Vorschau für Seite ${previewPage} erstellt. Oben können Sie „Original“ und „Optimiert“ vergleichen.`,
      );
    } catch (error) {
      if (isCurrentPreview() && !(error instanceof DOMException && error.name === "AbortError")) {
        setRenderError(error instanceof Error ? error.message : "Die OCR-Vorschau ist fehlgeschlagen.");
      }
    } finally {
      if (previewRunControllerRef.current.finish(controller)) setPreviewRunning(false);
    }
  }

  function cancelOcrPreview() {
    if (!previewRunControllerRef.current.cancel()) return;
    setPreviewRunning(false);
    setPreviewProgress(undefined);
  }

  function changeRecipe(nextRecipe: PreprocessingRecipe) {
    cancelOcrPreview();
    setRecipe(nextRecipe);
    setOptimizedPages({});
    setViewMode("original");
    setPreviewProgress(undefined);
  }

  async function runOcr() {
    if (previewRunning) return;
    const targetPages = normalizeOcrPageSelection(ocrSelectedPages, includedPages);
    if (targetPages.length === 0) {
      setWorkspaceMessage("Wählen Sie rechts mindestens eine aktive Seite für die OCR aus.");
      return;
    }
    const controller = ocrRunControllerRef.current.start();
    if (!controller) return;
    const isCurrentRun = () => ocrRunControllerRef.current.isCurrent(controller);
    const ensureCurrentRun = () => {
      if (!isCurrentRun() || controller.signal.aborted) {
        throw new DOMException("OCR abgebrochen", "AbortError");
      }
    };
    const reportProgress = (progress: OcrProgress) => {
      if (isCurrentRun()) setOcrProgress(progress);
    };
    setOcrRunning(true);
    setRenderError(undefined);
    setOcrPageStates((current) => ({
      ...current,
      ...Object.fromEntries(targetPages.map((pageNumber) => [pageNumber, "queued" as const])),
    }));

    let completedPages = 0;
    let recognizedWords = 0;
    const failedPages: number[] = [];

    try {
      for (const [pageIndex, targetPage] of targetPages.entries()) {
        ensureCurrentRun();
        const targetRotation = domain.state.pageRotations[targetPage] ?? 0;
        const pageLabel = `Seite ${targetPage} · ${pageIndex + 1}/${targetPages.length}`;
        setOcrPageStates((current) => ({ ...current, [targetPage]: "running" }));

        try {
          const analyzed = pageInfo[targetPage] ?? await analyzePdfPage(document, targetPage);
          ensureCurrentRun();
          reportProgress({
            progress: combineOcrBatchProgress(pageIndex, targetPages.length, 0.03),
            status: `${pageLabel} · PDF wird gerendert`,
          });
          const source = await renderPageToCanvas(
            document,
            targetPage,
            2.5,
            controller.signal,
            targetRotation,
          );
          ensureCurrentRun();
          const optimized = await preprocessPage(
            source,
            recipe,
            (progress) => reportProgress({
              progress: combineOcrBatchProgress(pageIndex, targetPages.length, 0.03 + progress * 0.15),
              status: `${pageLabel} · Bild wird optimiert`,
            }),
            controller.signal,
          );
          ensureCurrentRun();
          setOptimizedPages((current) => ({ ...current, [targetPage]: optimized }));
          if (targetPage === page) setViewMode("optimized");

          const result = await ocrEngineRef.current.recognize(
            optimized,
            targetPage,
            sessionId,
            2.5,
            targetRotation,
            recipe,
            confidenceThresholds,
            (progress) => reportProgress({
              ...progress,
              progress: combineOcrBatchProgress(
                pageIndex,
                targetPages.length,
                0.18 + progress.progress * 0.82,
              ),
              status: `${pageLabel} · ${progress.status}`,
            }),
            controller.signal,
          );
          ensureCurrentRun();
          setPageInfo((current) => {
            const previous = current[targetPage] ?? analyzed;
            return { ...current, [targetPage]: { ...previous, tokens: result.tokens } };
          });
          recognizedWords += result.tokens.length;
          completedPages += 1;
          setOcrPageStates((current) => ({ ...current, [targetPage]: "completed" }));
          reportProgress({
            progress: combineOcrBatchProgress(pageIndex, targetPages.length, 1),
            status: `${pageLabel} · abgeschlossen`,
          });
        } catch (error) {
          if (!isCurrentRun() || controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
            throw new DOMException("OCR abgebrochen", "AbortError");
          }
          failedPages.push(targetPage);
          setOcrPageStates((current) => ({ ...current, [targetPage]: "failed" }));
          await ocrEngineRef.current.terminate();
        }
      }

      ensureCurrentRun();
      setShowTokens(true);
      reportProgress({
        progress: 1,
        status: failedPages.length === 0
          ? `${completedPages} Seite${completedPages === 1 ? "" : "n"} abgeschlossen`
          : `${completedPages} abgeschlossen · ${failedPages.length} mit Fehler`,
      });
      setWorkspaceMessage(
        `${completedPages} von ${targetPages.length} Seiten verarbeitet · ${recognizedWords} OCR-Wörter erkannt.`
        + (failedPages.length > 0 ? ` Fehler auf Seite ${failedPages.join(", ")}.` : ""),
      );
    } catch (error) {
      if (!isCurrentRun()) {
        return;
      }
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        setOcrPageStates((current) => Object.fromEntries(
          Object.entries(current).filter(([, state]) => state !== "queued" && state !== "running"),
        ));
        setOcrProgress((current) => ({
          progress: current?.progress ?? 0,
          status: "OCR-Warteschlange abgebrochen",
        }));
        setWorkspaceMessage(`OCR abgebrochen. ${completedPages} von ${targetPages.length} Seiten waren fertig.`);
      } else {
        setRenderError(error instanceof Error ? error.message : "OCR ist fehlgeschlagen.");
      }
    } finally {
      if (ocrRunControllerRef.current.finish(controller)) setOcrRunning(false);
    }
  }

  function cancelOcr() {
    if (!ocrRunControllerRef.current.cancel()) return;
    setOcrRunning(false);
    setOcrPageStates((current) => Object.fromEntries(
      Object.entries(current).filter(([, state]) => state !== "queued" && state !== "running"),
    ));
    setOcrProgress((current) => ({
      progress: current?.progress ?? 0,
      status: "OCR-Warteschlange abgebrochen",
    }));
    setWorkspaceMessage("OCR abgebrochen. Die ausgewählten Seiten können sofort neu gestartet werden.");
    void ocrEngineRef.current.terminate();
  }

  function changeOcrPageSelection(pages: number[]) {
    setOcrSelectedPages(normalizeOcrPageSelection(pages, includedPages));
    setOcrProgress(undefined);
  }

  function addBlock(bounds: NormalizedRect) {
    const block: ResultBlock = {
      id: crypto.randomUUID(),
      name: `Ergebnisblock ${domain.state.resultBlocks.length + 1}`,
      pages: [page],
      boundsByPage: { [page]: [bounds] },
      classification: "ignore",
      classificationConfirmed: false,
      metadataRuleIds: [],
      disciplineIds: domain.state.disciplines.map((discipline) => discipline.id),
    };
    domain.update((current) => ({
      ...current,
      resultBlocks: [...current.resultBlocks, block],
      results: [],
    }));
    setActiveBlockId(block.id);
    setDrawingBlock(false);
  }

  function updateBlockClassification(id: string, classification: BlockClassification) {
    domain.update((current) => ({
      ...current,
      resultBlocks: current.resultBlocks.map((block) =>
        block.id === id ? { ...block, classification, classificationConfirmed: true } : block,
      ),
      results:
        classification === "individual"
          ? current.results
          : current.results.filter((result) => result.sourceBlockId !== id),
    }));
  }

  function assignSelection(target: MappingTarget) {
    const info = pageInfo[page];
    const selected = info?.tokens.filter((token) => selectedTokenIds.includes(token.id)) ?? [];
    if (selected.length === 0) return;
    const rule: MappingRule = {
      id: crypto.randomUUID(),
      mode: domain.state.mappingMode,
      target,
      bounds: unionBounds(selected.map((token) => token.bounds)),
      relativeTo: domain.state.mappingMode === "columns" ? "result-block" : "sample-athlete",
      joinStrategy: selected.length > 1 ? "region" : "word",
      required: target.group === "person" && ["fullName", "lastName"].includes(target.field),
      formatHint: formatHintForTarget(target),
      samplePage: page,
      sampleTokenIds: selected.map((token) => token.id),
    };
    domain.update((current) => ({
      ...current,
      fieldRules: [...current.fieldRules.filter((item) => targetKey(item.target) !== targetKey(target)), rule],
      results: [],
    }));
    setSelectedTokenIds([]);
  }

  function addDiscipline(name: string) {
    const discipline: DisciplineDefinition = {
      id: crypto.randomUUID(),
      name,
      order: domain.state.disciplines.length,
      number: domain.state.disciplines.length + 1,
      isIndividual: true,
    };
    domain.update((current) => ({ ...current, disciplines: [...current.disciplines, discipline], results: [] }));
  }

  async function applyPattern() {
    setExtractionBusy(true);
    setWorkspaceMessage("Teilnehmermuster wird angewendet …");
    try {
      const extracted: IndividualCompetitionResult[] = [];
      for (const block of domain.state.resultBlocks) {
        if (block.classification !== "individual" || !block.classificationConfirmed) continue;
        const blockPage = block.pages[0];
        if (!blockPage) continue;
        let info = pageInfo[blockPage];
        if (!info) {
          const analyzed = await analyzePdfPage(document, blockPage);
          info = analyzed;
          setPageInfo((current) => ({ ...current, [blockPage]: analyzed }));
        }
        const ignoredBounds = domain.state.resultBlocks
          .filter((candidate) =>
            candidate.classification === "ignore" && candidate.classificationConfirmed && candidate.pages.includes(blockPage),
          )
          .flatMap((candidate) => candidate.boundsByPage[blockPage] ?? []);
        extracted.push(...extractResults({
          tokens: info.tokens.filter((token) => !ignoredBounds.some((bounds) => rectsIntersect(token.bounds, bounds))),
          block,
          rules: domain.state.fieldRules,
          disciplines: domain.state.disciplines,
          mode: domain.state.mappingMode,
          metadata: domain.state.metadata,
          globalRules: domain.state.globalRules,
        }));
      }
      domain.update((current) => ({ ...current, results: extracted }));
      setWorkspaceMessage(`${extracted.length} Einzelergebnisse als prüfbare Vorschläge extrahiert.`);
      onPhaseChange("participants");
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Extraktion ist fehlgeschlagen.");
    } finally {
      setExtractionBusy(false);
    }
  }

  function updateResultField(resultId: string, fieldPath: string, value: string) {
    domain.update((current) => ({
      ...current,
      results: current.results.map((result) => {
        if (result.id !== resultId) return result;
        const next = structuredClone(result);
        if (fieldPath.startsWith("disciplineResults.")) {
          const [, disciplineId, rawField] = fieldPath.split(".");
          const entry = next.disciplineResults.find((item) => item.disciplineId === disciplineId);
          if (entry) {
            const field = rawField as "rank" | "rawTime" | "points" | "penaltyCode" | "penalty";
            entry[field] = value;
            if (field === "rawTime") {
              const normalized = normalizeTime(value);
              entry.normalizedTime = normalized?.normalized;
              entry.timeMs = normalized?.timeMs;
            }
          }
        } else if (fieldPath === "gender") {
          next.rawGender = value;
          next.gender = normalizeGender(value);
        } else {
          (next as unknown as Record<string, unknown>)[fieldPath] = value;
        }
        const sourcePath = fieldPath.replace(".rawTime", ".time");
        const previousValue = next.fieldValues?.[sourcePath];
        next.fieldValues = {
          ...next.fieldValues,
          [sourcePath]: {
            raw: previousValue?.raw ?? value,
            normalized: value,
            confidence: previousValue?.confidence,
            sources: previousValue?.sources ?? [],
            correctedManually: true,
          },
        };
        const issues = validateResult(next);
        next.validationState = issues.some((issue) => issue.severity === "error")
          ? "error"
          : issues.length
            ? "warning"
            : "valid";
        return next;
      }),
    }));
  }

  function openSource(resultId: string, fieldPath: string) {
    const result = domain.state.results.find((item) => item.id === resultId);
    if (!result) return;
    const value = result.fieldValues?.[fieldPath];
    const sources = value?.sources ?? [];
    setPage(sources[0]?.page ?? result.sourcePages[0] ?? 1);
    setSelectedTokenIds(sources.flatMap((source) => source.tokenIds));
    setShowTokens(true);
    setSourceInspection({
      page: sources[0]?.page ?? result.sourcePages[0] ?? 1,
      bounds: sources.map((source) => source.bounds),
      raw: value?.raw ?? "",
      corrected: value?.normalized === undefined ? undefined : String(value.normalized),
      confidence: value?.confidence,
      sourceKind: sources[0]?.sourceKind,
    });
  }

  function createTemplate(name: string): MappingTemplate {
    const now = new Date().toISOString();
    const globalRules: GlobalFieldRule[] = [
      ...structuredClone(domain.state.globalRules),
      ...Object.entries(domain.state.metadata)
        .filter((entry): entry is [keyof WorkspaceMetadata, string] => Boolean(entry[1]))
        .map(([key, value]) => ({
          id: crypto.randomUUID(),
          key,
          rawValue: value,
          normalizedValue: value,
          scope: { kind: "document" } as const,
          updatedAt: now,
        })),
    ];
    return {
      id: crypto.randomUUID(),
      name,
      version: 1,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      rowRules: [],
      fieldRules: structuredClone(domain.state.fieldRules),
      disciplines: structuredClone(domain.state.disciplines),
      globalRules,
    };
  }

  function loadTemplate(template: MappingTemplate) {
    const metadata = Object.fromEntries(
      template.globalRules
        .filter((rule) => rule.scope.kind === "document")
        .map((rule) => [rule.key, rule.normalizedValue ?? rule.rawValue]),
    ) as WorkspaceMetadata;
    const scopedRules = template.globalRules.flatMap((rule) => {
      if (rule.scope.kind === "athlete") return [];
      if (rule.scope.kind === "block") {
        return activeBlockId ? [{ ...rule, id: crypto.randomUUID(), scope: { kind: "block" as const, blockId: activeBlockId } }] : [];
      }
      return [{ ...rule, id: crypto.randomUUID() }];
    });
    domain.update((current) => ({
      ...current,
      fieldRules: structuredClone(template.fieldRules),
      disciplines: structuredClone(template.disciplines),
      metadata: { ...current.metadata, ...metadata },
      globalRules: scopedRules,
      mappingMode: template.fieldRules[0]?.mode ?? current.mappingMode,
      results: [],
    }));
    setWorkspaceMessage(`Template „${template.name}“ geladen. Klassifikation bitte prüfen.`);
  }

  const currentInfo = pageInfo[page];
  const optimizedPage = optimizedPages[page];
  const guideMetrics: WorkflowGuideMetrics = {
    activePageCount: includedPages.length,
    totalPageCount: document.numPages,
    currentPage: page,
    rotation,
    selectedOcrPageCount: ocrSelectedPages.length,
    textQuality: currentInfo?.assessment.quality,
    hasOcr: currentInfo?.tokens.some((token) => token.source === "ocr") ?? false,
    blockCount: domain.state.resultBlocks.length,
    confirmedIndividualBlockCount: domain.state.resultBlocks.filter(
      (block) => block.classification === "individual" && block.classificationConfirmed,
    ).length,
    unclassifiedBlockCount: domain.state.resultBlocks.filter((block) => !block.classificationConfirmed).length,
    fieldRuleCount: domain.state.fieldRules.length,
    hasNameRule: domain.state.fieldRules.some(
      (rule) => rule.target.group === "person" && ["fullName", "lastName"].includes(rule.target.field),
    ),
    disciplineCount: domain.state.disciplines.length,
    resultCount: domain.state.results.length,
    confirmedResultCount: domain.state.results.filter((result) => result.confirmationState === "confirmed").length,
    warningResultCount: domain.state.results.filter((result) => result.validationState !== "valid").length,
  };
  const phaseLabel = {
    file: "Dokument und Seiten",
    ocr: "Texterkennung",
    mapping: "Visuelles Mapping",
    participants: "Teilnehmerkontrolle",
    review: "Warnungen prüfen",
    export: "CSV-Export",
  }[activePhase];

  return (
    <section className="workspace" aria-label="PDF-Arbeitsbereich">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">{phaseLabel}</span>
          <h1>{file.name}</h1>
          {workspaceMessage ? <span className="workspace-message">{extractionBusy ? "Bitte warten · " : ""}{workspaceMessage}</span> : null}
        </div>
        <button className="secondary-button" onClick={onReplaceFile} type="button">Andere PDF öffnen</button>
      </div>

      <WorkflowGuide metrics={guideMetrics} onPhaseChange={onPhaseChange} phase={activePhase} />

      <div className="workspace-grid">
        <PageRail
          canManagePages={activePhase === "file"}
          currentPage={page}
          excludedPages={domain.state.excludedPages}
          onPageChange={changePage}
          onPageExclusionToggle={togglePageExclusion}
          pageCount={document.numPages}
        />
        <main className="viewer-panel">
          <ViewerToolbar
            nextPage={nextPage}
            onPageChange={changePage}
            onRotate={rotateCurrentPage}
            onShowTokensChange={setShowTokens}
            onViewModeChange={setViewMode}
            onZoomChange={setZoom}
            optimizedAvailable={Boolean(optimizedPage)}
            page={page}
            pageCount={document.numPages}
            previousPage={previousPage}
            rotation={rotation}
            showTokens={showTokens}
            viewMode={viewMode}
            zoom={zoom}
          />
          <div className="canvas-viewport">
            {renderError ? <div className="canvas-error" role="alert">{renderError}</div> : null}
            <div className="canvas-sheet">
              <div className={viewMode === "optimized" && optimizedPage ? "is-visually-hidden" : undefined}>
                <PdfCanvas document={document} onError={handleRenderError} onRenderInfo={handleRenderInfo} page={page} rotation={rotation} zoom={zoom} />
              </div>
              {viewMode === "optimized" && optimizedPage && currentInfo ? (
                <OptimizedPageCanvas displayHeight={currentInfo.height} displayWidth={currentInfo.width} source={optimizedPage} />
              ) : null}
              {showTokens && currentInfo ? (
                <TokenOverlay
                  interactive={activePhase === "mapping" && !drawingBlock}
                  onTokenToggle={(tokenId) => setSelectedTokenIds((current) => current.includes(tokenId) ? current.filter((id) => id !== tokenId) : [...current, tokenId])}
                  rotation={rotation}
                  selectedTokenIds={selectedTokenIds}
                  tokens={currentInfo.tokens}
                />
              ) : null}
              {activePhase === "mapping" ? (
                <RegionOverlay activeBlockId={activeBlockId} blocks={domain.state.resultBlocks} drawing={drawingBlock} onCreate={addBlock} page={page} rotation={rotation} />
              ) : null}
            </div>
          </div>
        </main>

        {activePhase === "mapping" ? (
          <MappingInspector
            activeBlockId={activeBlockId}
            blocks={domain.state.resultBlocks}
            canRedo={domain.canRedo}
            canUndo={domain.canUndo}
            createTemplate={createTemplate}
            disciplines={domain.state.disciplines}
            drawingBlock={drawingBlock}
            metadata={domain.state.metadata}
            globalRules={domain.state.globalRules}
            mode={domain.state.mappingMode}
            onActiveBlockChange={setActiveBlockId}
            onAddDiscipline={addDiscipline}
            onAddFullPageBlock={() => addBlock({ x: 0.02, y: 0.02, width: 0.96, height: 0.96 })}
            onApplyPattern={() => void applyPattern()}
            onAssign={assignSelection}
            onBlockClassificationChange={updateBlockClassification}
            onDeleteBlock={(id) => domain.update((current) => ({ ...current, resultBlocks: current.resultBlocks.filter((block) => block.id !== id), results: current.results.filter((result) => result.sourceBlockId !== id) }))}
            onDeleteDiscipline={(id) => domain.update((current) => ({
              ...current,
              disciplines: current.disciplines.filter((item) => item.id !== id).map((item, index) => ({ ...item, order: index })),
              fieldRules: current.fieldRules.filter((rule) => rule.target.group !== "discipline" || rule.target.disciplineId !== id),
              results: [],
            }))}
            onDeleteRule={(id) => domain.update((current) => ({ ...current, fieldRules: current.fieldRules.filter((rule) => rule.id !== id), results: [] }))}
            onDrawingBlockChange={setDrawingBlock}
            onLoadTemplate={loadTemplate}
            onMetadataChange={(metadata) => domain.update((current) => ({ ...current, metadata }))}
            onAddGlobalRule={(rule) => domain.update((current) => ({ ...current, globalRules: [...current.globalRules, rule], results: [] }))}
            onDeleteGlobalRule={(id) => domain.update((current) => ({ ...current, globalRules: current.globalRules.filter((rule) => rule.id !== id), results: [] }))}
            onModeChange={(mappingMode) => domain.update((current) => ({ ...current, mappingMode, fieldRules: [], results: [] }))}
            onRedo={domain.redo}
            onUndo={domain.undo}
            onUpdateDiscipline={(id, name) => domain.update((current) => ({ ...current, disciplines: current.disciplines.map((item) => item.id === id ? { ...item, name } : item), results: [] }))}
            page={page}
            rules={domain.state.fieldRules}
            selectedTokenIds={selectedTokenIds}
            tokens={currentInfo?.tokens ?? []}
          />
        ) : sourceInspection && (activePhase === "participants" || activePhase === "review") ? (
          <SourceInspector document={document} inspection={sourceInspection} onClose={() => setSourceInspection(undefined)} />
        ) : (
          <Inspector
            file={file}
            activePageCount={includedPages.length}
            activePages={includedPages}
            confidenceThresholds={confidenceThresholds}
            onConfidenceThresholdsChange={setConfidenceThresholds}
            onCancelOcr={cancelOcr}
            onOcrPageSelectionChange={changeOcrPageSelection}
            onPreviewOcr={() => void runOcrPreview()}
            onRecipeChange={changeRecipe}
            onRunOcr={() => void runOcr()}
            ocrPageStates={ocrPageStates}
            ocrProgress={ocrProgress}
            ocrRunning={ocrRunning}
            page={page}
            pageCount={document.numPages}
            pageRotations={domain.state.pageRotations}
            previewProgress={previewProgress}
            previewRunning={previewRunning}
            recipe={recipe}
            renderInfo={currentInfo}
            rotation={rotation}
            selectedOcrPages={ocrSelectedPages}
            showOcr={activePhase === "ocr"}
          />
        )}
      </div>

      {activePhase === "participants" || activePhase === "review" ? (
        <ResultsGrid
          disciplines={domain.state.disciplines}
          onConfirmAllVisible={(ids) => domain.update((current) => ({ ...current, results: current.results.map((result) => ids.includes(result.id) ? { ...result, confirmationState: "confirmed" } : result) }))}
          onConfirmationChange={(id, confirmed) => domain.update((current) => ({ ...current, results: current.results.map((result) => result.id === id ? { ...result, confirmationState: confirmed ? "confirmed" : "suggested" } : result) }))}
          onDelete={(id) => domain.update((current) => ({ ...current, results: current.results.filter((result) => result.id !== id) }))}
          onFieldChange={updateResultField}
          onOpenSource={openSource}
          results={domain.state.results}
          reviewMode={activePhase === "review"}
        />
      ) : null}

      {activePhase === "export" ? (
        <CsvExportPanel
          disciplines={domain.state.disciplines}
          onReorderDisciplines={(disciplines) => domain.update((current) => ({ ...current, disciplines }))}
          results={domain.state.results.filter((result) => domain.state.resultBlocks.some((block) => block.id === result.sourceBlockId && block.classification === "individual" && block.classificationConfirmed))}
        />
      ) : null}
    </section>
  );
}

function unionBounds(bounds: NormalizedRect[]): NormalizedRect {
  const left = Math.min(...bounds.map((item) => item.x));
  const top = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function arraysEqual(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function targetKey(target: MappingTarget): string {
  return target.group === "discipline" ? `${target.group}:${target.disciplineId}:${target.field}` : `${target.group}:${target.field}`;
}

function formatHintForTarget(target: MappingTarget): MappingRule["formatHint"] {
  if (target.group === "overall") return target.field === "overallRank" ? "integer" : "decimal";
  if (target.group === "person" && target.field === "birthYear") return "integer";
  if (target.group === "discipline") {
    if (target.field === "time") return "time";
    if (target.field === "rank") return "integer";
    if (target.field === "points") return "decimal";
    if (target.field === "penalty" || target.field === "penaltyCode") return "status";
  }
  return "text";
}

function rectsIntersect(left: NormalizedRect, right: NormalizedRect): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function findNearestPage(referencePage: number, pages: number[]): number {
  return pages.reduce((nearest, candidate) =>
    Math.abs(candidate - referencePage) < Math.abs(nearest - referencePage) ? candidate : nearest,
  pages[0] ?? 1);
}

function removePageFromGlobalRules(
  rules: GlobalFieldRule[],
  excludedPage: number,
  retainedBlockIds: Set<string>,
): GlobalFieldRule[] {
  const retained: GlobalFieldRule[] = [];
  for (const rule of rules) {
    if (rule.scope.kind === "block" && !retainedBlockIds.has(rule.scope.blockId)) continue;
    if (rule.scope.kind !== "pages") {
      retained.push(rule);
      continue;
    }
    const pages = rule.scope.pages.filter((pageNumber) => pageNumber !== excludedPage);
    if (pages.length > 0) retained.push({ ...rule, scope: { kind: "pages", pages } });
  }
  return retained;
}
