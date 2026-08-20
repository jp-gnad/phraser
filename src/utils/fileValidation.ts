export const PDF_MIME_TYPE = "application/pdf";
export const MAX_PDF_SIZE_BYTES = 250 * 1024 * 1024;

export type PdfFileValidation =
  | { valid: true }
  | { valid: false; message: string };

export function validatePdfFile(file: File): PdfFileValidation {
  const hasPdfExtension = file.name.toLocaleLowerCase().endsWith(".pdf");
  const hasPdfMime = file.type === PDF_MIME_TYPE;

  if (!hasPdfExtension && !hasPdfMime) {
    return {
      valid: false,
      message: "Bitte wählen Sie eine PDF-Datei aus.",
    };
  }

  if (file.size === 0) {
    return { valid: false, message: "Die ausgewählte PDF-Datei ist leer." };
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return {
      valid: false,
      message: "Die PDF ist größer als 250 MB. Bitte teilen Sie das Dokument auf.",
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }

  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${unit}`;
}

