import type { EntityId } from "./common";

export type ProcessingJobKind =
  | "pdf-text-analysis"
  | "page-render"
  | "preprocessing"
  | "ocr"
  | "extraction";

export interface ProcessingJob {
  id: EntityId;
  kind: ProcessingJobKind;
  page?: number;
  status: "queued" | "running" | "completed" | "cancelled" | "failed";
  progress: number;
  message?: string;
  errorCode?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type WorkspacePhase =
  | "file"
  | "scope"
  | "metadata"
  | "disciplines"
  | "mapping"
  | "extraction"
  | "review"
  | "export";

export interface WorkspaceUiState {
  phase: WorkspacePhase;
  activePage: number;
  zoom: number;
  rotation: 0 | 90 | 180 | 270;
  selectedTokenIds: EntityId[];
  activeResultId?: EntityId;
  activeFieldPath?: string;
  showOnlyWarnings: boolean;
}

