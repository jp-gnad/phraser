import type { DisciplineDefinition, IndividualCompetitionResult } from "../models";
import { normalizeBirthYear, normalizeGender, normalizeTime } from "../utils/normalization";

export const FIXED_HEADERS = [
  "Nachname",
  "Vorname",
  "Gender",
  "Altersklasse",
  "Jahrgang",
  "Ortsgruppe",
  "Bezirk",
  "Landesverband",
  "Bundesverband",
  "Gesamtplatzierung",
  "Gesamtpunktzahl",
  "",
  "",
] as const;

export const END_HEADERS = ["Datum", "Wettkampf Name", "Wettkampfort"] as const;

export interface CsvGenerationResult {
  header: string[];
  rows: string[][];
  csv: string;
  fileName: string;
}

export function generateCsv(
  athletes: IndividualCompetitionResult[],
  disciplines: DisciplineDefinition[],
): CsvGenerationResult {
  const orderedDisciplines = [...disciplines].sort((left, right) => left.order - right.order);
  const disciplineHeaders = orderedDisciplines.flatMap((_, index) => {
    const number = index + 1;
    return [
      `Platzierung Disziplin ${number}`,
      `Zeit Disziplin ${number}`,
      `Punkte Disziplin ${number}`,
      `Strafe code Disziplin ${number}`,
      `Strafe Disziplin ${number}`,
    ];
  });
  const header = [...FIXED_HEADERS, ...disciplineHeaders, ...END_HEADERS];
  const rows = athletes.map((athlete) => {
    const fixed = [
      athlete.lastName ?? "",
      athlete.firstName ?? "",
      normalizeGender(athlete.gender) ?? "",
      athlete.ageGroup ?? "",
      normalizeBirthYear(athlete.birthYear) ?? athlete.birthYear ?? "",
      athlete.localClub ?? "",
      athlete.district ?? "",
      athlete.regionalAssociation ?? "",
      athlete.nationalAssociation ?? "",
      athlete.overallRank ?? "",
      athlete.overallPoints ?? "",
      "",
      "",
    ];
    const disciplineCells = orderedDisciplines.flatMap((definition) => {
      const result = athlete.disciplineResults.find((entry) => entry.disciplineId === definition.id);
      return [
        result?.rank ?? "",
        result?.normalizedTime ?? normalizeTime(result?.rawTime)?.normalized ?? result?.rawTime ?? "",
        result?.points ?? "",
        result?.penaltyCode ?? "",
        result?.penalty ?? "",
      ];
    });
    return [
      ...fixed,
      ...disciplineCells,
      athlete.competitionDate ?? "",
      athlete.competitionName ?? "",
      athlete.competitionLocation ?? "",
    ];
  });

  assertCsvInvariants(header, rows, orderedDisciplines.length);
  const csvBody = [header, ...rows].map((row) => row.map(quoteCsvCell).join(";")).join("\r\n");
  return {
    header,
    rows,
    csv: `\uFEFF${csvBody}`,
    fileName: createCsvFileName(athletes[0]),
  };
}

export function quoteCsvCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function assertCsvInvariants(
  header: string[],
  rows: string[][],
  disciplineCount: number,
): void {
  const expectedColumns = 13 + disciplineCount * 5 + 3;
  if (header.length !== expectedColumns) throw new Error("CSV-Kopf hat eine unerwartete Spaltenzahl.");
  if (header[11] !== "" || header[12] !== "") {
    throw new Error("Die zwei reservierten CSV-Spalten fehlen an Position 12 und 13.");
  }
  if (header.at(-3) !== "Datum" || header.at(-2) !== "Wettkampf Name" || header.at(-1) !== "Wettkampfort") {
    throw new Error("Die CSV-Endspalten sind nicht korrekt angeordnet.");
  }
  if (rows.some((row) => row.length !== expectedColumns)) {
    throw new Error("Mindestens eine Person besitzt eine falsche CSV-Spaltenzahl.");
  }
}

function createCsvFileName(athlete: IndividualCompetitionResult | undefined): string {
  const base = athlete?.competitionCode || athlete?.competitionName || "Wettkampf";
  const year = athlete?.competitionDate?.slice(0, 4);
  const safeBase = base.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 80);
  return `${safeBase}${year ? `_${year}` : ""}_Einzelergebnisse.csv`;
}

