import { useMemo, useState } from "react";
import type { DisciplineDefinition, IndividualCompetitionResult } from "../models";

interface ResultsGridProps {
  results: IndividualCompetitionResult[];
  disciplines: DisciplineDefinition[];
  reviewMode?: boolean;
  onFieldChange: (resultId: string, fieldPath: string, value: string) => void;
  onDelete: (resultId: string) => void;
  onConfirmationChange: (resultId: string, confirmed: boolean) => void;
  onConfirmAllVisible: (resultIds: string[]) => void;
  onOpenSource: (resultId: string, fieldPath: string) => void;
}

export function ResultsGrid({
  results,
  disciplines,
  reviewMode = false,
  onFieldChange,
  onDelete,
  onConfirmationChange,
  onConfirmAllVisible,
  onOpenSource,
}: ResultsGridProps) {
  const [search, setSearch] = useState("");
  const [onlyWarnings, setOnlyWarnings] = useState(reviewMode);
  const [sortBy, setSortBy] = useState<"name" | "rank" | "confidence">("rank");

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de-DE");
    return [...results]
      .filter((result) => !onlyWarnings || result.validationState !== "valid")
      .filter((result) =>
        !query || [result.rawName, result.lastName, result.firstName, result.ageGroup, result.localClub]
          .some((value) => value?.toLocaleLowerCase("de-DE").includes(query)),
      )
      .sort((left, right) => {
        if (sortBy === "confidence") return (left.confidence ?? 0) - (right.confidence ?? 0);
        if (sortBy === "name") return (left.rawName ?? left.lastName ?? "").localeCompare(right.rawName ?? right.lastName ?? "", "de");
        return Number.parseInt(left.overallRank ?? "99999", 10) - Number.parseInt(right.overallRank ?? "99999", 10);
      });
  }, [onlyWarnings, results, search, sortBy]);

  return (
    <section className="results-panel" aria-labelledby="results-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{reviewMode ? "Prüfen" : "Teilnehmer"}</span>
          <h2 id="results-heading">{results.length} Einzelergebnisse</h2>
        </div>
        <div className="results-controls">
          <input aria-label="Teilnehmer suchen" onChange={(event) => setSearch(event.target.value)} placeholder="Suchen …" type="search" value={search} />
          <select aria-label="Sortierung" onChange={(event) => setSortBy(event.target.value as typeof sortBy)} value={sortBy}>
            <option value="rank">Gesamtplatz</option>
            <option value="name">Name</option>
            <option value="confidence">Unsicherheit</option>
          </select>
          <label><input checked={onlyWarnings} onChange={(event) => setOnlyWarnings(event.target.checked)} type="checkbox" /> Nur Warnungen</label>
          <button disabled={visible.length === 0} onClick={() => onConfirmAllVisible(visible.map((item) => item.id))} type="button">Sichtbare bestätigen</button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="empty-results">
          <strong>Noch keine Teilnehmer extrahiert</strong>
          <span>Definieren Sie im Mapping mindestens den Namen und wenden Sie das Muster an.</span>
        </div>
      ) : (
        <div className="results-table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th>Prüfung</th>
                <th>Nachname</th>
                <th>Vorname</th>
                <th>Gender</th>
                <th>AK</th>
                <th>Jg</th>
                <th>Ortsgruppe</th>
                <th>Gesamtplatz</th>
                <th>Gesamtpunkte</th>
                {disciplines.map((discipline, index) => <th key={discipline.id}>D{index + 1} · {discipline.name}</th>)}
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((result) => (
                <tr className={`row-${result.validationState}`} key={result.id}>
                  <td>
                    <label className="confirmation-toggle">
                      <input
                        checked={result.confirmationState === "confirmed"}
                        onChange={(event) => onConfirmationChange(result.id, event.target.checked)}
                        type="checkbox"
                      />
                      <span>{result.confirmationState === "confirmed" ? "bestätigt" : "offen"}</span>
                    </label>
                  </td>
                  <EditableCell field="lastName" result={result} onChange={onFieldChange} onOpenSource={onOpenSource} />
                  <EditableCell field="firstName" result={result} onChange={onFieldChange} onOpenSource={onOpenSource} />
                  <EditableCell field="gender" result={result} onChange={onFieldChange} onOpenSource={onOpenSource} />
                  <EditableCell field="ageGroup" result={result} onChange={onFieldChange} onOpenSource={onOpenSource} />
                  <EditableCell field="birthYear" result={result} onChange={onFieldChange} onOpenSource={onOpenSource} />
                  <EditableCell field="localClub" result={result} onChange={onFieldChange} onOpenSource={onOpenSource} />
                  <EditableCell field="overallRank" result={result} onChange={onFieldChange} onOpenSource={onOpenSource} />
                  <EditableCell field="overallPoints" result={result} onChange={onFieldChange} onOpenSource={onOpenSource} />
                  {disciplines.map((discipline) => {
                    const entry = result.disciplineResults.find((item) => item.disciplineId === discipline.id);
                    return (
                      <td className="discipline-cell" key={discipline.id}>
                        {(["rank", "rawTime", "points", "penaltyCode", "penalty"] as const).map((field) => (
                          <label key={field}>
                            <span>{disciplineFieldLabels[field]}</span>
                            <input
                              aria-label={`${discipline.name} ${disciplineFieldLabels[field]}`}
                              onChange={(event) => onFieldChange(result.id, `disciplineResults.${discipline.id}.${field}`, event.target.value)}
                              onFocus={() => onOpenSource(result.id, `disciplineResults.${discipline.id}.${field === "rawTime" ? "time" : field}`)}
                              value={entry?.[field] ?? ""}
                            />
                          </label>
                        ))}
                      </td>
                    );
                  })}
                  <td>
                    <span className={`validation-badge is-${result.validationState}`}>{result.validationState}</span>
                    <small>{Math.round(result.confidence ?? 0)} %</small>
                  </td>
                  <td><button className="delete-row" aria-label="Teilnehmer löschen" onClick={() => onDelete(result.id)} type="button">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface EditableCellProps {
  result: IndividualCompetitionResult;
  field: "lastName" | "firstName" | "gender" | "ageGroup" | "birthYear" | "localClub" | "overallRank" | "overallPoints";
  onChange: ResultsGridProps["onFieldChange"];
  onOpenSource: ResultsGridProps["onOpenSource"];
}

function EditableCell({ result, field, onChange, onOpenSource }: EditableCellProps) {
  return (
    <td>
      <input
        aria-label={field}
        onChange={(event) => onChange(result.id, field, event.target.value)}
        onFocus={() => onOpenSource(result.id, field)}
        value={result[field] ?? ""}
      />
    </td>
  );
}

const disciplineFieldLabels = {
  rank: "Platz",
  rawTime: "Zeit",
  points: "Punkte",
  penaltyCode: "Code",
  penalty: "Strafe",
};

