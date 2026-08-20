export function normalizeGender(value: string | undefined): "m" | "w" | undefined {
  const normalized = value?.trim().toLocaleLowerCase("de-DE");
  if (!normalized) return undefined;

  const male = new Set(["m", "male", "männlich", "maennlich", "herren", "jungen"]);
  const female = new Set(["w", "f", "female", "weiblich", "damen", "mädchen", "maedchen"]);
  if (male.has(normalized)) return "m";
  if (female.has(normalized)) return "w";
  return undefined;
}

export function normalizeBirthYear(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}$/.test(trimmed)) return trimmed.slice(2);
  return undefined;
}

export interface NormalizedTime {
  normalized: string;
  timeMs: number;
}

export function normalizeTime(value: string | undefined): NormalizedTime | undefined {
  const raw = value?.trim().replace(/\s/g, "");
  if (!raw) return undefined;

  const match = raw.match(/^(?:(\d{1,2}):)?(\d{1,2})([.,](\d{1,3}))?$/);
  if (!match) return undefined;

  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  if (seconds >= 60 && match[1] !== undefined) return undefined;
  const fractionRaw = match[4] ?? "";
  const milliseconds = fractionRaw
    ? Number(fractionRaw.padEnd(3, "0").slice(0, 3))
    : 0;
  const fraction = fractionRaw ? `,${fractionRaw}` : "";
  const normalized = match[1] !== undefined
    ? `${minutes}:${String(seconds).padStart(2, "0")}${fraction}`
    : `${seconds}${fraction}`;

  return {
    normalized,
    timeMs: (minutes * 60 + seconds) * 1000 + milliseconds,
  };
}

export function splitAthleteName(rawName: string | undefined): {
  rawName?: string;
  lastName?: string;
  firstName?: string;
} {
  const trimmed = rawName?.trim().replace(/\s+/g, " ");
  if (!trimmed) return {};

  if (trimmed.includes(",")) {
    const [lastName, ...firstParts] = trimmed.split(",");
    return {
      rawName: trimmed,
      lastName: lastName?.trim() || undefined,
      firstName: firstParts.join(",").trim() || undefined,
    };
  }

  return { rawName: trimmed };
}

