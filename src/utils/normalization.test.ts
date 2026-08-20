import { describe, expect, it } from "vitest";
import {
  normalizeBirthYear,
  normalizeGender,
  normalizeTime,
  splitAthleteName,
} from "./normalization";

describe("normalization", () => {
  it("normalizes only unambiguous gender values", () => {
    expect(normalizeGender("Herren")).toBe("m");
    expect(normalizeGender("Mädchen")).toBe("w");
    expect(normalizeGender("offen")).toBeUndefined();
  });

  it("keeps two-digit years and shortens four-digit years", () => {
    expect(normalizeBirthYear("09")).toBe("09");
    expect(normalizeBirthYear("1984")).toBe("84");
    expect(normalizeBirthYear("I984")).toBeUndefined();
  });

  it("normalizes supported time syntax without guessing letters", () => {
    expect(normalizeTime("1:02.30")).toEqual({ normalized: "1:02,30", timeMs: 62_300 });
    expect(normalizeTime("51,9")).toEqual({ normalized: "51,9", timeMs: 51_900 });
    expect(normalizeTime("S1.9")).toBeUndefined();
  });

  it("splits comma-separated names but leaves ambiguous names intact", () => {
    expect(splitAthleteName("Müller, Max")).toEqual({
      rawName: "Müller, Max",
      lastName: "Müller",
      firstName: "Max",
    });
    expect(splitAthleteName("Müller Max")).toEqual({ rawName: "Müller Max" });
  });
});

