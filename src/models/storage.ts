import type { EntityId } from "./common";
import type { DocumentSession } from "./session";
import type { MappingTemplate } from "./template";
import type { OcrPageResult } from "./ocr";

export interface StoredSessionRecord {
  id: EntityId;
  schemaVersion: number;
  updatedAt: string;
  documentFingerprint?: string;
  session: DocumentSession;
}

export interface StoredTemplateRecord {
  id: EntityId;
  schemaVersion: number;
  updatedAt: string;
  template: MappingTemplate;
}

export interface StoredOcrCacheRecord {
  cacheKey: string;
  documentFingerprint: string;
  page: number;
  lastAccessedAt: string;
  result: OcrPageResult;
}

export interface PhraserDatabaseSchema {
  sessions: StoredSessionRecord;
  templates: StoredTemplateRecord;
  ocrCache: StoredOcrCacheRecord;
}

