import { describe, expect, it } from "vitest";
import { combineOcrBatchProgress, normalizeOcrPageSelection } from "./ocrBatch";

describe("normalizeOcrPageSelection", () => {
  it("keeps only active selected pages in document order", () => {
    expect(normalizeOcrPageSelection([5, 2, 2, 9], [1, 2, 4, 5])).toEqual([2, 5]);
  });

  it("returns an empty list when none of the selected pages is active", () => {
    expect(normalizeOcrPageSelection([2, 3], [1, 4])).toEqual([]);
  });
});

describe("combineOcrBatchProgress", () => {
  it("combines page and local progress into one stable overall value", () => {
    expect(combineOcrBatchProgress(1, 4, 0.5)).toBe(0.375);
    expect(combineOcrBatchProgress(3, 4, 1)).toBe(1);
  });

  it("clamps invalid progress input", () => {
    expect(combineOcrBatchProgress(0, 2, -1)).toBe(0);
    expect(combineOcrBatchProgress(5, 2, 2)).toBe(1);
    expect(combineOcrBatchProgress(0, 0, 0.5)).toBe(0);
  });
});
