import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { OcrPageResult } from "../models";

interface PhraserDatabase extends DBSchema {
  ocrCache: {
    key: string;
    value: OcrPageResult;
  };
  sessions: {
    key: string;
    value: unknown;
  };
  templates: {
    key: string;
    value: unknown;
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

