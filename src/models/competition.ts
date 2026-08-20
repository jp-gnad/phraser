import type { EntityId, ExtractedValue } from "./common";

export interface AthleteName {
  rawName?: string;
  lastName?: string;
  firstName?: string;
}

export interface DisciplineDefinition {
  id: EntityId;
  number?: number;
  name: string;
  order: number;
  isIndividual: boolean;
}

export interface DisciplineResult {
  id: EntityId;
  disciplineId: EntityId;
  disciplineNumber?: number;
  disciplineName: string;
  rank?: string;
  rawTime?: string;
  normalizedTime?: string;
  timeMs?: number;
  points?: string;
  penaltyCode?: string;
  penalty?: string;
  sourcePage?: number;
  confidence?: number;
  values?: Partial<{
    rank: ExtractedValue;
    time: ExtractedValue<number>;
    points: ExtractedValue;
    penaltyCode: ExtractedValue;
    penalty: ExtractedValue;
  }>;
}

export interface CompetitionMetadata {
  competitionDate?: string;
  competitionName?: string;
  competitionLocation?: string;
  competitionCode?: string;
  poolLength?: string;
  country?: string;
  rulebook?: string;
  scoring?: string;
}

export interface AssociationMetadata {
  localClub?: string;
  district?: string;
  regionalAssociation?: string;
  nationalAssociation?: string;
}

export interface IndividualCompetitionResult
  extends AthleteName,
    CompetitionMetadata,
    AssociationMetadata {
  id: EntityId;
  gender?: "m" | "w";
  rawGender?: string;
  ageGroup?: string;
  birthYear?: string;
  birthYearFull?: number;
  overallRank?: string;
  overallPoints?: string;
  disciplineResults: DisciplineResult[];
  sourcePages: number[];
  confidence?: number;
  validationState: "valid" | "warning" | "error";
  confirmationState: "suggested" | "confirmed" | "excluded";
  fieldValues?: Record<string, ExtractedValue<string | number>>;
  sourceBlockId: EntityId;
}

