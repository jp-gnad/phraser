import { describe, expect, it } from "vitest";
import type {
  DisciplineDefinition,
  MappingRule,
  MappingTarget,
  OCRToken,
  ResultBlock,
} from "../models";
import { extractResults } from "./extractResults";

const disciplines: DisciplineDefinition[] = [
  { id: "d1", name: "100 m Hindernisschwimmen", order: 0, isIndividual: true },
];

function token(id: string, text: string, x: number, y: number, confidence = 96): OCRToken {
  return {
    id,
    text,
    confidence,
    confidenceLevel: confidence >= 90 ? "safe" : confidence >= 70 ? "review" : "critical",
    page: 1,
    bounds: { x, y, width: 0.08, height: 0.02 },
    source: "ocr",
  };
}

function rule(id: string, target: MappingTarget, x: number, y: number, formatHint: MappingRule["formatHint"] = "text"): MappingRule {
  return {
    id,
    mode: "columns",
    target,
    bounds: { x, y, width: 0.08, height: 0.02 },
    relativeTo: "result-block",
    joinStrategy: "region",
    required: target.group === "person",
    formatHint,
    samplePage: 1,
  };
}

const individualBlock: ResultBlock = {
  id: "block-1",
  name: "Einzel",
  pages: [1],
  boundsByPage: { 1: [{ x: 0, y: 0.1, width: 1, height: 0.8 }] },
  classification: "individual",
  classificationConfirmed: true,
  metadataRuleIds: [],
  disciplineIds: ["d1"],
};

describe("extractResults", () => {
  it("extracts one wide row per athlete and preserves discipline status fields", () => {
    const tokens = [
      token("r1", "1", 0.08, 0.2), token("n1", "Müller,", 0.26, 0.2), token("n2", "Max", 0.34, 0.2),
      token("p1", "2865", 0.51, 0.2), token("t1", "1:02,3", 0.7, 0.2, 68), token("dp1", "949", 0.86, 0.2),
      token("r2", "2", 0.08, 0.3), token("n3", "Schmidt,", 0.26, 0.3), token("n4", "Erika", 0.34, 0.3),
      token("p2", "2800", 0.51, 0.3), token("t2", "59,8", 0.7, 0.3), token("dp2", "930", 0.86, 0.3),
    ];
    const rules = [
      rule("rank", { group: "overall", field: "overallRank" }, 0.08, 0.2, "integer"),
      rule("name", { group: "person", field: "fullName" }, 0.3, 0.2),
      rule("points", { group: "overall", field: "overallPoints" }, 0.51, 0.2, "decimal"),
      rule("time", { group: "discipline", disciplineId: "d1", field: "time" }, 0.7, 0.2, "time"),
      rule("discipline-points", { group: "discipline", disciplineId: "d1", field: "points" }, 0.86, 0.2, "decimal"),
    ];

    const results = extractResults({
      tokens,
      block: individualBlock,
      rules,
      disciplines,
      mode: "columns",
      metadata: { gender: "weiblich", competitionName: "Test" },
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ lastName: "Müller", firstName: "Max", overallPoints: "2865", gender: "w" });
    expect(results[0]!.disciplineResults[0]).toMatchObject({ rawTime: "1:02,3", normalizedTime: "1:02,3", points: "949" });
    expect(results[0]!.confidence).toBe(68);
    expect(results[0]!.confirmationState).toBe("suggested");
  });

  it("never extracts an unconfirmed or team/relay block", () => {
    const rules = [rule("name", { group: "person", field: "fullName" }, 0.3, 0.2)];
    const teamBlock: ResultBlock = { ...individualBlock, classification: "team-or-relay" };
    const unconfirmed: ResultBlock = { ...individualBlock, classificationConfirmed: false };
    const input = { tokens: [token("n1", "Team", 0.3, 0.2)], rules, disciplines, mode: "columns" as const, metadata: {} };
    expect(extractResults({ ...input, block: teamBlock })).toEqual([]);
    expect(extractResults({ ...input, block: unconfirmed })).toEqual([]);
  });

  it("applies page and block scoped metadata with the most specific value winning", () => {
    const results = extractResults({
      tokens: [token("n1", "Müller, Max", 0.3, 0.2)],
      block: individualBlock,
      rules: [rule("name", { group: "person", field: "fullName" }, 0.3, 0.2)],
      disciplines,
      mode: "columns",
      metadata: { ageGroup: "offen" },
      globalRules: [
        { id: "g1", key: "ageGroup", rawValue: "Jugend", scope: { kind: "pages", pages: [1] }, updatedAt: "2020-01-01" },
        { id: "g2", key: "ageGroup", rawValue: "Junioren", scope: { kind: "block", blockId: "block-1" }, updatedAt: "2020-01-02" },
      ],
    });
    expect(results[0]?.ageGroup).toBe("Junioren");
  });

  it("repeats a multi-line example-athlete geometry", () => {
    const rankRule = { ...rule("rank", { group: "overall", field: "overallRank" }, 0.08, 0.2, "integer"), mode: "example-athlete" as const, relativeTo: "sample-athlete" as const };
    const nameRule = { ...rule("name", { group: "person", field: "fullName" }, 0.3, 0.23), mode: "example-athlete" as const, relativeTo: "sample-athlete" as const };
    const results = extractResults({
      tokens: [
        token("r1", "1", 0.08, 0.2),
        token("n1", "Müller, Max", 0.3, 0.23),
        token("r2", "2", 0.08, 0.5),
        token("n2", "Schmidt, Erika", 0.3, 0.53),
      ],
      block: individualBlock,
      rules: [rankRule, nameRule],
      disciplines,
      mode: "example-athlete",
      metadata: {},
    });
    expect(results.map((result) => result.lastName)).toEqual(["Müller", "Schmidt"]);
    expect(results.map((result) => result.overallRank)).toEqual(["1", "2"]);
  });
});
