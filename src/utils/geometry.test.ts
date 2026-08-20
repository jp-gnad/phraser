import { describe, expect, it } from "vitest";
import type { NormalizedRect, PageRotation } from "../models";
import { inversePageRotation, rotateNormalizedRect } from "./geometry";

describe("rotateNormalizedRect", () => {
  const source: NormalizedRect = { x: 0.1, y: 0.2, width: 0.3, height: 0.15 };

  it.each<PageRotation>([0, 90, 180, 270])(
    "preserves canonical geometry through a %s° round trip",
    (rotation) => {
      const displayed = rotateNormalizedRect(source, rotation);
      const restored = rotateNormalizedRect(displayed, inversePageRotation(rotation));
      expect(restored.x).toBeCloseTo(source.x);
      expect(restored.y).toBeCloseTo(source.y);
      expect(restored.width).toBeCloseTo(source.width);
      expect(restored.height).toBeCloseTo(source.height);
    },
  );

  it("swaps dimensions for a quarter turn", () => {
    expect(rotateNormalizedRect(source, 90)).toEqual({
      x: 0.65,
      y: 0.1,
      width: 0.15,
      height: 0.3,
    });
  });
});
