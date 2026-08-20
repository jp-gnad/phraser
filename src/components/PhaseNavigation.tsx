export type AppPhase = "file" | "ocr" | "mapping" | "participants" | "review" | "export";

const phases: Array<{ id: AppPhase; label: string }> = [
  { id: "file", label: "Datei" },
  { id: "ocr", label: "OCR" },
  { id: "mapping", label: "Mapping" },
  { id: "participants", label: "Teilnehmer" },
  { id: "review", label: "Prüfen" },
  { id: "export", label: "Export" },
];

interface PhaseNavigationProps {
  active: AppPhase;
  enabled: boolean;
  onChange: (phase: AppPhase) => void;
}

export function PhaseNavigation({ active, enabled, onChange }: PhaseNavigationProps) {
  return (
    <nav className="phase-navigation" aria-label="Arbeitsphasen">
      {phases.map((phase, index) => (
        <button
          className={phase.id === active ? "phase-item is-active" : "phase-item"}
          disabled={!enabled && index > 0}
          key={phase.id}
          onClick={() => onChange(phase.id)}
          type="button"
        >
          <span className="phase-number">{index + 1}</span>
          {phase.label}
        </button>
      ))}
    </nav>
  );
}
