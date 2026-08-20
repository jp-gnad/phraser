import type { EntityId } from "./common";
import type { DisciplineDefinition } from "./competition";
import type {
  ClassificationRule,
  GlobalFieldRule,
  MappingRule,
  RowDetectionRule,
} from "./mapping";

export interface LayoutFingerprint {
  pageAspectRatios: number[];
  textDensityBuckets: number[];
  dominantColumnPositions: number[];
  headerSignatures: string[];
}

export interface MappingTemplate {
  id: EntityId;
  name: string;
  version: number;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  rowRules: RowDetectionRule[];
  fieldRules: MappingRule[];
  disciplines: DisciplineDefinition[];
  globalRules: GlobalFieldRule[];
  documentClassificationRules?: ClassificationRule[];
  fingerprint?: LayoutFingerprint;
}

export interface TemplateExportEnvelope {
  format: "phraser-mapping-template";
  formatVersion: number;
  exportedAt: string;
  template: MappingTemplate;
}

