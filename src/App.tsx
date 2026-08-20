import { Brand } from "./components/Brand";
import { PdfUpload } from "./components/PdfUpload";
import { PdfWorkspace } from "./components/PdfWorkspace";
import { PhaseNavigation } from "./components/PhaseNavigation";
import { PrivacyBadge } from "./components/PrivacyBadge";
import { usePdfDocument } from "./hooks/usePdfDocument";

export default function App() {
  const pdf = usePdfDocument();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <PhaseNavigation />
        <PrivacyBadge />
      </header>

      {pdf.status === "ready" && pdf.file && pdf.document ? (
        <PdfWorkspace document={pdf.document} file={pdf.file} onReplaceFile={pdf.reset} />
      ) : (
        <PdfUpload
          busy={pdf.status === "loading"}
          error={pdf.error}
          onFile={pdf.openFile}
        />
      )}

      <footer className="app-footer">
        <span>Phase 1 · PDF-Basis</span>
        <span>Keine Cloud · Kein Konto · Keine Analytics</span>
      </footer>
    </div>
  );
}

