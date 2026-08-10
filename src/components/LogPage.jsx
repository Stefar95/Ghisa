import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dumbbell,
  Flame,
  Trash2,
  Plus,
  Minus,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  X,
} from "lucide-react";
import { uid, confirmThen, todayISO, formatDate, formatMMSS, STEPS } from "../lib/utils";
import BodyDiagram from "./BodyDiagram";
import ExercisePicker from "./ExercisePicker";

export default function LogPage({ exercises, exerciseMeta, logs, schede, onAddBatch, onDelete, onDeleteBatch, onUpdate, draft, onSaveDraft }) {
  const [dayId, setDayId] = useState(() => (draft ? draft.dayId : null));
  const [stepIdx, setStepIdx] = useState(() => (draft ? draft.stepIdx || 0 : 0));
  const [session, setSession] = useState(() => (draft ? draft.session || [] : []));
  const [exerciseInput, setExerciseInput] = useState("");
  const [weight, setWeight] = useState(20);
  const [weightStep, setWeightStep] = useState(2.5);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [isBackoff, setIsBackoff] = useState(false);
  const [date, setDate] = useState(() => (draft ? draft.date : todayISO()));
  const [sessionNote, setSessionNote] = useState(() => (draft ? draft.note || "" : ""));
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const isFirstRender = useRef(true);
  const [completed, setCompleted] = useState(false);
  const [showBodyDiagram, setShowBodyDiagram] = useState(false);

  const selectedScheda = schede.find((s) => s.id === dayId) || null;
  const dayName = selectedScheda ? selectedScheda.name : dayId === "libero" ? "Giorno libero" : "";
  const currentItem = selectedScheda ? selectedScheda.items[stepIdx] : null;
  const currentRest = currentItem?.restSeconds || 0;

  // Al primo render non azzerare lo step se stiamo ripristinando una bozza sospesa
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setStepIdx(0);
    setCompleted(false);
  }, [dayId]);

  useEffect(() => {
    setShowBodyDiagram(false);
  }, [dayId, stepIdx]);

  // Salva automaticamente la sessione in corso, così puoi tornarci più tardi e continuare
  useEffect(() => {
    if (!dayId && session.length === 0) {
      onSaveDraft(null);
      return;
    }
    onSaveDraft({ dayId, stepIdx, session, date, note: sessionNote });
  }, [dayId, stepIdx, session, date, sessionNote]); // eslint-disable-line react-hooks/exhaustive-deps

  const startOver = () => {
    confirmThen("Scartare la sessione in corso? Gli esercizi già aggiunti andranno persi.", () => {
      setSession([]);
      setDayId(null);
      setStepIdx(0);
      setSessionNote("");
      setDate(todayISO());
      onSaveDraft(null);
    });
  };

  useEffect(() => {
    if (selectedScheda) {
      const item = selectedScheda.items[stepIdx];
      if (item) {
        setExerciseInput(item.exercise);
        setSets(item.sets);
        setReps(item.reps);
        setIsBackoff(false);
      }
    } else {
      setExerciseInput("");
    }
    // NB: non includere selectedScheda tra le dipendenze — arriva un nuovo
    // oggetto (stesso contenuto) ad ogni sync col cloud, e farebbe resettare
    // il form (compreso il back-off appena impostato) senza che l'utente
    // abbia davvero cambiato giorno o esercizio.
  }, [dayId, stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const relevant = logs
      .filter((l) => l.exercise === exerciseInput && !l.backoff)
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    if (relevant.length) setWeight(relevant[0].weight);
    else setWeight(20); // nessuno storico per questo esercizio: non tenere il peso (ridotto) dell'esercizio precedente
  }, [exerciseInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimerRemaining(currentRest);
    setTimerRunning(false);
  }, [dayId, stepIdx, currentRest]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimerRemaining((r) => {
        if (r <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const adjust = (delta) => {
    setWeight((w) => Math.max(0, Math.round((w + delta) * 100) / 100));
  };

  const goPrev = () => {
    if (stepIdx > 0) {
      setStepIdx((i) => i - 1);
      setCompleted(false);
    }
  };
  const goNext = () => {
    if (selectedScheda && stepIdx < selectedScheda.items.length - 1) setStepIdx((i) => i + 1);
  };

  const addToSession = () => {
    if (!exerciseInput.trim()) return;
    setSession((prev) => [
      ...prev,
      { tempId: uid(), exercise: exerciseInput.trim(), weight, sets, reps, backoff: isBackoff },
    ]);

    if (currentItem && currentItem.backoffSets > 0 && !isBackoff) {
      // Appena aggiunto il top set: proponi subito il back-off dello stesso esercizio,
      // con peso ridotto del 30% (arrotondato per eccesso)
      setIsBackoff(true);
      setSets(currentItem.backoffSets);
      setReps(currentItem.backoffReps);
      setWeight(Math.ceil(weight * 0.7));
    } else if (selectedScheda) {
      if (stepIdx < selectedScheda.items.length - 1) {
        goNext();
      } else {
        setCompleted(true);
      }
    } else {
      setExerciseInput("");
      setIsBackoff(false);
    }
  };

  const removeFromSession = (tempId) => {
    setSession((prev) => prev.filter((e) => e.tempId !== tempId));
  };

  const saveSession = () => {
    if (session.length === 0) return;
    confirmThen(`Salvare questo allenamento con ${session.length} esercizi?`, () => {
      const sessionId = uid();
      const entries = session.map((e) => ({
        id: uid(),
        sessionId,
        exercise: e.exercise,
        weight: e.weight,
        sets: e.sets,
        reps: e.reps,
        backoff: e.backoff,
        dayId,
        dayName,
        date,
        note: sessionNote.trim(),
      }));
      onAddBatch(entries);
      setSession([]);
      setSessionNote("");
      setDayId(null);
    });
  };

  const sessionGroups = useMemo(() => {
    const map = new Map();
    logs.forEach((l) => {
      const key = l.sessionId || l.id;
      if (!map.has(key)) {
        map.set(key, {
          key,
          date: l.date,
          dayName: l.dayName || "Giorno libero",
          note: l.note || "",
          entries: [],
        });
      }
      map.get(key).entries.push(l);
    });
    return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [logs]);

  const toggleExpanded = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const deleteSession = (group) => {
    confirmThen(`Eliminare l'intero allenamento del ${formatDate(group.date)} (${group.entries.length} esercizi)?`, () => {
      onDeleteBatch(group.entries.map((e) => e.id));
    });
  };

  const startEditEntry = (l) => {
    setEditingId(l.id);
    setEditDraft({ weight: l.weight, sets: l.sets, reps: l.reps, backoff: !!l.backoff });
  };

  const cancelEditEntry = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEditEntry = () => {
    if (!editingId || !editDraft) return;
    confirmThen("Salvare le modifiche a questo esercizio?", () => {
      onUpdate(editingId, editDraft);
      setEditingId(null);
      setEditDraft(null);
    });
  };

  const [addingToKey, setAddingToKey] = useState(null);
  const [addDraft, setAddDraft] = useState(null);

  const startAddToSession = (group) => {
    setAddingToKey(group.key);
    setAddDraft({ exercise: "", weight: 20, sets: 3, reps: 10, backoff: false });
  };

  const cancelAddToSession = () => {
    setAddingToKey(null);
    setAddDraft(null);
  };

  const confirmAddToSession = (group) => {
    if (!addDraft || !addDraft.exercise.trim()) return;
    confirmThen(`Aggiungere "${addDraft.exercise.trim()}" a questo allenamento già salvato?`, () => {
      onAddBatch([
        {
          id: uid(),
          sessionId: group.key,
          exercise: addDraft.exercise.trim(),
          weight: addDraft.weight,
          sets: addDraft.sets,
          reps: addDraft.reps,
          backoff: addDraft.backoff,
          dayId: null,
          dayName: group.dayName,
          date: group.date,
          note: "",
        },
      ]);
      setAddingToKey(null);
      setAddDraft(null);
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div className="g-field-label">Giorno</div>
        <select
          className="g-input g-select"
          value={dayId || ""}
          onChange={(e) => setDayId(e.target.value || null)}
        >
          <option value="" disabled>Scegli un giorno...</option>
          {schede.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="libero">Giorno libero</option>
        </select>
      </div>

      {!dayId ? (
        <div className="g-card g-empty" style={{ padding: 28 }}>
          Seleziona un giorno qui sopra per iniziare a registrare l'allenamento.
        </div>
      ) : (
        <>
      {session.length > 0 && (
        <div className="g-draft-banner">
          <span>Sessione in corso — {session.length} esercizi già aggiunti</span>
          <button className="g-del-btn" onClick={startOver} title="Ricomincia da capo">
            Ricomincia
          </button>
        </div>
      )}
      <div className="g-card" style={{ marginBottom: 14 }}>
        <label className="g-field-label">Data sessione</label>
        <input
          className="g-input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <label className="g-field-label" style={{ marginTop: 12 }}>Note (opzionale)</label>
        <textarea
          className="g-input"
          rows={2}
          style={{ resize: "vertical", fontFamily: "inherit" }}
          value={sessionNote}
          onChange={(e) => setSessionNote(e.target.value)}
          placeholder=""
        />
      </div>

      {selectedScheda && !completed && (
        <div className="g-card" style={{ marginBottom: 14, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="g-field-label" style={{ marginBottom: 0 }}>
              Esercizio {stepIdx + 1} di {selectedScheda.items.length}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="g-icon-btn" onClick={goPrev} disabled={stepIdx === 0}>
                <ChevronLeft size={15} />
              </button>
              <button
                className="g-icon-btn"
                onClick={goNext}
                disabled={stepIdx === selectedScheda.items.length - 1}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
          {(exerciseMeta[currentItem?.exercise] || []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <button
                className="g-icon-btn"
                style={{ fontSize: 12, gap: 5 }}
                onClick={() => setShowBodyDiagram((v) => !v)}
              >
                <Dumbbell size={13} />
                {(exerciseMeta[currentItem.exercise] || []).join(", ")}
                {showBodyDiagram ? " ▲" : " ▼"}
              </button>
              {showBodyDiagram && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                  <BodyDiagram selected={exerciseMeta[currentItem.exercise] || []} size={64} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedScheda && completed && (
        <div className="g-card" style={{ marginBottom: 14, textAlign: "center", padding: "30px 20px" }}>
          <Flame size={28} color="var(--accent)" style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 700, fontSize: 17 }}>Ben fatto! 💪</div>
          <div style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 4 }}>
            Allenamento completato — {session.length} esercizi pronti da salvare qui sotto.
          </div>
          <button
            className="g-icon-btn"
            style={{ marginTop: 14 }}
            onClick={() => {
              setCompleted(false);
            }}
          >
            Rivedi ultimo esercizio
          </button>
        </div>
      )}

      {(!selectedScheda || !completed) && (
      <div className="g-card">
        <label className="g-field-label">Esercizio</label>
        <ExercisePicker
          exercises={exercises}
          value={exerciseInput}
          onChange={setExerciseInput}
          placeholder="Es. Panca piana, Squat, Stacco..."
          locked={!!selectedScheda}
        />

        <div style={{ marginTop: 20 }}>
          <label className="g-field-label" style={{ textAlign: "center" }}>Peso</label>
          <div className="g-weight-row">
            <button className="plate-btn" onClick={() => adjust(-weightStep)} aria-label="Diminuisci peso">
              <Minus size={22} />
            </button>
            <div className="g-weight-mid">
              <input
                className="weight-readout ghisa-mono"
                type="number"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                step="0.5"
              />
              <div className="weight-unit">KG</div>
            </div>
            <button className="plate-btn" onClick={() => adjust(weightStep)} aria-label="Aumenta peso">
              <Plus size={22} />
            </button>
          </div>
          <div className="g-step-row">
            {STEPS.map((s) => (
              <button
                key={s}
                className={`g-step-pill ${weightStep === s ? "active" : ""}`}
                onClick={() => setWeightStep(s)}
              >
                ±{s}
              </button>
            ))}
          </div>
        </div>

        <div className="g-sets-reps-row">
          <div className="g-sets-reps-col">
            <label className="g-field-label" style={{ textAlign: "center" }}>Serie</label>
            <div className="g-counter">
              <button className="g-counter-btn" onClick={() => setSets((s) => Math.max(1, s - 1))}>−</button>
              <div className="g-counter-num">{sets}</div>
              <button className="g-counter-btn" onClick={() => setSets((s) => s + 1)}>+</button>
            </div>
          </div>
          <div className="g-sets-reps-col">
            <label className="g-field-label" style={{ textAlign: "center" }}>Ripetizioni</label>
            <div className="g-counter">
              <button className="g-counter-btn" onClick={() => setReps((r) => Math.max(1, r - 1))}>−</button>
              <div className="g-counter-num">{reps}</div>
              <button className="g-counter-btn" onClick={() => setReps((r) => r + 1)}>+</button>
            </div>
          </div>
        </div>

        <label className="g-checkbox-row" style={{ justifyContent: "center" }}>
          <input
            type="checkbox"
            checked={isBackoff}
            onChange={(e) => setIsBackoff(e.target.checked)}
          />
          Questa è una serie back-off
        </label>

        {currentRest > 0 && (
          <div className="g-timer-box">
            <div className="g-timer-label">Recupero consigliato</div>
            <div className="g-timer-display ghisa-mono">{formatMMSS(timerRemaining)}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="g-icon-btn" onClick={() => setTimerRunning((r) => !r)} style={{ gap: 5 }}>
                {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                {timerRunning ? "Pausa" : "Avvia"}
              </button>
              <button
                className="g-icon-btn"
                onClick={() => {
                  setTimerRemaining(currentRest);
                  setTimerRunning(false);
                }}
                style={{ gap: 5 }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>
        )}

        <button
          className="g-submit g-submit-secondary"
          disabled={!exerciseInput.trim()}
          onClick={addToSession}
        >
          + Aggiungi alla sessione
        </button>
      </div>
      )}

      <div style={{ marginTop: 18 }}>
        <div className="g-field-label">Sessione di oggi ({session.length})</div>
        {session.length === 0 ? (
          <div className="g-card g-empty" style={{ padding: 20 }}>
            Aggiungi i tuoi esercizi qui sopra, poi salva tutta la sessione.
          </div>
        ) : (
          <div className="g-card" style={{ padding: "4px 14px" }}>
            {session.map((e) => (
              <div className="g-history-row" key={e.tempId}>
                <div className="g-history-main">
                  <div className="g-history-ex">
                    {e.exercise}
                    {e.backoff && <span style={{ color: "var(--steel)", fontSize: 11 }}> · back-off</span>}
                  </div>
                  <div className="g-history-sets">{e.sets} x {e.reps} @ {e.weight} kg</div>
                </div>
                <button className="g-del-btn" onClick={() => removeFromSession(e.tempId)} aria-label="Rimuovi">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="g-submit" disabled={session.length === 0} onClick={saveSession} style={{ marginTop: 10 }}>
          Salva sessione ({session.length})
        </button>
      </div>
        </>
      )}

      <div style={{ marginTop: 18 }}>
        <div className="g-field-label">Storico allenamenti</div>
        {sessionGroups.length === 0 ? (
          <div className="g-card g-empty" style={{ padding: 24 }}>
            Nessun allenamento registrato ancora.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessionGroups.map((g) => {
              const isOpen = expanded.has(g.key);
              return (
                <div className="g-card" key={g.key} style={{ padding: "10px 14px" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                    onClick={() => toggleExpanded(g.key)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="g-history-date" style={{ width: 46 }}>{formatDate(g.date)}</div>
                      <div>
                        <div className="g-session-name">
                          {g.dayName}
                          {g.note && <span className="g-note-dot" title="Ha delle note">●</span>}
                        </div>
                        <div className="g-reg-count">{g.entries.length} esercizi</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        className="g-del-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(g);
                        }}
                        aria-label="Elimina allenamento"
                      >
                        <Trash2 size={16} />
                      </button>
                      {isOpen ? <ChevronLeft size={16} style={{ transform: "rotate(-90deg)", color: "var(--ink-dim)" }} /> : <ChevronRight size={16} style={{ transform: "rotate(90deg)", color: "var(--ink-dim)" }} />}
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                      {g.note && (
                        <div style={{ fontSize: 12, color: "var(--ink-dim)", fontStyle: "italic", marginBottom: 8 }}>
                          "{g.note}"
                        </div>
                      )}
                      {g.entries.map((l) =>
                        editingId === l.id ? (
                          <div className="g-edit-row" key={l.id}>
                            <div className="g-history-ex" style={{ marginBottom: 8 }}>
                              {l.exercise}
                              {editDraft.backoff && <span style={{ color: "var(--steel)", fontSize: 11 }}> · back-off</span>}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <label className="g-field-label">Peso</label>
                                <input
                                  className="g-input g-num-small"
                                  type="number"
                                  step="0.5"
                                  value={editDraft.weight}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, weight: parseFloat(e.target.value) || 0 }))}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label className="g-field-label">Serie</label>
                                <input
                                  className="g-input g-num-small"
                                  type="number"
                                  min="1"
                                  value={editDraft.sets}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, sets: parseInt(e.target.value) || 1 }))}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label className="g-field-label">Reps</label>
                                <input
                                  className="g-input g-num-small"
                                  type="number"
                                  min="1"
                                  value={editDraft.reps}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, reps: parseInt(e.target.value) || 1 }))}
                                />
                              </div>
                            </div>
                            <label className="g-checkbox-row">
                              <input
                                type="checkbox"
                                checked={editDraft.backoff}
                                onChange={(e) => setEditDraft((d) => ({ ...d, backoff: e.target.checked }))}
                              />
                              Serie back-off
                            </label>
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <button className="g-icon-btn" style={{ flex: 1, justifyContent: "center" }} onClick={cancelEditEntry}>
                                Annulla
                              </button>
                              <button className="g-submit" style={{ flex: 1, marginTop: 0 }} onClick={saveEditEntry}>
                                Salva
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="g-history-row" key={l.id}>
                            <div className="g-history-main">
                              <div className="g-history-ex">
                                {l.exercise}
                                {l.backoff && <span style={{ color: "var(--steel)", fontSize: 11 }}> · back-off</span>}
                              </div>
                              <div className="g-history-sets">{l.sets} x {l.reps} @ {l.weight} kg</div>
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="g-del-btn" onClick={() => startEditEntry(l)} aria-label="Modifica">
                                <Pencil size={15} />
                              </button>
                              <button
                                className="g-del-btn"
                                onClick={() => confirmThen(`Eliminare "${l.exercise}" da questo allenamento?`, () => onDelete(l.id))}
                                aria-label="Elimina"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )
                      )}

                      {addingToKey === g.key ? (
                        <div className="g-edit-row">
                          <label className="g-field-label">Esercizio</label>
                          <ExercisePicker
                            exercises={exercises}
                            value={addDraft.exercise}
                            onChange={(v) => setAddDraft((d) => ({ ...d, exercise: v }))}
                            placeholder="Nome esercizio"
                          />
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <div style={{ flex: 1 }}>
                              <label className="g-field-label">Peso</label>
                              <input
                                className="g-input g-num-small"
                                type="number"
                                step="0.5"
                                value={addDraft.weight}
                                onChange={(e) => setAddDraft((d) => ({ ...d, weight: parseFloat(e.target.value) || 0 }))}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="g-field-label">Serie</label>
                              <input
                                className="g-input g-num-small"
                                type="number"
                                min="1"
                                value={addDraft.sets}
                                onChange={(e) => setAddDraft((d) => ({ ...d, sets: parseInt(e.target.value) || 1 }))}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="g-field-label">Reps</label>
                              <input
                                className="g-input g-num-small"
                                type="number"
                                min="1"
                                value={addDraft.reps}
                                onChange={(e) => setAddDraft((d) => ({ ...d, reps: parseInt(e.target.value) || 1 }))}
                              />
                            </div>
                          </div>
                          <label className="g-checkbox-row">
                            <input
                              type="checkbox"
                              checked={addDraft.backoff}
                              onChange={(e) => setAddDraft((d) => ({ ...d, backoff: e.target.checked }))}
                            />
                            Serie back-off
                          </label>
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button className="g-icon-btn" style={{ flex: 1, justifyContent: "center" }} onClick={cancelAddToSession}>
                              Annulla
                            </button>
                            <button
                              className="g-submit"
                              style={{ flex: 1, marginTop: 0 }}
                              disabled={!addDraft.exercise.trim()}
                              onClick={() => confirmAddToSession(g)}
                            >
                              Aggiungi
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="g-icon-btn"
                          style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
                          onClick={() => startAddToSession(g)}
                        >
                          <Plus size={14} /> Aggiungi esercizio a questo allenamento
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
