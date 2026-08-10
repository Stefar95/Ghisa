import { useState } from "react";
import { Trash2, Plus, Pencil, X } from "lucide-react";
import { uid, confirmThen } from "../lib/utils";
import ExercisePicker from "./ExercisePicker";

export default function SchedeManager({ exercises, exerciseMeta, schede, onAddExercise, onSaveScheda, onDeleteScheda }) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const [itemEx, setItemEx] = useState("");
  const [itemSets, setItemSets] = useState(3);
  const [itemReps, setItemReps] = useState(8);
  const [itemRestMin, setItemRestMin] = useState(2);
  const [hasBackoff, setHasBackoff] = useState(false);
  const [backoffSets, setBackoffSets] = useState(2);
  const [backoffReps, setBackoffReps] = useState(8);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [viewingSchedaId, setViewingSchedaId] = useState(null);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setItems([]);
    setItemEx("");
    setItemSets(3);
    setItemReps(8);
    setItemRestMin(2);
    setHasBackoff(false);
    setBackoffSets(2);
    setBackoffReps(8);
    setFormOpen(false);
    setEditingItemIdx(null);
  };

  const startEdit = (scheda) => {
    setEditingId(scheda.id);
    setName(scheda.name);
    setItems(scheda.items);
    setFormOpen(true);
  };

  const clearItemForm = () => {
    setItemEx("");
    setItemSets(3);
    setItemReps(8);
    setItemRestMin(2);
    setHasBackoff(false);
    setBackoffSets(2);
    setBackoffReps(8);
    setEditingItemIdx(null);
  };

  const saveItem = () => {
    if (!itemEx.trim()) return;
    onAddExercise(itemEx);
    const newItem = {
      exercise: itemEx.trim(),
      sets: itemSets,
      reps: itemReps,
      restSeconds: Math.round((itemRestMin || 0) * 60),
      backoffSets: hasBackoff ? backoffSets : 0,
      backoffReps: hasBackoff ? backoffReps : 0,
    };
    if (editingItemIdx !== null) {
      setItems((prev) => prev.map((it, i) => (i === editingItemIdx ? newItem : it)));
    } else {
      setItems((prev) => [...prev, newItem]);
    }
    clearItemForm();
  };

  const startEditItem = (idx) => {
    const it = items[idx];
    setEditingItemIdx(idx);
    setItemEx(it.exercise);
    setItemSets(it.sets);
    setItemReps(it.reps);
    setItemRestMin(it.restSeconds ? it.restSeconds / 60 : 0);
    setHasBackoff(it.backoffSets > 0);
    setBackoffSets(it.backoffSets || 2);
    setBackoffReps(it.backoffReps || 8);
  };

  const moveItem = (idx, dir) => {
    setItems((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (editingItemIdx === idx) clearItemForm();
  };

  const submit = () => {
    if (!name.trim() || items.length === 0) return;
    confirmThen(`Salvare la scheda "${name.trim()}" con ${items.length} esercizi?`, () => {
      onSaveScheda({ id: editingId || uid(), name: name.trim(), items });
      resetForm();
    });
  };

  return (
    <div>
      {!formOpen ? (
        <button className="g-empty-cta" style={{ width: "100%", marginBottom: 16 }} onClick={() => setFormOpen(true)}>
          + Nuova scheda
        </button>
      ) : (
        <div className="g-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="g-field-label" style={{ marginBottom: 0 }}>
              {editingId ? "Modifica scheda" : "Nuova scheda"}
            </label>
            <button className="g-icon-btn" onClick={resetForm}><X size={14} /></button>
          </div>
          <input
            className="g-input"
            style={{ marginTop: 8 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Giorno A - Push"
          />

          {items.map((it, idx) => (
            <div
              className={`g-draft-item ${editingItemIdx === idx ? "g-draft-item-active" : ""}`}
              key={idx}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 4 }}>
                <button
                  className="g-order-btn"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Sposta su"
                >
                  ▲
                </button>
                <button
                  className="g-order-btn"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  aria-label="Sposta giù"
                >
                  ▼
                </button>
              </div>
              <span style={{ flex: 1, cursor: "pointer" }} onClick={() => startEditItem(idx)}>
                {it.exercise} — {it.sets}x{it.reps}
                {it.restSeconds > 0 && (
                  <span style={{ color: "var(--ink-dim)" }}> · rec {Math.round(it.restSeconds / 60 * 10) / 10}'</span>
                )}
                {it.backoffSets > 0 && (
                  <span style={{ color: "var(--steel)" }}> + back-off {it.backoffSets}x{it.backoffReps}</span>
                )}
                {(exerciseMeta[it.exercise] || []).length > 0 && (
                  <span style={{ display: "block", color: "var(--ink-dim)", fontSize: 11, marginTop: 2 }} title="Parti del corpo lavorate">
                    {(exerciseMeta[it.exercise] || []).join(" · ")}
                  </span>
                )}
              </span>
              <button className="g-icon-btn" style={{ padding: 6 }} onClick={() => startEditItem(idx)} aria-label="Modifica">
                <Pencil size={13} />
              </button>
              <button className="g-del-btn" onClick={() => removeItem(idx)}><X size={14} /></button>
            </div>
          ))}

          <div style={{ marginTop: 10 }}>
            <label className="g-field-label">Esercizio</label>
            <ExercisePicker
              exercises={exercises}
              value={itemEx}
              onChange={setItemEx}
              placeholder="Scegli o scrivi un esercizio"
            />
            <div className="g-inline-row">
              <div style={{ flex: 1 }}>
                <label className="g-field-label">Serie</label>
                <input
                  className="g-input g-num-small"
                  type="number"
                  min="1"
                  value={itemSets}
                  onChange={(e) => setItemSets(parseInt(e.target.value) || 1)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="g-field-label">Reps</label>
                <input
                  className="g-input g-num-small"
                  type="number"
                  min="1"
                  value={itemReps}
                  onChange={(e) => setItemReps(parseInt(e.target.value) || 1)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="g-field-label">Recupero (min)</label>
                <input
                  className="g-input g-num-small"
                  type="number"
                  min="0"
                  step="0.5"
                  value={itemRestMin}
                  onChange={(e) => setItemRestMin(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <label className="g-checkbox-row">
              <input
                type="checkbox"
                checked={hasBackoff}
                onChange={(e) => setHasBackoff(e.target.checked)}
              />
              Aggiungi back-off (serie a carico ridotto dopo i top set)
            </label>

            {hasBackoff && (
              <div className="g-inline-row">
                <div style={{ flex: 1 }}>
                  <label className="g-field-label">Serie back-off</label>
                  <input
                    className="g-input g-num-small"
                    type="number"
                    min="1"
                    value={backoffSets}
                    onChange={(e) => setBackoffSets(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="g-field-label">Reps back-off</label>
                  <input
                    className="g-input g-num-small"
                    type="number"
                    min="1"
                    value={backoffReps}
                    onChange={(e) => setBackoffReps(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {editingItemIdx !== null && (
                <button className="g-icon-btn" style={{ padding: "10px 14px" }} onClick={clearItemForm}>
                  Annulla
                </button>
              )}
              <button className="g-icon-btn" style={{ flex: 1, justifyContent: "center", padding: "10px 12px" }} onClick={saveItem}>
                <Plus size={16} /> {editingItemIdx !== null ? "Salva modifiche" : "Aggiungi esercizio alla scheda"}
              </button>
            </div>
          </div>

          <button className="g-submit" disabled={!name.trim() || items.length === 0} onClick={submit}>
            Salva scheda
          </button>
        </div>
      )}

      <div className="g-field-label">Le tue schede ({schede.length})</div>
      {schede.length === 0 ? (
        <div className="g-card g-empty" style={{ padding: 24 }}>Nessuna scheda creata ancora.</div>
      ) : (
        <div className="g-card" style={{ padding: "4px 14px" }}>
          {schede.map((s) => (
            <div key={s.id}>
              <div className="g-scheda-row">
                <div
                  style={{ flex: 1, cursor: "pointer" }}
                  onClick={() => setViewingSchedaId(viewingSchedaId === s.id ? null : s.id)}
                >
                  <div className="g-scheda-name">{s.name}</div>
                  <div className="g-scheda-meta">
                    {s.items.length} esercizi
                    {s.items.some((it) => it.backoffSets > 0) && " · con back-off"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="g-icon-btn" onClick={() => startEdit(s)}><Pencil size={14} /></button>
                  <button
                    className="g-icon-btn"
                    onClick={() => confirmThen(`Eliminare la scheda "${s.name}"?`, () => onDeleteScheda(s.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {viewingSchedaId === s.id && (
                <div style={{ padding: "0 0 12px 0" }}>
                  {s.items.map((it, idx) => (
                    <div key={idx} className="g-scheda-item-view">
                      <div style={{ fontWeight: 600 }}>{it.exercise}</div>
                      <div style={{ color: "var(--ink-dim)", fontSize: 12 }}>
                        {it.sets}x{it.reps}
                        {it.restSeconds > 0 && ` · rec ${Math.round((it.restSeconds / 60) * 10) / 10}'`}
                        {it.backoffSets > 0 && ` · back-off ${it.backoffSets}x${it.backoffReps}`}
                      </div>
                      {(exerciseMeta[it.exercise] || []).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                          {(exerciseMeta[it.exercise] || []).map((p) => (
                            <span key={p} className="g-part-badge">{p}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

