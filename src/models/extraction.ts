import type { EntityId, SourceReference } from "./common";
import type { IndividualCompetitionResult } from "./competition";
import type { MappingTarget } from "./mapping";

export interface ExtractedFieldCandidate {
  id: EntityId;
  target: MappingTarget;
  rawValue: string;
  normalizedValue?: string;
  confidence: number;
  geometricScore: number;
  formatScore: number;
  sources: SourceReference[];
  competingCandidateIds: EntityId[];
}

export interface AthleteExtractionCandidate {
  id: EntityId;
  blockId: EntityId;
  anchorTokenIds: EntityId[];
  fields: ExtractedFieldCandidate[];
  proposedResult: IndividualCompetitionResult;
  confidence: number;
  status: "suggested" | "accepted" | "rejected" | "conflict";
}

export interface ExtractionRun {
  id: EntityId;
  sessionRevision: number;
  startedAt: string;
  completedAt?: string;
  status: "queued" | "running" | "completed" | "cancelled" | "failed";
  candidates: AthleteExtractionCandidate[];
  warningCodes: string[];
}

