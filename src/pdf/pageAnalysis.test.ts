import { describe, expect, it } from "vitest";
import { assessTextLayer } from "./pageAnalysis";

describe("assessTextLayer", () => {
  it("marks empty text layers as missing", () => {
    expect(assessTextLayer([])).toMatchObject({
      quality: "missing",
      tokenCount: 0,
    });
  });

  it("recognizes a plausible text layer", () => {
    const assessment = assessTextLayer([
      { str: "Platz" },
      { str: "Müller, Max" },
      { str: "Gesamtpunkte" },
      { str: "2865" },
    ]);

    expect(assessment.quality).toBe("good");
    expect(assessment.printableCharacterRatio).toBe(1);
  });
});

