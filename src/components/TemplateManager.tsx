import { useEffect, useRef, useState } from "react";
import type { MappingTemplate } from "../models";
import { deleteTemplate, listTemplates, saveTemplate } from "../storage/database";

interface TemplateManagerProps {
  createTemplate: (name: string) => MappingTemplate;
  onLoad: (template: MappingTemplate) => void;
}

export function TemplateManager({ createTemplate, onLoad }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string>();
  const importRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setTemplates(await listTemplates());
    } catch {
      setMessage("Templates konnten nicht aus dem lokalen Speicher gelesen werden.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selected = templates.find((template) => template.id === selectedId);

  async function handleSave() {
    const templateName = name.trim() || `Mapping ${new Date().toLocaleDateString("de-DE")}`;
    const template = createTemplate(templateName);
    await saveTemplate(template);
    setSelectedId(template.id);
    setName(template.name);
    setMessage("Template lokal gespeichert.");
    await refresh();
  }

  async function handleDuplicate() {
    if (!selected) return;
    const copy: MappingTemplate = {
      ...structuredClone(selected),
      id: crypto.randomUUID(),
      name: `${selected.name} – Kopie`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTemplate(copy);
    setSelectedId(copy.id);
    setName(copy.name);
    await refresh();
  }

  async function handleRename() {
    if (!selected || !name.trim()) return;
    await saveTemplate({ ...selected, name: name.trim(), updatedAt: new Date().toISOString() });
    setMessage("Template umbenannt.");
    await refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    await deleteTemplate(selected.id);
    setSelectedId("");
    setName("");
    setMessage("Template gelöscht.");
    await refresh();
  }

  function handleExport() {
    if (!selected) return;
    const envelope = {
      format: "phraser-mapping-template",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      template: selected,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.name.replace(/[^\p{L}\p{N}._-]+/gu, "_")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; template?: MappingTemplate };
      if (parsed.format !== "phraser-mapping-template" || !isTemplate(parsed.template)) {
        throw new Error("Ungültiges Template-Format");
      }
      const imported = {
        ...parsed.template,
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      };
      await saveTemplate(imported);
      setSelectedId(imported.id);
      setName(imported.name);
      setMessage("Template importiert.");
      await refresh();
    } catch {
      setMessage("Die JSON-Datei ist kein gültiges Phraser-Template.");
    }
  }

  return (
    <div className="template-manager">
      <div className="compact-row">
        <select
          aria-label="Gespeichertes Template"
          onChange={(event) => {
            setSelectedId(event.target.value);
            setName(templates.find((item) => item.id === event.target.value)?.name ?? "");
          }}
          value={selectedId}
        >
          <option value="">Template wählen …</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <button disabled={!selected} onClick={() => selected && onLoad(selected)} type="button">Laden</button>
      </div>
      <input
        aria-label="Templatename"
        onChange={(event) => setName(event.target.value)}
        placeholder="Templatename"
        value={name}
      />
      <div className="button-grid">
        <button onClick={() => void handleSave()} type="button">Neu speichern</button>
        <button disabled={!selected} onClick={() => void handleRename()} type="button">Umbenennen</button>
        <button disabled={!selected} onClick={() => void handleDuplicate()} type="button">Duplizieren</button>
        <button disabled={!selected} onClick={handleExport} type="button">JSON exportieren</button>
        <button onClick={() => importRef.current?.click()} type="button">JSON importieren</button>
        <button className="text-danger" disabled={!selected} onClick={() => void handleDelete()} type="button">Löschen</button>
      </div>
      <input
        accept="application/json,.json"
        className="hidden-input"
        onChange={(event) => void handleImport(event.target.files?.[0])}
        ref={importRef}
        type="file"
      />
      {message ? <p className="inline-message">{message}</p> : null}
    </div>
  );
}

function isTemplate(value: MappingTemplate | undefined): value is MappingTemplate {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      Array.isArray(value.fieldRules) &&
      Array.isArray(value.disciplines),
  );
}

