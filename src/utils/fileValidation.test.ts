import { describe, expect, it } from "vitest";
import {
  MAX_PDF_SIZE_BYTES,
  formatFileSize,
  validatePdfFile,
} from "./fileValidation";

function createFile(name: string, type: string, size = 12): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validatePdfFile", () => {
  it("accepts a PDF by MIME type", () => {
    expect(validatePdfFile(createFile("scan.bin", "application/pdf"))).toEqual({
      valid: true,
    });
  });

  it("accepts a PDF by extension when the browser omits its MIME type", () => {
    expect(validatePdfFile(createFile("Ergebnisse.PDF", ""))).toEqual({
      valid: true,
    });
  });

  it("rejects unrelated files", () => {
    expect(validatePdfFile(createFile("results.csv", "text/csv"))).toMatchObject({
      valid: false,
    });
  });

  it("rejects oversized files", () => {
    const file = {
      name: "large.pdf",
      type: "application/pdf",
      size: MAX_PDF_SIZE_BYTES + 1,
    } as File;

    expect(validatePdfFile(file)).toMatchObject({ valid: false });
  });
});

describe("formatFileSize", () => {
  it("uses a localized compact unit", () => {
    expect(formatFileSize(1_572_864)).toBe("1,5 MB");
  });
});
