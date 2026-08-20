import type { CompetitionMetadata, DisciplineDefinition, IndividualCompetitionResult } from "./competition";
import type { MappingMode, MappingRule, ResultBlock } from "./mapping";

export interface WorkspaceMetadata extends CompetitionMetadata {
  gender?: string;
  ageGroup?: string;
  localClub?: string;
  district?: string;
  regionalAssociation?: string;
  nationalAssociation?: string;
}

export interface WorkspaceDomainState {
  schemaVersion: 1;
  mappingMode: MappingMode;
  resultBlocks: ResultBlock[];
  fieldRules: MappingRule[];
  disciplines: DisciplineDefinition[];
  metadata: WorkspaceMetadata;
  results: IndividualCompetitionResult[];
}

