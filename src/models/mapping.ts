import type { EntityId, NormalizedRect } from "./common";
import type { CompetitionMetadata, DisciplineDefinition } from "./competition";

export type BlockClassification = "individual" | "team-or-relay" | "ignore";
export type MappingMode = "columns" | "example-athlete";

export type PersonField =
  | "lastName"
  | "firstName"
  | "fullName"
  | "gender"
  | "ageGroup"
  | "birthYear"
  | "localClub"
  | "district"
  | "regionalAssociation"
  | "nationalAssociation";

export type OverallField = "overallRank" | "overallPoints";
export type CompetitionField =
  | "competitionDate"
  | "competitionName"
  | "competitionLocation";
export type DisciplineField =
  | "disciplineName"
  | "disciplineNumber"
  | "rank"
  | "time"
  | "points"
  | "penaltyCode"
  | "penalty";

export type MappingTarget =
  | { group: "person"; field: PersonField }
  | { group: "overall"; field: OverallField }
  | { group: "competition"; field: CompetitionField }
  | {
      group: "discipline";
      field: DisciplineField;
      disciplineId: EntityId;
    }
  | { group: "other"; field: "ignore" };

export interface ResultBlock {
  id: EntityId;
  name: string;
  pages: number[];
  boundsByPage: Record<number, NormalizedRect[]>;
  classification: BlockClassification;
  classificationConfirmed: boolean;
  metadataRuleIds: EntityId[];
  disciplineIds: EntityId[];
}

export interface RowDetectionRule {
  id: EntityId;
  mode: MappingMode;
  blockId?: EntityId;
  anchorTarget?: MappingTarget;
  sampleBounds?: NormalizedRect;
  expectedRowHeight?: number;
  maxVerticalGap?: number;
  minAnchorSimilarity: number;
}

export interface MappingRule {
  id: EntityId;
  mode: MappingMode;
  target: MappingTarget;
  bounds: NormalizedRect;
  relativeTo: "page" | "result-block" | "sample-athlete";
  joinStrategy: "word" | "line" | "region";
  required: boolean;
  formatHint?: "text" | "integer" | "decimal" | "time" | "status";
}

export type MetadataScope =
  | { kind: "document" }
  | { kind: "pages"; pages: number[] }
  | { kind: "block"; blockId: EntityId }
  | { kind: "athlete"; athleteId: EntityId };

export type GlobalMetadataKey =
  | keyof CompetitionMetadata
  | "gender"
  | "ageGroup"
  | "localClub"
  | "district"
  | "regionalAssociation"
  | "nationalAssociation";

export interface GlobalFieldRule {
  id: EntityId;
  key: GlobalMetadataKey;
  rawValue: string;
  normalizedValue?: string;
  scope: MetadataScope;
  updatedAt: string;
}

export interface ClassificationRule {
  id: EntityId;
  pattern: string;
  flags: string;
  suggestedClassification: BlockClassification;
  warningOnly: true;
}

export interface MappingDraft {
  mode: MappingMode;
  resultBlocks: ResultBlock[];
  rowRules: RowDetectionRule[];
  fieldRules: MappingRule[];
  disciplines: DisciplineDefinition[];
  globalRules: GlobalFieldRule[];
}

