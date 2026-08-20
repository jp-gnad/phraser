export type EntityId = string;

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SourceReference {
  page: number;
  bounds: NormalizedRect;
  tokenIds: EntityId[];
  sourceKind: "pdf-text" | "ocr" | "manual";
}

export interface ExtractedValue<TNormalized = string> {
  raw: string;
  normalized?: TNormalized;
  confidence?: number;
  sources: SourceReference[];
  correctedManually?: boolean;
}

export type ConfidenceLevel = "safe" | "review" | "critical" | "unknown";

export interface ConfidenceThresholds {
  safe: number;
  review: number;
}

