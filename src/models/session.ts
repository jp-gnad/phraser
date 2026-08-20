import type { EntityId } from "./common";
import type {
  CompetitionMetadata,
  DisciplineDefinition,
  IndividualCompetitionResult,
} from "./competition";
import type { MappingDraft, ResultBlock } from "./mapping";
import type {
  OcrPageResult,
  PageProcessingState,
  TextLayerAssessment,
} from "./ocr";
import type { ValidationIssue } from "./validation";

export interface DocumentIdentity {
  fileName: string;
  fileSize: number;
  lastModified: number;
  fingerprint?: string;
}

export interface DocumentPage {
  page: number;
  width: number;
  height: number;
  rotation: number;
  processingState: PageProcessingState;
  textLayer: TextLayerAssessment;
  ocrResult?: OcrPageResult;
}

export interface ExportSettings {
  includeBom: true;
  delimiter: ";";
  lineEnding: "\r\n";
  disciplineOrder: EntityId[];
  competitionEndDate?: string;
}

export interface DocumentSession {
  id: EntityId;
  schemaVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  document: DocumentIdentity;
  pages: DocumentPage[];
  resultBlocks: ResultBlock[];
  mapping: MappingDraft;
  metadata: CompetitionMetadata;
  disciplines: DisciplineDefinition[];
  results: IndividualCompetitionResult[];
  validationIssues: ValidationIssue[];
  exportSettings: ExportSettings;
  extractionRevision?: number;
}

export type SessionCommand =
  | { type: "mapping/replaced"; mapping: MappingDraft }
  | { type: "block/updated"; block: ResultBlock }
  | { type: "result/updated"; result: IndividualCompetitionResult }
  | { type: "result/deleted"; resultId: EntityId }
  | { type: "disciplines/reordered"; disciplineIds: EntityId[] }
  | { type: "metadata/replaced"; metadata: CompetitionMetadata };

export interface CommandHistory {
  past: SessionCommand[];
  future: SessionCommand[];
}

