import { describe, expect, it } from "vitest";
import type { DisciplineDefinition, IndividualCompetitionResult } from "../models";
import { generateCsv } from "./csv";

const disciplines: DisciplineDefinition[] = [
  { id: "d1", name: "100 m Hindernisschwimmen", order: 0, isIndividual: true },
  { id: "d2", name: "50 m Schleppen", order: 1, isIndividual: true },
];

const athlete: IndividualCompetitionResult = {
  id: "a1",
  lastName: "Müller",
  firstName: "Max",
  gender: "m",
  birthYear: "1984",
  overallRank: "2",
  overallPoints: "2865",
  disciplineResults: [
    { id: "r1", disciplineId: "d1", disciplineName: disciplines[0]!.name, rawTime: "1:02.3", points: "949" },
    { id: "r2", disciplineId: "d2", disciplineName: disciplines[1]!.name, penaltyCode: "DQ33", penalty: "disq." },
  ],
  competitionDate: "1996-05-12",
  competitionName: "Bezirksmeisterschaft; Süd",
  competitionLocation: "Karlsruhe",
  sourcePages: [1],
  sourceBlockId: "b1",
  validationState: "valid",
  confirmationState: "confirmed",
};

describe("generateCsv", () => {
  it("preserves exact reserved and dynamic column positions", () => {
    const result = generateCsv([athlete], disciplines);
    expect(result.header).toHaveLength(26);
    expect(result.header.slice(9, 16)).toEqual([
      "Gesamtplatzierung",
      "Gesamtpunktzahl",
      "",
      "",
      "Platzierung Disziplin 1",
      "Zeit Disziplin 1",
      "Punkte Disziplin 1",
    ]);
    expect(result.header.slice(-3)).toEqual(["Datum", "Wettkampf Name", "Wettkampfort"]);
    expect(result.rows[0]).toHaveLength(result.header.length);
  });

  it("uses BOM, semicolons, CRLF and correct quoting", () => {
    const result = generateCsv([athlete], disciplines);
    expect(result.csv.startsWith("\uFEFFNachname;Vorname")).toBe(true);
    expect(result.csv).toContain('"Bezirksmeisterschaft; Süd"');
    expect(result.csv).toContain("\r\n");
  });

  it("keeps status and penalty text", () => {
    const result = generateCsv([athlete], disciplines);
    expect(result.rows[0]).toContain("DQ33");
    expect(result.rows[0]).toContain("disq.");
  });
});
