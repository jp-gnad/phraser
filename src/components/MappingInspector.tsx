import { useMemo, useState } from "react";
import type {
  BlockClassification,
  DisciplineDefinition,
  MappingMode,
  MappingRule,
  MappingTarget,
  MappingTemplate,
  OCRToken,
  ResultBlock,
  WorkspaceMetadata,
} from "../models";
import { TemplateManager } from "./TemplateManager";

interface MappingInspectorProps {
  page: number;
  tokens: OCRToken[];
  selectedTokenIds: string[];
  blocks: ResultBlock[];
  activeBlockId?: string;
  drawingBlock: boolean;
  mode: MappingMode;
  rules: MappingRule[];
  disciplines: DisciplineDefinition[];
  metadata: WorkspaceMetadata;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDrawingBlockChange: (drawing: boolean) => void;
  onAddFullPageBlock: () => void;
  onActiveBlockChange: (id: string) => void;
  onBlockClassificationChange: (id: string, classification: BlockClassification) => void;
  onDeleteBlock: (id: string) => void;
  onModeChange: (mode: MappingMode) => void;
  onAssign: (target: MappingTarget) => void;
  onDeleteRule: (id: string) => void;
  onAddDiscipline: (name: string) => void;
  onUpdateDiscipline: (id: string, name: string) => void;
  onDeleteDiscipline: (id: string) => void;
  onMetadataChange: (metadata: WorkspaceMetadata) => void;
  onApplyPattern: () => void;
  createTemplate: (name: string) => MappingTemplate;
  onLoadTemplate: (template: MappingTemplate) => void;
}

export function MappingInspector(props: MappingInspectorProps) {
  const [targetValue, setTargetValue] = useState("person.fullName");
  const [disciplineName, setDisciplineName] = useState("");
  const pageBlocks = props.blocks.filter((block) => block.pages.includes(props.page));
  const activeBlock = props.blocks.find((block) => block.id === props.activeBlockId);
  const targetOptions = useMemo(() => createTargetOptions(props.disciplines), [props.disciplines]);

  function addDiscipline() {
    if (!disciplineName.trim()) return;
    props.onAddDiscipline(disciplineName.trim());
    setDisciplineName("");
  }

  return (
    <aside className="inspector mapping-inspector" aria-label="Mapping-Eigenschaften">
      <section className="inspector-section mapping-header">
        <div>
          <span className="inspector-kicker">Visuelles Mapping</span>
          <h2>Struktur definieren</h2>
        </div>
        <div className="history-buttons">
          <button aria-label="Rückgängig" disabled={!props.canUndo} onClick={props.onUndo} type="button">↶</button>
          <button aria-label="Wiederholen" disabled={!props.canRedo} onClick={props.onRedo} type="button">↷</button>
        </div>
      </section>

      <details className="inspector-details" open>
        <summary>1 · Ergebnisblöcke</summary>
        <div className="details-content">
          <div className="button-grid two-columns">
            <button
              className={props.drawingBlock ? "is-active" : ""}
              onClick={() => props.onDrawingBlockChange(!props.drawingBlock)}
              type="button"
            >
              {props.drawingBlock ? "Bereich jetzt aufziehen" : "Bereich aufziehen"}
            </button>
            <button onClick={props.onAddFullPageBlock} type="button">Ganze Seite</button>
          </div>
          {pageBlocks.length === 0 ? <p className="empty-note">Noch kein Ergebnisblock auf dieser Seite.</p> : null}
          {pageBlocks.map((block) => (
            <div className={`block-row${block.id === props.activeBlockId ? " is-active" : ""}`} key={block.id}>
              <button onClick={() => props.onActiveBlockChange(block.id)} type="button">{block.name}</button>
              <select
                aria-label={`Klassifikation ${block.name}`}
                onChange={(event) => props.onBlockClassificationChange(block.id, event.target.value as BlockClassification)}
                value={block.classification}
              >
                <option value="individual">Einzel</option>
                <option value="team-or-relay">Mannschaft / Staffel</option>
                <option value="ignore">Ignorieren</option>
              </select>
              <button aria-label={`${block.name} löschen`} onClick={() => props.onDeleteBlock(block.id)} type="button">×</button>
            </div>
          ))}
          {activeBlock?.classification === "individual" ? (
            <p className="safe-note">Dieser bestätigte Einzelblock darf nach Prüfung exportiert werden.</p>
          ) : activeBlock ? (
            <p className="warning-note">Dieser Block wird vom Export ausgeschlossen.</p>
          ) : null}
        </div>
      </details>

      <details className="inspector-details" open>
        <summary>2 · Mapping-Modus und Felder</summary>
        <div className="details-content">
          <div className="segmented-control">
            <button className={props.mode === "columns" ? "is-active" : ""} onClick={() => props.onModeChange("columns")} type="button">Spalten</button>
            <button className={props.mode === "example-athlete" ? "is-active" : ""} onClick={() => props.onModeChange("example-athlete")} type="button">Beispielteilnehmer</button>
          </div>
          <p className="mapping-help">
            {props.mode === "columns"
              ? "Wählen Sie eine Beispielzelle je Spalte. Zeilen werden anhand ihrer Y-Position gruppiert."
              : "Wählen Sie die Werte eines vollständigen Beispielteilnehmers. Relative Positionen werden wiederholt gesucht."}
          </p>
          <div className="selection-summary">
            <strong>{props.selectedTokenIds.length}</strong>
            <span>Textelemente ausgewählt</span>
          </div>
          <select aria-label="Feldtyp" onChange={(event) => setTargetValue(event.target.value)} value={targetValue}>
            {targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button
            className="primary-button full-width"
            disabled={props.selectedTokenIds.length === 0 || !activeBlock}
            onClick={() => props.onAssign(parseTarget(targetValue))}
            type="button"
          >
            Auswahl zuordnen
          </button>
          <div className="rule-list">
            {props.rules.map((rule) => (
              <div key={rule.id}>
                <span>{targetLabel(rule.target, props.disciplines)}</span>
                <button aria-label="Regel löschen" onClick={() => props.onDeleteRule(rule.id)} type="button">×</button>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details className="inspector-details" open>
        <summary>3 · Disziplinen</summary>
        <div className="details-content">
          <div className="compact-row">
            <input onChange={(event) => setDisciplineName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addDiscipline()} placeholder="Disziplinname" value={disciplineName} />
            <button onClick={addDiscipline} type="button">Hinzufügen</button>
          </div>
          {props.disciplines.map((discipline, index) => (
            <div className="discipline-edit-row" key={discipline.id}>
              <span>{index + 1}</span>
              <input onChange={(event) => props.onUpdateDiscipline(discipline.id, event.target.value)} value={discipline.name} />
              <button aria-label="Disziplin löschen" onClick={() => props.onDeleteDiscipline(discipline.id)} type="button">×</button>
            </div>
          ))}
        </div>
      </details>

      <details className="inspector-details">
        <summary>4 · Globale Werte</summary>
        <div className="details-content metadata-grid">
          {metadataFields.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <input
                onChange={(event) => props.onMetadataChange({ ...props.metadata, [field.key]: event.target.value })}
                type={field.key === "competitionDate" ? "date" : "text"}
                value={props.metadata[field.key] ?? ""}
              />
            </label>
          ))}
        </div>
      </details>

      <details className="inspector-details">
        <summary>5 · Templates</summary>
        <div className="details-content">
          <TemplateManager createTemplate={props.createTemplate} onLoad={props.onLoadTemplate} />
        </div>
      </details>

      <section className="mapping-action">
        <button
          className="primary-button full-width"
          disabled={!activeBlock || props.rules.length === 0}
          onClick={props.onApplyPattern}
          type="button"
        >
          Muster auf Einzelblöcke anwenden
        </button>
        <span>{props.tokens.length} Text-/OCR-Elemente auf Seite {props.page}</span>
      </section>
    </aside>
  );
}

const metadataFields: Array<{ key: keyof WorkspaceMetadata; label: string }> = [
  { key: "gender", label: "Gender" },
  { key: "ageGroup", label: "Altersklasse" },
  { key: "localClub", label: "Ortsgruppe" },
  { key: "district", label: "Bezirk" },
  { key: "regionalAssociation", label: "Landesverband" },
  { key: "nationalAssociation", label: "Bundesverband" },
  { key: "competitionDate", label: "Wettkampf-Enddatum" },
  { key: "competitionName", label: "Wettkampfname" },
  { key: "competitionLocation", label: "Wettkampfort" },
  { key: "competitionCode", label: "Wettkampf-Code" },
  { key: "poolLength", label: "Bahnlänge" },
  { key: "country", label: "Land" },
  { key: "rulebook", label: "Regelwerk" },
  { key: "scoring", label: "Wertung" },
];

function createTargetOptions(disciplines: DisciplineDefinition[]) {
  const base = [
    ["person.fullName", "Person · vollständiger Name"],
    ["person.lastName", "Person · Nachname"],
    ["person.firstName", "Person · Vorname"],
    ["person.gender", "Person · Gender"],
    ["person.ageGroup", "Person · Altersklasse"],
    ["person.birthYear", "Person · Jahrgang"],
    ["person.localClub", "Person · Ortsgruppe"],
    ["person.district", "Person · Bezirk"],
    ["person.regionalAssociation", "Person · Landesverband"],
    ["person.nationalAssociation", "Person · Bundesverband"],
    ["overall.overallRank", "Gesamtwertung · Platzierung"],
    ["overall.overallPoints", "Gesamtwertung · Punktzahl"],
  ].map(([value, label]) => ({ value: value!, label: label! }));
  return [
    ...base,
    ...disciplines.flatMap((discipline, index) =>
      [
        ["rank", "Platzierung"],
        ["time", "Zeit"],
        ["points", "Punkte"],
        ["penaltyCode", "Strafcode"],
        ["penalty", "Strafe"],
      ].map(([field, label]) => ({
        value: `discipline:${discipline.id}:${field}`,
        label: `Disziplin ${index + 1} · ${discipline.name} · ${label}`,
      })),
    ),
    { value: "other.ignore", label: "Sonstige · ignorieren" },
  ];
}

function parseTarget(value: string): MappingTarget {
  if (value.startsWith("discipline:")) {
    const [, disciplineId, field] = value.split(":");
    return { group: "discipline", disciplineId: disciplineId!, field: field as "rank" | "time" | "points" | "penaltyCode" | "penalty" };
  }
  const [group, field] = value.split(".");
  if (group === "person") return { group, field: field as "fullName" };
  if (group === "overall") return { group, field: field as "overallRank" | "overallPoints" };
  return { group: "other", field: "ignore" };
}

function targetLabel(target: MappingTarget, disciplines: DisciplineDefinition[]): string {
  if (target.group === "discipline") {
    const discipline = disciplines.find((item) => item.id === target.disciplineId);
    return `${discipline?.name ?? "Disziplin"} · ${target.field}`;
  }
  return `${target.group} · ${target.field}`;
}
