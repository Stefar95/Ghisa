import { useState } from "react";
import { Plus, Pencil, X, MoveVertical, CornerDownLeft, ChevronLeft } from "lucide-react";
import {
  EX_TYPES, COMBO_TYPES, getCombo, comboLabel, getParts, makePart,
  blockTitle, blockTarget, formatMMSS,
} from "../lib/utils";
import ExercisePicker from "./ExercisePicker";

// Editor di un singolo giorno di allenamento: nome del giorno + elenco esercizi
export default function DayEditor({ exercises, exerciseMeta, day, onChange, onClose, onAddExercise }) {
  const items = day.items || [];
  const setItems = (updater) => {
    const next = typeof updater === "function" ? updater(items) : updater;
    onChange({ ...day, items: next });
  };

  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [movingIdx, setMovingIdx] = useState(null);

  // --- blocco in costruzione ---
  const [combo, setCombo] = useState("none");
  const [parts, setParts] = useState([makePart()]);
  const [blockSets, setBlockSets] = useState(3);
  const [blockRestSec, setBlockRestSec] = useState(120);
  const [blockWarmup, setBlockWarmup] = useState(false);
  const [blockNote, setBlockNote] = useState("");

  const clearBlockForm = () => {
    setCombo("none");
    setParts([makePart()]);
    setBlockSets(3);
    setBlockRestSec(120);
    setBlockWarmup(false);
    setBlockNote("");
    setEditingItemIdx(null);
    setMovingIdx(null);
  };

  // --- gestione esercizi dentro il blocco ---
  const updatePart = (i, patch) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const setPartDuration = (i, v) => {
    const n = parseInt(v) || 1;
    updatePart(i, { repsMin: n, repsMax: n });
  };

  const setPartBackoffDuration = (i, v) => {
    const n = parseInt(v) || 1;
    updatePart(i, { backoffRepsMin: n, backoffRepsMax: n });
  };

  const addPart = () => {
    setParts((prev) => [...prev, makePart()]);
    if (combo === "none") setCombo("superset");
  };

  const removePart = (i) => {
    setParts((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [makePart()];
    });
  };

  const saveBlock = () => {
    const valid = parts.filter((p) => p.exercise.trim());
    if (valid.length === 0) return;
    valid.forEach((p) => onAddExercise(p.exercise));

    const cleanParts = valid.map((p) => {
      const min = Math.min(p.repsMin, p.repsMax);
      const max = Math.max(p.repsMin, p.repsMax);
      const boAllowed = p.type !== "amrap" && !p.noWeight && p.backoffSets > 0;
      return {
        ...p,
        exercise: p.exercise.trim(),
        repsMin: min,
        repsMax: max,
        backoffSets: boAllowed ? p.backoffSets : 0,
        backoffRepsMin: boAllowed ? Math.min(p.backoffRepsMin, p.backoffRepsMax) : 0,
        backoffRepsMax: boAllowed ? Math.max(p.backoffRepsMin, p.backoffRepsMax) : 0,
        backoffPercent: boAllowed ? p.backoffPercent : 30,
      };
    });

    const block = {
      combo: cleanParts.length > 1 ? (combo === "none" ? "superset" : combo) : "none",
      parts: cleanParts,
      sets: blockSets,
      restSeconds: blockRestSec || 0,
      warmup: blockWarmup,
      note: blockNote.trim(),
    };

    if (editingItemIdx !== null) {
      setItems((prev) => prev.map((it, i) => (i === editingItemIdx ? block : it)));
    } else {
      setItems((prev) => [...prev, block]);
    }
    clearBlockForm();
  };

  const startEditBlock = (idx) => {
    const it = items[idx];
    setEditingItemIdx(idx);
    setCombo(getCombo(it));
    setParts(getParts(it).map((p) => ({ ...makePart(), ...p })));
    setBlockSets(it.sets);
    setBlockRestSec(it.restSeconds || 0);
    setBlockWarmup(!!it.warmup);
    setBlockNote(it.note || "");
  };

  // --- ordinamento blocchi ---
  const moveItem = (idx, dir) => {
    setItems((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const moveItemTo = (from, slot) => {
    setItems((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(slot > from ? slot - 1 : slot, 0, moved);
      return next;
    });
    setMovingIdx(null);
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (editingItemIdx === idx) clearBlockForm();
  };

  // Duplica una scheda: utile per partire da un giorno esistente e alleggerirlo

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button className="g-icon-btn" onClick={onClose} title="Torna ai giorni">
          <ChevronLeft size={16} />
        </button>
        <input
          className="g-input"
          value={day.name}
          onChange={(e) => onChange({ ...day, name: e.target.value })}
        />
      </div>

          {/* elenco blocchi già inseriti */}
          {movingIdx !== null && (
            <div className="g-move-bar">
              <span>Sposto <strong>{blockTitle(items[movingIdx])}</strong>: scegli dove</span>
              <button className="g-del-btn" onClick={() => setMovingIdx(null)}>Annulla</button>
            </div>
          )}

          {items.map((it, idx) => {
            const c = getCombo(it);
            const slotBefore =
              movingIdx !== null && idx !== movingIdx && idx !== movingIdx + 1 ? (
                <button className="g-move-slot" onClick={() => moveItemTo(movingIdx, idx)}>
                  <CornerDownLeft size={12} /> Inserisci qui
                </button>
              ) : null;
            return (
              <div key={idx}>
                {slotBefore}
                <div
                  className={`g-draft-item ${editingItemIdx === idx ? "g-draft-item-active" : ""} ${movingIdx === idx ? "g-draft-item-moving" : ""}`}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 4 }}>
                    <button className="g-order-btn" onClick={() => moveItem(idx, -1)} disabled={idx === 0 || movingIdx !== null}>▲</button>
                    <button className="g-order-btn" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1 || movingIdx !== null}>▼</button>
                  </div>
                  <span style={{ flex: 1, cursor: "pointer" }} onClick={() => startEditBlock(idx)}>
                    <span style={{ fontWeight: 600 }}>{blockTitle(it)}</span>
                    <span style={{ display: "block", color: "var(--ink-dim)", marginTop: 1 }}>
                      {blockTarget(it)}
                      {it.restSeconds > 0 && ` · rec ${Math.round((it.restSeconds / 60) * 10) / 10}'`}
                    </span>
                    <span style={{ display: "block", marginTop: 3 }}>
                      {c !== "none" && <span className="g-tag g-tag-link">{comboLabel(c)}</span>}
                      {it.warmup && <span className="g-tag g-tag-warm">Riscaldamento</span>}
                      {getParts(it).some((p) => p.noWeight) && <span className="g-tag">Corpo libero</span>}
                      {getParts(it).some((p) => p.backoffSets > 0) && <span className="g-tag">Back-off</span>}
                    </span>
                    {it.note && (
                      <span style={{ display: "block", color: "var(--ink-dim)", fontSize: 11.5, fontStyle: "italic", marginTop: 3 }}>
                        {it.note}
                      </span>
                    )}
                  </span>
                  <button className="g-icon-btn" style={{ padding: 6 }} onClick={() => setMovingIdx(movingIdx === idx ? null : idx)} title="Sposta">
                    <MoveVertical size={13} />
                  </button>
                  <button className="g-icon-btn" style={{ padding: 6 }} onClick={() => startEditBlock(idx)} title="Modifica">
                    <Pencil size={13} />
                  </button>
                  <button className="g-del-btn" onClick={() => removeItem(idx)}><X size={14} /></button>
                </div>
              </div>
            );
          })}

          {movingIdx !== null && movingIdx !== items.length - 1 && (
            <button className="g-move-slot" onClick={() => moveItemTo(movingIdx, items.length)}>
              <CornerDownLeft size={12} /> Inserisci in fondo
            </button>
          )}

          {/* form del blocco */}
          <div className="g-block-form">
            <div className="g-field-label" style={{ marginBottom: 8 }}>
              {editingItemIdx !== null ? "Modifica esercizio" : "Nuovo esercizio"}
            </div>

            {parts.map((p, i) => (
              <div className="g-part-card" key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div className="g-field-label" style={{ marginBottom: 0 }}>
                    {parts.length > 1 ? `Esercizio ${i + 1}` : "Esercizio"}
                  </div>
                  {parts.length > 1 && (
                    <button className="g-del-btn" onClick={() => removePart(i)}><X size={13} /></button>
                  )}
                </div>

                <ExercisePicker
                  exercises={exercises}
                  value={p.exercise}
                  onChange={(v) => updatePart(i, { exercise: v })}
                  placeholder=""
                />

                <div className="g-seg" style={{ marginTop: 8 }}>
                  {EX_TYPES.map((t) => (
                    <button
                      key={t.id}
                      className={`g-seg-btn ${p.type === t.id ? "active" : ""}`}
                      onClick={() => updatePart(i, { type: t.id })}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {p.type !== "amrap" && (
                  <div className="g-inline-row">
                    {p.type === "time" ? (
                      <div style={{ flex: 1 }}>
                        <label className="g-field-label">Durata (sec)</label>
                        <input className="g-input g-num-small" type="number" min="1" step="5"
                          value={p.repsMax} onChange={(e) => setPartDuration(i, e.target.value)} />
                      </div>
                    ) : (
                      <>
                        <div style={{ flex: 1 }}>
                          <label className="g-field-label">Rip min</label>
                          <input className="g-input g-num-small" type="number" min="1"
                            value={p.repsMin} onChange={(e) => updatePart(i, { repsMin: parseInt(e.target.value) || 1 })} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="g-field-label">Rip max</label>
                          <input className="g-input g-num-small" type="number" min="1"
                            value={p.repsMax} onChange={(e) => updatePart(i, { repsMax: parseInt(e.target.value) || 1 })} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <label className="g-checkbox-row">
                  <input type="checkbox" checked={p.noWeight} onChange={(e) => updatePart(i, { noWeight: e.target.checked })} />
                  Senza carico (corpo libero)
                </label>

                {p.type !== "amrap" && !p.noWeight && (
                  <label className="g-checkbox-row">
                    <input
                      type="checkbox"
                      checked={p.backoffSets > 0}
                      onChange={(e) => updatePart(i, { backoffSets: e.target.checked ? 2 : 0 })}
                    />
                    Back-off (serie a carico ridotto)
                  </label>
                )}

                {p.type !== "amrap" && !p.noWeight && p.backoffSets > 0 && (
                  <div className="g-inline-row">
                    <div style={{ flex: 1 }}>
                      <label className="g-field-label">Serie</label>
                      <input className="g-input g-num-small" type="number" min="1"
                        value={p.backoffSets} onChange={(e) => updatePart(i, { backoffSets: parseInt(e.target.value) || 1 })} />
                    </div>
                    {p.type === "time" ? (
                      <div style={{ flex: 1 }}>
                        <label className="g-field-label">Durata (sec)</label>
                        <input className="g-input g-num-small" type="number" min="1" step="5"
                          value={p.backoffRepsMax} onChange={(e) => setPartBackoffDuration(i, e.target.value)} />
                      </div>
                    ) : (
                      <>
                        <div style={{ flex: 1 }}>
                          <label className="g-field-label">Rip min</label>
                          <input className="g-input g-num-small" type="number" min="1"
                            value={p.backoffRepsMin} onChange={(e) => updatePart(i, { backoffRepsMin: parseInt(e.target.value) || 1 })} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="g-field-label">Rip max</label>
                          <input className="g-input g-num-small" type="number" min="1"
                            value={p.backoffRepsMax} onChange={(e) => updatePart(i, { backoffRepsMax: parseInt(e.target.value) || 1 })} />
                        </div>
                      </>
                    )}
                    <div style={{ flex: 1 }}>
                      <label className="g-field-label">Rid. %</label>
                      <input className="g-input g-num-small" type="number" min="1" max="90"
                        value={p.backoffPercent} onChange={(e) => updatePart(i, { backoffPercent: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button className="g-icon-btn" style={{ width: "100%", justifyContent: "center", padding: "9px" }} onClick={addPart}>
              <Plus size={14} /> Aggiungi esercizio abbinato (superset / jumpset)
            </button>

            {parts.length > 1 && (
              <>
                <label className="g-field-label" style={{ marginTop: 14 }}>Come si eseguono</label>
                <div className="g-seg">
                  {COMBO_TYPES.filter((c) => c.id !== "none").map((c) => (
                    <button
                      key={c.id}
                      className={`g-seg-btn ${combo === c.id ? "active" : ""}`}
                      onClick={() => setCombo(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 6 }}>
                  Superset: uno subito dopo l'altro. Jumpset: 1' di pausa tra i due.
                </div>
              </>
            )}

            <div className="g-inline-row">
              <div style={{ flex: 1 }}>
                <label className="g-field-label">Serie</label>
                <input className="g-input g-num-small" type="number" min="1"
                  value={blockSets} onChange={(e) => setBlockSets(parseInt(e.target.value) || 1)} />
              </div>
              <div style={{ flex: 1.6 }}>
                <label className="g-field-label">Recupero</label>
                <div className="g-rest-stepper">
                  <button
                    className="g-counter-btn"
                    onClick={() => setBlockRestSec((v) => Math.max(0, v - 15))}
                    aria-label="Meno 15 secondi"
                  >
                    −
                  </button>
                  <div className="g-rest-value ghisa-mono">
                    {blockRestSec === 0 ? "—" : formatMMSS(blockRestSec)}
                  </div>
                  <button
                    className="g-counter-btn"
                    onClick={() => setBlockRestSec((v) => v + 15)}
                    aria-label="Più 15 secondi"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <label className="g-checkbox-row">
              <input type="checkbox" checked={blockWarmup} onChange={(e) => setBlockWarmup(e.target.checked)} />
              Esercizio di riscaldamento
            </label>

            <label className="g-field-label" style={{ marginTop: 12 }}>Note</label>
            <textarea
              className="g-input"
              rows={2}
              style={{ resize: "vertical", fontFamily: "inherit" }}
              value={blockNote}
              onChange={(e) => setBlockNote(e.target.value)}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {editingItemIdx !== null && (
                <button className="g-icon-btn" style={{ padding: "10px 14px" }} onClick={clearBlockForm}>
                  Annulla
                </button>
              )}
              <button className="g-submit g-submit-secondary" style={{ flex: 1, marginTop: 0 }} onClick={saveBlock}>
                {editingItemIdx !== null ? "Salva modifiche" : "Aggiungi al giorno"}
              </button>
            </div>
          </div>
    </div>
  );
}
