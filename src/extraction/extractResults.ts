import type {
  DisciplineDefinition,
  DisciplineResult,
  ExtractedValue,
  GlobalFieldRule,
  IndividualCompetitionResult,
  MappingMode,
  MappingRule,
  MappingTarget,
  NormalizedRect,
  OCRToken,
  ResultBlock,
  SourceReference,
  WorkspaceMetadata,
} from "../models";
import {
  normalizeBirthYear,
  normalizeGender,
  normalizeTime,
  splitAthleteName,
} from "../utils/normalization";
import { validateResult } from "../validation/validateResult";

export interface ExtractionInput {
  tokens: OCRToken[];
  block: ResultBlock;
  rules: MappingRule[];
  disciplines: DisciplineDefinition[];
  mode: MappingMode;
  metadata: WorkspaceMetadata;
  globalRules?: GlobalFieldRule[];
}

interface FieldMatch {
  rule: MappingRule;
  value: string;
  confidence: number;
  tokens: OCRToken[];
}

export function extractResults(input: ExtractionInput): IndividualCompetitionResult[] {
  const page = input.block.pages[0];
  if (!page || input.block.classification !== "individual" || !input.block.classificationConfirmed) {
    return [];
  }

  const blockBounds = input.block.boundsByPage[page] ?? [];
  const tokens = input.tokens.filter(
    (token) => token.page === page && blockBounds.some((bounds) => intersects(token.bounds, bounds)),
  );
  const rules = input.rules;
  const matches = input.mode === "columns"
    ? matchColumnRows(tokens, rules)
    : matchRepeatedSamples(tokens, rules);

  const metadata = resolveMetadata(input.metadata, input.globalRules ?? [], page, input.block.id);
  return matches
    .map((fields, index) => buildResult(fields, { ...input, metadata }, page, index))
    .filter((result): result is IndividualCompetitionResult => result !== undefined);
}

function resolveMetadata(
  base: WorkspaceMetadata,
  rules: GlobalFieldRule[],
  page: number,
  blockId: string,
): WorkspaceMetadata {
  const applicable = rules
    .filter((rule) =>
      rule.scope.kind === "document" ||
      (rule.scope.kind === "pages" && rule.scope.pages.includes(page)) ||
      (rule.scope.kind === "block" && rule.scope.blockId === blockId),
    )
    .sort((left, right) => scopeWeight(left) - scopeWeight(right) || left.updatedAt.localeCompare(right.updatedAt));
  const resolved = { ...base };
  for (const rule of applicable) {
    (resolved as Record<string, string | undefined>)[rule.key] = rule.normalizedValue ?? rule.rawValue;
  }
  return resolved;
}

function scopeWeight(rule: GlobalFieldRule): number {
  if (rule.scope.kind === "document") return 0;
  if (rule.scope.kind === "pages") return 1;
  if (rule.scope.kind === "block") return 2;
  return 3;
}

function matchColumnRows(tokens: OCRToken[], rules: MappingRule[]): FieldMatch[][] {
  if (rules.length === 0) return [];
  const sortedRules = [...rules].sort((left, right) => centerX(left.bounds) - centerX(right.bounds));
  const boundaries = sortedRules.map((rule, index) => {
    const previous = sortedRules[index - 1];
    const next = sortedRules[index + 1];
    return {
      rule,
      left: previous ? (centerX(previous.bounds) + centerX(rule.bounds)) / 2 : 0,
      right: next ? (centerX(rule.bounds) + centerX(next.bounds)) / 2 : 1,
    };
  });

  return groupIntoLines(tokens)
    .map((line) =>
      boundaries.map(({ rule, left, right }) => createFieldMatch(
        rule,
        line.filter((token) => centerX(token.bounds) >= left && centerX(token.bounds) < right),
      )),
    )
    .map((row) => row.filter((field): field is FieldMatch => field !== undefined))
    .filter((row) => isPlausibleAthleteRow(row));
}

function matchRepeatedSamples(tokens: OCRToken[], rules: MappingRule[]): FieldMatch[][] {
  if (rules.length === 0) return [];
  const anchorRule =
    rules.find((rule) => rule.target.group === "overall" && rule.target.field === "overallRank") ??
    rules.find((rule) => rule.target.group === "person" && rule.target.field === "fullName") ??
    rules[0]!;
  const sampleAnchorY = centerY(anchorRule.bounds);
  const lines = groupIntoLines(tokens);
  const candidateYs = lines
    .filter((line) => {
      const candidates = line.filter((token) => horizontalOverlap(token.bounds, anchorRule.bounds) > 0.25);
      return candidates.some((token) => formatCompatible(token.text, anchorRule.formatHint));
    })
    .map((line) => line.reduce((sum, token) => sum + centerY(token.bounds), 0) / line.length);

  const seen = new Set<number>();
  const results: FieldMatch[][] = [];
  for (const candidateY of candidateYs) {
    const bucket = Math.round(candidateY * 1000);
    if (seen.has(bucket)) continue;
    seen.add(bucket);
    const deltaY = candidateY - sampleAnchorY;
    const fields = rules
      .map((rule) => {
        const shifted = { ...rule.bounds, y: rule.bounds.y + deltaY };
        const tolerance = Math.max(shifted.height * 0.8, 0.008);
        return createFieldMatch(
          rule,
          tokens.filter((token) => intersects(token.bounds, expandRect(shifted, 0.008, tolerance))),
        );
      })
      .filter((field): field is FieldMatch => field !== undefined);
    if (isPlausibleAthleteRow(fields)) results.push(fields);
  }
  return results;
}

function buildResult(
  fields: FieldMatch[],
  input: ExtractionInput,
  page: number,
  index: number,
): IndividualCompetitionResult | undefined {
  const fieldValues: Record<string, ExtractedValue<string | number>> = {};
  const person: Record<string, string | undefined> = {};
  const disciplineValues = new Map<string, Partial<Record<string, FieldMatch>>>();
  let overallRank: string | undefined;
  let overallPoints: string | undefined;

  for (const field of fields) {
    const path = targetPath(field.rule.target);
    fieldValues[path] = {
      raw: field.value,
      confidence: field.confidence,
      sources: sourceReferences(field.tokens),
    };
    const target = field.rule.target;
    if (target.group === "person") person[target.field] = field.value;
    if (target.group === "overall" && target.field === "overallRank") overallRank = field.value;
    if (target.group === "overall" && target.field === "overallPoints") overallPoints = field.value;
    if (target.group === "discipline") {
      const values = disciplineValues.get(target.disciplineId) ?? {};
      values[target.field] = field;
      disciplineValues.set(target.disciplineId, values);
    }
  }

  const fullName = person.fullName;
  const parsedName = splitAthleteName(fullName);
  const lastName = person.lastName ?? parsedName.lastName;
  const firstName = person.firstName ?? parsedName.firstName;
  const combinedName = [lastName, firstName].filter(Boolean).join(", ");
  const rawName = fullName ?? (combinedName || undefined);
  if (!rawName && !lastName) return undefined;

  const disciplineResults: DisciplineResult[] = [...input.disciplines]
    .sort((left, right) => left.order - right.order)
    .map((discipline) => {
      const values = disciplineValues.get(discipline.id) ?? {};
      const time = values.time?.value;
      const normalizedTime = normalizeTime(time);
      return {
        id: crypto.randomUUID(),
        disciplineId: discipline.id,
        disciplineNumber: discipline.number,
        disciplineName: discipline.name,
        rank: values.rank?.value,
        rawTime: time,
        normalizedTime: normalizedTime?.normalized,
        timeMs: normalizedTime?.timeMs,
        points: values.points?.value,
        penaltyCode: values.penaltyCode?.value,
        penalty: values.penalty?.value,
        sourcePage: page,
        confidence: minimumConfidence(Object.values(values).filter(Boolean) as FieldMatch[]),
      };
    });

  const confidence = minimumConfidence(fields);
  const result: IndividualCompetitionResult = {
    id: crypto.randomUUID(),
    rawName,
    lastName,
    firstName,
    gender: normalizeGender(person.gender ?? input.metadata.gender),
    rawGender: person.gender ?? input.metadata.gender,
    ageGroup: person.ageGroup ?? input.metadata.ageGroup,
    birthYear: normalizeBirthYear(person.birthYear) ?? person.birthYear,
    localClub: person.localClub ?? input.metadata.localClub,
    district: person.district ?? input.metadata.district,
    regionalAssociation: person.regionalAssociation ?? input.metadata.regionalAssociation,
    nationalAssociation: person.nationalAssociation ?? input.metadata.nationalAssociation,
    overallRank,
    overallPoints,
    disciplineResults,
    competitionDate: input.metadata.competitionDate,
    competitionName: input.metadata.competitionName,
    competitionLocation: input.metadata.competitionLocation,
    competitionCode: input.metadata.competitionCode,
    poolLength: input.metadata.poolLength,
    country: input.metadata.country,
    rulebook: input.metadata.rulebook,
    scoring: input.metadata.scoring,
    sourcePages: [page],
    confidence,
    validationState: "valid",
    confirmationState: "suggested",
    fieldValues,
    sourceBlockId: input.block.id,
  };
  const issues = validateResult(result);
  result.validationState = issues.some((issue) => issue.severity === "error")
    ? "error"
    : issues.length > 0
      ? "warning"
      : "valid";
  result.id = `${input.block.id}-athlete-${index}-${hashString(rawName ?? "unknown")}`;
  return result;
}

function groupIntoLines(tokens: OCRToken[]): OCRToken[][] {
  const sorted = [...tokens].sort((left, right) => centerY(left.bounds) - centerY(right.bounds));
  const heights = sorted.map((token) => token.bounds.height).sort((left, right) => left - right);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 0.012;
  const tolerance = Math.max(medianHeight * 0.65, 0.004);
  const lines: OCRToken[][] = [];

  for (const token of sorted) {
    const line = lines.find((candidate) => {
      const averageY = candidate.reduce((sum, item) => sum + centerY(item.bounds), 0) / candidate.length;
      return Math.abs(centerY(token.bounds) - averageY) <= tolerance;
    });
    if (line) line.push(token);
    else lines.push([token]);
  }
  return lines.map((line) => line.sort((left, right) => left.bounds.x - right.bounds.x));
}

function createFieldMatch(rule: MappingRule, tokens: OCRToken[]): FieldMatch | undefined {
  if (tokens.length === 0) return undefined;
  const sorted = [...tokens].sort((left, right) => left.bounds.x - right.bounds.x);
  const value = sorted.map((token) => token.text).join(" ").trim();
  if (!value) return undefined;
  return {
    rule,
    value,
    confidence: minimumConfidence(sorted) ?? 0,
    tokens: sorted,
  };
}

function isPlausibleAthleteRow(fields: FieldMatch[]): boolean {
  const name = fields.find(
    (field) => field.rule.target.group === "person" && ["fullName", "lastName"].includes(field.rule.target.field),
  );
  if (!name || !/[\p{L}]/u.test(name.value)) return false;
  const rank = fields.find(
    (field) => field.rule.target.group === "overall" && field.rule.target.field === "overallRank",
  );
  return !rank || /^\d+\.?$/.test(rank.value.trim());
}

function formatCompatible(value: string, hint: MappingRule["formatHint"]): boolean {
  if (hint === "integer") return /^\d+\.?$/.test(value.trim());
  if (hint === "decimal") return /^\d+(?:[.,]\d+)?$/.test(value.trim());
  if (hint === "time") return normalizeTime(value) !== undefined;
  return value.trim().length > 0;
}

function sourceReferences(tokens: OCRToken[]): SourceReference[] {
  return tokens.map((token) => ({
    page: token.page,
    bounds: token.bounds,
    tokenIds: [token.id],
    sourceKind: token.source,
  }));
}

function targetPath(target: MappingTarget): string {
  if (target.group === "discipline") return `disciplineResults.${target.disciplineId}.${target.field}`;
  return target.field;
}

function minimumConfidence(values: Array<{ confidence: number }>): number | undefined {
  return values.length ? Math.min(...values.map((value) => value.confidence)) : undefined;
}

function centerX(bounds: NormalizedRect): number {
  return bounds.x + bounds.width / 2;
}

function centerY(bounds: NormalizedRect): number {
  return bounds.y + bounds.height / 2;
}

function intersects(left: NormalizedRect, right: NormalizedRect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function horizontalOverlap(left: NormalizedRect, right: NormalizedRect): number {
  const overlap = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  return overlap / Math.max(Math.min(left.width, right.width), 0.0001);
}

function expandRect(bounds: NormalizedRect, horizontal: number, vertical: number): NormalizedRect {
  return {
    x: Math.max(0, bounds.x - horizontal),
    y: Math.max(0, bounds.y - vertical),
    width: Math.min(1, bounds.width + horizontal * 2),
    height: Math.min(1, bounds.height + vertical * 2),
  };
}

function hashString(value: string): string {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}
