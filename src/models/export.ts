import type { EntityId } from "./common";
import type { DisciplineDefinition, IndividualCompetitionResult } from "./competition";

export type CsvColumnKind = "fixed" | "reserved" | "discipline" | "ending";

export interface CsvColumnDefinition {
  id: string;
  header: string;
  kind: CsvColumnKind;
  disciplineId?: EntityId;
  disciplineField?: "rank" | "time" | "points" | "penaltyCode" | "penalty";
}

export interface ExportPlan {
  sessionRevision: number;
  athletes: IndividualCompetitionResult[];
  disciplines: DisciplineDefinition[];
  columns: CsvColumnDefinition[];
  includeBom: true;
  delimiter: ";";
  lineEnding: "\r\n";
  generatedAt: string;
}

export interface CsvPreview {
  header: string[];
  rows: string[][];
  rowCount: number;
  columnCount: number;
  warnings: string[];
  fileName: string;
}

