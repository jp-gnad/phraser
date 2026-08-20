import { useRef, useState, type DragEvent } from "react";
import { validatePdfFile } from "../utils/fileValidation";

interface PdfUploadProps {
  onFile: (file: File) => void;
  busy?: boolean;
  error?: string;
}

export function PdfUpload({ onFile, busy = false, error }: PdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string>();

  function acceptFile(file: File | undefined) {
    if (!file) return;

    const validation = validatePdfFile(file);
    if (!validation.valid) {
      setValidationError(validation.message);
      return;
    }

    setValidationError(undefined);
    onFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  return (
    <section className="upload-stage" aria-labelledby="upload-heading">
      <div className="upload-copy">
        <span className="eyebrow">Schritt 1 von 8</span>
        <h1 id="upload-heading">Ergebnisliste öffnen</h1>
        <p>
          Laden Sie eine moderne Text-PDF oder einen historischen Scan. Phraser öffnet das
          Dokument ausschließlich lokal und bereitet es für die spätere Zuordnung vor.
        </p>
      </div>

      <div
        className={`drop-zone${isDragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          accept="application/pdf,.pdf"
          aria-label="PDF-Datei auswählen"
          disabled={busy}
          onChange={(event) => acceptFile(event.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
        <div className="document-glyph" aria-hidden="true">
          <span>PDF</span>
        </div>
        <h2>{busy ? "PDF wird geöffnet …" : "PDF hier ablegen"}</h2>
        <p>oder wählen Sie eine Datei von diesem Gerät</p>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {busy ? "Bitte warten" : "PDF auswählen"}
        </button>
        <span className="file-hint">PDF · maximal 250 MB</span>
      </div>

      {(validationError || error) && (
        <div className="error-message" role="alert">
          <strong>Datei konnte nicht geöffnet werden</strong>
          <span>{validationError ?? error}</span>
        </div>
      )}

      <div className="upload-assurance">
        <span aria-hidden="true">01</span>
        <div>
          <strong>Keine Übertragung</strong>
          <p>Die ausgewählte Datei wird nicht an einen Server oder OCR-Dienst gesendet.</p>
        </div>
        <span aria-hidden="true">02</span>
        <div>
          <strong>Original bleibt unverändert</strong>
          <p>Alle späteren Optimierungen arbeiten auf einer abgeleiteten Seitenansicht.</p>
        </div>
      </div>
    </section>
  );
}

