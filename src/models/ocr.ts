import type { ConfidenceLevel, EntityId, NormalizedRect } from "./common";

export type TextSourceKind = "pdf-text" | "ocr";

export interface OCRToken {
  id: EntityId;
  text: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  page: number;
  bounds: NormalizedRect;
  source: TextSourceKind;
  lineId?: EntityId;
  blockId?: EntityId;
}

export interface PreprocessingRecipe {
  grayscale: boolean;
  contrast: number;
  adaptiveThreshold: boolean;
  threshold?: number;
  denoise: boolean;
  deskewDegrees?: number;
  cropDarkBorders: boolean;
}

export interface OcrPageResult {
  page: number;
  tokens: OCRToken[];
  aggregateConfidence?: number;
  language: string;
  renderScale: number;
  recipe: PreprocessingRecipe;
  cacheKey: string;
  createdAt: string;
}

export type PageProcessingState =
  | "idle"
  | "text-analysis"
  | "queued-for-ocr"
  | "preprocessing"
  | "ocr"
  | "ready"
  | "failed"
  | "cancelled";

export interface TextLayerAssessment {
  quality: "good" | "poor" | "missing" | "unknown";
  tokenCount: number;
  printableCharacterRatio: number;
  coverageRatio: number;
  reasonCodes: string[];
}

