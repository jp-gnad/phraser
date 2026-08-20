import type { EntityId, SourceReference } from "./common";

export type ValidationSeverity = "warning" | "error";

export interface ValidationIssue {
  id: EntityId;
  entityId: EntityId;
  fieldPath?: string;
  code: string;
  message: string;
  severity: ValidationSeverity;
  sources: SourceReference[];
  acknowledged: boolean;
}

