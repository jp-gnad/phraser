import { useEffect, useState } from "react";
import { Brand } from "./components/Brand";
import { PdfUpload } from "./components/PdfUpload";
import { PdfWorkspace } from "./components/PdfWorkspace";
import { PhaseNavigation, type AppPhase } from "./components/PhaseNavigation";
import { PrivacyBadge } from "./components/PrivacyBadge";
import { usePdfDocument } from "./hooks/usePdfDocument";

export default function App() {
  const pdf = usePdfDocument();
  const [activePhase, setActivePhase] = useState<AppPhase>("file");

  useEffect(() => {
    if (pdf.status !== "ready") setActivePhase("file");
  }, [pdf.status]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <PhaseNavigation
          active={activePhase}
          enabled={pdf.status === "ready"}
          onChange={setActivePhase}
        />
        <PrivacyBadge />
      </header>

      {pdf.status === "ready" && pdf.file && pdf.document ? (
        <PdfWorkspace
          activePhase={activePhase}
          document={pdf.document}
          file={pdf.file}
          onPhaseChange={setActivePhase}
          onReplaceFile={pdf.reset}
        />
      ) : (
        <PdfUpload
          busy={pdf.status === "loading"}
          error={pdf.error}
          onFile={pdf.openFile}
        />
      )}

      <footer className="app-footer">
        <span>Version 1 · Lokaler OCR- und Mapping-Arbeitsbereich</span>
        <span>Keine Cloud · Kein Konto · Keine Analytics</span>
      </footer>
    </div>
  );
}
