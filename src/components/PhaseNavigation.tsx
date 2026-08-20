const phases = ["Datei", "OCR", "Mapping", "Teilnehmer", "Prüfen", "Export"] as const;

export function PhaseNavigation() {
  return (
    <nav className="phase-navigation" aria-label="Arbeitsphasen">
      {phases.map((phase, index) => (
        <button
          className={index === 0 ? "phase-item is-active" : "phase-item"}
          disabled={index > 0}
          key={phase}
          title={index > 0 ? "Wird in einer folgenden Entwicklungsphase freigeschaltet" : undefined}
          type="button"
        >
          <span className="phase-number">{index + 1}</span>
          {phase}
        </button>
      ))}
    </nav>
  );
}

