import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { MappingTemplate, OcrPageResult, WorkspaceDomainState } from "../models";

interface SessionRecord {
  id: string;
  updatedAt: string;
  state: WorkspaceDomainState;
}

interface TemplateRecord {
  id: string;
  updatedAt: string;
  template: MappingTemplate;
}

interface PhraserDatabase extends DBSchema {
  ocrCache: {
    key: string;
    value: OcrPageResult;
  };
  sessions: {
    key: string;
    value: SessionRecord;
  };
  templates: {
    key: string;
    value: TemplateRecord;
    indexes: { "by-updated-at": string };
  };
}

let databasePromise: Promise<IDBPDatabase<PhraserDatabase>> | undefined;

export function getDatabase(): Promise<IDBPDatabase<PhraserDatabase>> {
  databasePromise ??= openDB<PhraserDatabase>("phraser", 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("ocrCache")) {
        database.createObjectStore("ocrCache");
      }
      if (!database.objectStoreNames.contains("sessions")) {
        database.createObjectStore("sessions");
      }
      if (!database.objectStoreNames.contains("templates")) {
        const templates = database.createObjectStore("templates");
        templates.createIndex("by-updated-at", "updatedAt");
      }
    },
  });

  return databasePromise;
}

export async function getCachedOcrResult(cacheKey: string): Promise<OcrPageResult | undefined> {
  try {
    return await (await getDatabase()).get("ocrCache", cacheKey);
  } catch {
    return undefined;
  }
}

export async function cacheOcrResult(result: OcrPageResult): Promise<void> {
  try {
    await (await getDatabase()).put("ocrCache", result, result.cacheKey);
  } catch {
    // Browser storage can be disabled or full. OCR still remains usable in memory.
  }
}

export async function loadWorkspaceSession(id: string): Promise<WorkspaceDomainState | undefined> {
  try {
    return (await (await getDatabase()).get("sessions", id))?.state;
  } catch {
    return undefined;
  }
}

export async function saveWorkspaceSession(id: string, state: WorkspaceDomainState): Promise<void> {
  try {
    await (await getDatabase()).put("sessions", {
      id,
      updatedAt: new Date().toISOString(),
      state,
    });
  } catch {
    // A disabled/full IndexedDB must not block active document work.
  }
}

export async function listTemplates(): Promise<MappingTemplate[]> {
  const records = await (await getDatabase()).getAllFromIndex("templates", "by-updated-at");
  return records.map((record) => record.template).reverse();
}

export async function saveTemplate(template: MappingTemplate): Promise<void> {
  await (await getDatabase()).put("templates", {
    id: template.id,
    updatedAt: template.updatedAt,
    template,
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await (await getDatabase()).delete("templates", id);
}

