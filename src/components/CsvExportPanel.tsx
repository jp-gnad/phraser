import { useMemo, useState, type DragEvent } from "react";
import type { DisciplineDefinition, IndividualCompetitionResult } from "../models";
import { generateCsv } from "../export/csv";

interface CsvExportPanelProps {
  results: IndividualCompetitionResult[];
  disciplines: DisciplineDefinition[];
  onReorderDisciplines: (disciplines: DisciplineDefinition[]) => void;
}

export function CsvExportPanel({
  results,
  disciplines,
  onReorderDisciplines,
}: CsvExportPanelProps) {
  const [draggedId, setDraggedId] = useState<string>();
  const ordered = [...disciplines].sort((left, right) => left.order - right.order);
  const confirmed = results.filter((result) => result.confirmationState === "confirmed");
  const exportResult = useMemo(
    () => (confirmed.length > 0 ? generateCsv(confirmed, ordered) : undefined),
    [confirmed, ordered],
  );

  function move(id: string, direction: -1 | 1) {
    const current = ordered.findIndex((item) => item.id === id);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[current], next[target]] = [next[target]!, next[current]!];
    onReorderDisciplines(next.map((item, index) => ({ ...item, order: index })));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const next = [...ordered];
    const from = next.findIndex((item) => item.id === draggedId);
    const to = next.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onReorderDisciplines(next.map((discipline, index) => ({ ...discipline, order: index })));
    setDraggedId(undefined);
  }

  function download() {
    if (!exportResult) return;
    const url = URL.createObjectURL(new Blob([exportResult.csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportResult.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="export-panel" aria-labelledby="export-heading">
      <div className="export-summary">
        <span className="eyebrow">Export</span>
        <h2 id="export-heading">CSV für Einzelergebnisse</h2>
        <p>{confirmed.length} von {results.length} Teilnehmern sind bestätigt und werden exportiert. Nicht bestätigte Datensätze bleiben ausgeschlossen.</p>
        <div className="export-metrics">
          <div><strong>{confirmed.length}</strong><span>CSV-Zeilen</span></div>
          <div><strong>{13 + disciplines.length * 5 + 3}</strong><span>Spalten</span></div>
          <div><strong>{disciplines.length}</strong><span>Disziplinen</span></div>
        </div>
      </div>

      <div className="discipline-order-panel">
        <h3>Disziplinreihenfolge</h3>
        <p>Per Drag & Drop oder Pfeiltasten sortieren. Jede Disziplin erzeugt exakt fünf Spalten.</p>
        <div className="discipline-order-list">
          {ordered.map((discipline, index) => (
            <div
              draggable
              key={discipline.id}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedId(discipline.id)}
              onDrop={(event) => handleDrop(event, discipline.id)}
            >
              <span className="drag-handle" aria-hidden="true">⠿</span>
              <strong>{index + 1}</strong>
              <span>{discipline.name}</span>
              <button aria-label="Nach oben" disabled={index === 0} onClick={() => move(discipline.id, -1)} type="button">↑</button>
              <button aria-label="Nach unten" disabled={index === ordered.length - 1} onClick={() => move(discipline.id, 1)} type="button">↓</button>
            </div>
          ))}
        </div>
      </div>

      <div className="csv-preview-panel">
        <div className="csv-preview-heading">
          <div><h3>CSV-Vorschau</h3><span>UTF-8 BOM · Semikolon · eine Person pro Zeile</span></div>
          <button className="primary-button" disabled={!exportResult} onClick={download} type="button">CSV herunterladen</button>
        </div>
        {exportResult ? (
          <div className="csv-preview-scroll">
            <table>
              <thead><tr>{exportResult.header.map((header, index) => <th key={`${header}-${index}`}>{header || <em>reserviert</em>}</th>)}</tr></thead>
              <tbody>{exportResult.rows.slice(0, 8).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : (
          <div className="empty-results"><strong>Keine bestätigten Teilnehmer</strong><span>Bestätigen Sie geprüfte Datensätze in der Kontrolltabelle.</span></div>
        )}
      </div>
    </section>
  );
}
