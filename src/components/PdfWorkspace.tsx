import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type {
  BlockClassification,
  DisciplineDefinition,
  GlobalFieldRule,
  MappingRule,
  MappingTarget,
  MappingTemplate,
  NormalizedRect,
  PreprocessingRecipe,
  ResultBlock,
  IndividualCompetitionResult,
  WorkspaceDomainState,
  WorkspaceMetadata,
} from "../models";
import { extractResults } from "../extraction/extractResults";
import { useUndoableState } from "../hooks/useUndoableState";
import { OcrEngine, type OcrProgress } from "../ocr/ocrEngine";
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
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string>();
  const [drawingBlock, setDrawingBlock] = useState(false);
  const [extractionBusy, setExtractionBusy] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<string>();
  const [sessionReady, setSessionReady] = useState(false);
  const [sourceInspection, setSourceInspection] = useState<SourceInspection>();
  const ocrEngineRef = useRef(new OcrEngine());
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const domain = useUndoableState(initialDomainState);
  const sessionId = useMemo(
    () => document.fingerprints[0] ?? `${file.name}-${file.size}-${file.lastModified}`,
    [document.fingerprints, file.lastModified, file.name, file.size],
  );

  useEffect(() => {
    let active = true;
    setPage(1);
    setPageInfo({});
    setRenderError(undefined);
    setOptimizedPages({});
    setViewMode("original");
    setSelectedTokenIds([]);
    setActiveBlockId(undefined);
    setSessionReady(false);
    domain.reset(initialDomainState);
    void loadWorkspaceSession(sessionId).then((saved) => {
      if (!active) return;
      if (saved?.schemaVersion === 1) {
        domain.reset({ ...saved, globalRules: saved.globalRules ?? [] });
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
      setRotation(0);
      setShowTokens(true);
    }
  }, [activePhase]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
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
    setPage(nextPage);
    setSelectedTokenIds([]);
    setDrawingBlock(false);
    const nextBlock = domain.state.resultBlocks.find((block) => block.pages.includes(nextPage));
    setActiveBlockId(nextBlock?.id);
  }

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

      const result = await ocrEngineRef.current.recognize(
        optimized,
        page,
        sessionId,
        2.5,
        recipe,
        (progress) => setOcrProgress({ ...progress, progress: 0.18 + progress.progress * 0.82 }),
        controller.signal,
      );
      setPageInfo((current) => {
        const previous = current[page];
        if (!previous) return current;
        return { ...current, [page]: { ...previous, tokens: result.tokens } };
      });
      setShowTokens(true);
      setWorkspaceMessage(`${result.tokens.length} OCR-Wörter auf Seite ${page} erkannt.`);
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
    domain.update((current) => ({
      ...current,
      fieldRules: structuredClone(template.fieldRules),
      disciplines: structuredClone(template.disciplines),
      metadata: { ...current.metadata, ...metadata },
      globalRules: structuredClone(template.globalRules),
      mappingMode: template.fieldRules[0]?.mode ?? current.mappingMode,
      results: [],
    }));
    setWorkspaceMessage(`Template „${template.name}“ geladen. Klassifikation bitte prüfen.`);
  }

  const currentInfo = pageInfo[page];
  const optimizedPage = optimizedPages[page];
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

      <div className="workspace-grid">
        <PageRail currentPage={page} onPageChange={changePage} pageCount={document.numPages} />
        <main className="viewer-panel">
          <ViewerToolbar
            onPageChange={changePage}
            onRotate={() => {
              setViewMode("original");
              setRotation((current) => (current + 90) % 360);
            }}
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
                <RegionOverlay activeBlockId={activeBlockId} blocks={domain.state.resultBlocks} drawing={drawingBlock} onCreate={addBlock} page={page} />
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
            onCancelOcr={cancelOcr}
            onRecipeChange={setRecipe}
            onRunOcr={() => void runOcr()}
            ocrProgress={ocrProgress}
            ocrRunning={ocrRunning}
            page={page}
            pageCount={document.numPages}
            recipe={recipe}
            renderInfo={currentInfo}
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
