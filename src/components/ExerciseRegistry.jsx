import { useState } from "react";
import { Dumbbell, Trash2, Plus, Pencil, X } from "lucide-react";
import { confirmThen, BODY_PARTS } from "../lib/utils";
import BodyDiagram from "./BodyDiagram";

export default function ExerciseRegistry({ exercises, exerciseMeta, logs, onAdd, onRemove, onMerge, onRename, onSetBodyParts }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [mergeTarget, setMergeTarget] = useState(null);
  const [renamingName, setRenamingName] = useState(null);
  const [renamingValue, setRenamingValue] = useState("");

  const countFor = (ex) => logs.filter((l) => l.exercise === ex).length;

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name);
    setName("");
  };

  const toggleSelect = (ex) => {
    setSelected((prev) =>
      prev.includes(ex) ? prev.filter((e) => e !== ex) : [...prev, ex]
    );
    setMergeTarget(null);
  };

  const cancelSelection = () => {
    setSelected([]);
    setMergeTarget(null);
  };

  const confirmMerge = () => {
    if (!mergeTarget) return;
    confirmThen(
      `Unire ${selected.length} esercizi in "${mergeTarget}"? Gli allenamenti e le schede verranno aggiornati, l'operazione non si può annullare.`,
      () => {
        onMerge(selected, mergeTarget);
        setSelected([]);
        setMergeTarget(null);
      }
    );
  };

  const confirmRename = () => {
    if (!renamingName) return;
    confirmThen(`Rinominare "${renamingName}" in "${renamingValue}"?`, () => {
      onRename(renamingName, renamingValue);
      setRenamingName(null);
      setRenamingValue("");
    });
  };

  const [bodyPartsOpenFor, setBodyPartsOpenFor] = useState(null);

  const toggleBodyPart = (ex, part) => {
    const current = exerciseMeta[ex] || [];
    const next = current.includes(part) ? current.filter((p) => p !== part) : [...current, part];
    onSetBodyParts(ex, next);
  };

  return (
    <div>
      <div className="g-card">
        <label className="g-field-label">Nuovo esercizio</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="g-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Lento avanti"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button className="g-icon-btn" onClick={submit} style={{ padding: "0 14px" }}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      {selected.length >= 2 && (
        <div className="g-card" style={{ marginTop: 16, borderColor: "var(--accent)" }}>
          <div className="g-field-label" style={{ marginBottom: 8 }}>
            Unisci {selected.length} voci: quale nome tieni?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {selected.map((ex) => (
              <label key={ex} className="g-checkbox-row" style={{ marginTop: 0 }}>
                <input
                  type="radio"
                  name="merge-target"
                  checked={mergeTarget === ex}
                  onChange={() => setMergeTarget(ex)}
                />
                {ex}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="g-icon-btn" style={{ flex: 1, justifyContent: "center" }} onClick={cancelSelection}>
              Annulla
            </button>
            <button
              className="g-submit"
              style={{ flex: 1, marginTop: 0 }}
              disabled={!mergeTarget}
              onClick={confirmMerge}
            >
              Unisci
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="g-field-label">Anagrafica ({exercises.length})</div>
          {selected.length > 0 && selected.length < 2 && (
            <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>Selezionane un'altra per unire</div>
          )}
        </div>
        {exercises.length === 0 ? (
          <div className="g-card g-empty" style={{ padding: 24 }}>Nessun esercizio ancora.</div>
        ) : (
          <div className="g-card" style={{ padding: "4px 14px" }}>
            {exercises.map((ex) =>
              renamingName === ex ? (
                <div className="g-reg-row" key={ex} style={{ gap: 8 }}>
                  <input
                    className="g-input"
                    style={{ flex: 1 }}
                    value={renamingValue}
                    onChange={(e) => setRenamingValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmRename()}
                    autoFocus
                  />
                  <button className="g-icon-btn" onClick={confirmRename} aria-label="Conferma">
                    <Pencil size={14} />
                  </button>
                  <button className="g-del-btn" onClick={() => setRenamingName(null)} aria-label="Annulla">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div key={ex}>
                  <div className="g-reg-row">
                    <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selected.includes(ex)}
                        onChange={() => toggleSelect(ex)}
                        style={{ width: 16, height: 16, accentColor: "var(--accent)", flexShrink: 0 }}
                      />
                      <div>
                        <div className="g-reg-name">{ex}</div>
                        <div className="g-reg-count">
                          {countFor(ex)} allenamenti registrati
                          {(exerciseMeta[ex] || []).length > 0 && ` · ${(exerciseMeta[ex] || []).join(", ")}`}
                        </div>
                      </div>
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="g-del-btn"
                        onClick={() => setBodyPartsOpenFor(bodyPartsOpenFor === ex ? null : ex)}
                        aria-label="Parti del corpo"
                      >
                        <Dumbbell size={15} />
                      </button>
                      <button
                        className="g-del-btn"
                        onClick={() => {
                          setRenamingName(ex);
                          setRenamingValue(ex);
                        }}
                        aria-label="Rinomina esercizio"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="g-del-btn"
                        onClick={() => confirmThen(`Eliminare "${ex}" dall'anagrafica?`, () => onRemove(ex))}
                        aria-label="Elimina esercizio"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {bodyPartsOpenFor === ex && (
                    <div className="g-bodyparts-panel">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
                        {BODY_PARTS.map((part) => (
                          <button
                            key={part}
                            className={`g-chip ${(exerciseMeta[ex] || []).includes(part) ? "active" : ""}`}
                            onClick={() => toggleBodyPart(ex, part)}
                          >
                            {part}
                          </button>
                        ))}
                      </div>
                      <BodyDiagram selected={exerciseMeta[ex] || []} size={72} />
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

