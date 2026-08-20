import type { IndividualCompetitionResult, ValidationIssue } from "../models";
import { normalizeBirthYear, normalizeTime } from "../utils/normalization";

export function validateResult(result: IndividualCompetitionResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: string, message: string, fieldPath: string, severity: "warning" | "error") => {
    issues.push({
      id: `${result.id}:${code}:${fieldPath}`,
      entityId: result.id,
      fieldPath,
      code,
      message,
      severity,
      sources: result.fieldValues?.[fieldPath]?.sources ?? [],
      acknowledged: false,
    });
  };

  if (!result.rawName && !result.lastName) {
    add("missing-name", "Name fehlt.", "rawName", "error");
  }
  if (result.gender && result.gender !== "m" && result.gender !== "w") {
    add("invalid-gender", "Gender darf im Export nur m, w oder leer sein.", "gender", "error");
  }
  if (result.rawGender?.trim() && !result.gender) {
    add("ambiguous-gender", "Gender konnte nicht eindeutig zu m oder w normalisiert werden.", "gender", "warning");
  }
  if (result.birthYear && !normalizeBirthYear(result.birthYear)) {
    add("suspicious-birth-year", "Jahrgang enthält kein eindeutiges zwei- oder vierstelliges Jahr.", "birthYear", "warning");
  }
  if (result.overallRank && !/^[1-9]\d*\.?$/.test(result.overallRank.trim())) {
    add("invalid-overall-rank", "Gesamtplatzierung ist keine positive Ganzzahl.", "overallRank", "warning");
  }
  if (result.overallPoints && !/^\d+(?:[.,]\d+)?$/.test(result.overallPoints.trim())) {
    add("invalid-overall-points", "Gesamtpunktzahl ist nicht eindeutig numerisch.", "overallPoints", "warning");
  }

  for (const discipline of result.disciplineResults) {
    const prefix = `disciplineResults.${discipline.disciplineId}`;
    if (discipline.rank && !/^[1-9]\d*\.?$/.test(discipline.rank.trim())) {
      add("invalid-discipline-rank", "Disziplinplatzierung ist keine positive Ganzzahl.", `${prefix}.rank`, "warning");
    }
    if (discipline.rawTime && !normalizeTime(discipline.rawTime)) {
      add("invalid-time", "Zeitformat ist ungewöhnlich und muss geprüft werden.", `${prefix}.time`, "warning");
    }
    if (discipline.points && !/^\d+(?:[.,]\d+)?$/.test(discipline.points.trim())) {
      add("invalid-points", "Disziplinpunkte sind nicht eindeutig numerisch.", `${prefix}.points`, "warning");
    }
  }

  if ((result.confidence ?? 100) < 70) {
    add("low-confidence", "Mindestens ein extrahiertes Feld hat eine kritische OCR-Confidence.", "confidence", "warning");
  }

  return issues;
}
