import { useState, useEffect, useMemo, useRef } from "react";
import {
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
import {
  uid, confirmThen, todayISO, formatDate, formatMMSS, STEPS,
  getReps, getBackoffReps, getBackoffPercent, repsLabel,
  getExType, isTimeBased, isAmrap, logSummary,
  flattenSteps, restAfterPart, getCombo, comboLabel, getParts, partAmountLabel, dayOptions, getDays,
} from "../lib/utils";
import BodyDiagram from "./BodyDiagram";
import ExercisePicker from "./ExercisePicker";

export default function LogPage({ exercises, exerciseMeta, logs, schede, onAddBatch, onDelete, onDeleteBatch, onUpdate, draft, onSaveDraft, activeSchedaId }) {
  const [dayId, setDayId] = useState(() => (draft ? draft.dayId : null));
  // Prima si sceglie la scheda (di default quella attiva), poi il giorno
  const [schedaSel, setSchedaSel] = useState(null);
  const [stepIdx, setStepIdx] = useState(() => (draft ? draft.stepIdx || 0 : 0));
  const [session, setSession] = useState(() => (draft ? draft.session || [] : []));
  const [exerciseInput, setExerciseInput] = useState("");
  const [weight, setWeight] = useState(20);
  const [weightStep, setWeightStep] = useState(2.5);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [isBackoff, setIsBackoff] = useState(false);
  // Serie uniformi (stesso carico e ripetizioni) oppure una riga per serie
  const [uniform, setUniform] = useState(true);
  const [setRows, setSetRows] = useState([]);
  const [date, setDate] = useState(() => (draft ? draft.date : todayISO()));
  const [sessionNote, setSessionNote] = useState(() => (draft ? draft.note || "" : ""));
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState("rest"); // 'rest' | 'exercise' 
  const [expanded, setExpanded] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const isFirstRender = useRef(true);
  const [completed, setCompleted] = useState(false);
  const [showBodyDiagram, setShowBodyDiagram] = useState(false);

  // In allenamento uso solo le schede mie: quelle passate ad altri non contano
  const mieSchede = useMemo(
    () => schede.filter((s) => !(s.assignedTo || []).length),
    [schede]
  );
  // Ogni scheda può contenere più giorni: qui li elenchiamo tutti insieme
  const allDays = useMemo(() => dayOptions(mieSchede), [mieSchede]);

  // All'apertura propone la scheda attiva; se sto riprendendo una sessione
  // sospesa, risale alla scheda a cui appartiene il giorno salvato.
  useEffect(() => {
    if (schedaSel !== null) return;
    if (dayId === "libero") {
      setSchedaSel("libero");
      return;
    }
    if (dayId) {
      const opt = allDays.find((o) => o.id === dayId);
      if (opt) {
        setSchedaSel(opt.scheda.id);
        return;
      }
    }
    if (activeSchedaId && mieSchede.some((s) => s.id === activeSchedaId)) {
      setSchedaSel(activeSchedaId);
    }
  }, [allDays, activeSchedaId, mieSchede, dayId, schedaSel]);

  const selectedSchedaObj = mieSchede.find((s) => s.id === schedaSel) || null;
  const schedaDays = selectedSchedaObj ? getDays(selectedSchedaObj) : [];

  const chooseScheda = (value) => {
    setSchedaSel(value || null);
    if (value === "libero") {
      setDayId("libero");
    } else if (value) {
      const days = getDays(mieSchede.find((s) => s.id === value) || {});
      setDayId(days.length === 1 ? days[0].id : null);
    } else {
      setDayId(null);
    }
  };
  const selectedOption = allDays.find((o) => o.id === dayId) || null;
  const selectedScheda = selectedOption ? selectedOption.day : null;
  const dayName = selectedOption ? selectedOption.label : dayId === "libero" ? "Giorno libero" : "";
  // Ogni riga di scheda può contenere più esercizi (superset/jumpset):
  // qui li appiattiamo per poterli percorrere uno alla volta.
  const steps = useMemo(
    () => (selectedScheda ? flattenSteps(selectedScheda.items) : []),
    [selectedScheda]
  );
  const totalSteps = steps.length;
  const currentStep = steps[stepIdx] || null;
  const currentBlock = currentStep?.item || null;   // la riga della scheda
  const currentItem = currentStep?.part || null;    // il singolo esercizio
  const combo = currentBlock ? getCombo(currentBlock) : "none";
  const blockParts = currentBlock ? getParts(currentBlock) : [];
  const restInfo = currentBlock
    ? restAfterPart(currentBlock, currentStep.partIdx)
    : { seconds: 0, kind: "rest" };
  const currentRest = restInfo.seconds;
  // Tipo di esercizio: in "giorno libero" resta sempre a ripetizioni con carico
  const exType = currentItem ? getExType(currentItem) : "reps";
  const noWeight = currentItem ? !!currentItem.noWeight : false;
  const timeBased = exType === "time";
  const amrap = exType === "amrap";
  const amountStep = timeBased ? 5 : 1;
  // Il timer cronometra il recupero, oppure la durata dell'esercizio se è a tempo
  const activeTimerMode = timeBased ? (currentRest > 0 ? timerMode : "exercise") : "rest";
  const activeTimerDuration = activeTimerMode === "exercise" ? reps || 0 : currentRest;

  // Al primo render non azzerare lo step se stiamo ripristinando una bozza sospesa
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setStepIdx(0);
    setCompleted(false);
    // Nuova sessione (nessun esercizio ancora aggiunto): proponi sempre oggi
    if (session.length === 0) setDate(todayISO());
  }, [dayId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setShowBodyDiagram(false);
  }, [dayId, stepIdx]);

  // Se la scheda viene modificata (meno esercizi) mentre è in corso una
  // sessione, riporta lo step dentro i limiti invece di restare bloccato.
  useEffect(() => {
    if (selectedScheda && totalSteps > 0 && stepIdx >= totalSteps) {
      setStepIdx(totalSteps - 1);
    }
  }, [totalSteps, stepIdx, selectedScheda]);

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
      const item = steps[stepIdx];
      if (item) {
        setExerciseInput(item.part.exercise);
        setSets(item.item.sets);
        // A sfinimento: partiamo da 0, le ripetizioni le segni tu a fine serie
        setReps(getExType(item.part) === "amrap" ? 0 : getReps(item.part).max);
        setIsBackoff(false);
        setUniform(true);
        setSetRows([]);
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
    if (noWeight) return; // esercizio a corpo libero: il carico non serve
    const relevant = logs
      .filter((l) => l.exercise === exerciseInput && !l.backoff && !l.noWeight)
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    if (relevant.length) setWeight(relevant[0].weight);
    else setWeight(20); // nessuno storico: non tenere il peso (ridotto) dell'esercizio precedente
  }, [exerciseInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimerMode(isTimeBased(currentItem) ? "exercise" : "rest");
  }, [dayId, stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimerRemaining(activeTimerDuration);
    setTimerRunning(false);
  }, [dayId, stepIdx, activeTimerMode, activeTimerDuration]);

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
    if (selectedScheda && stepIdx < totalSteps - 1) setStepIdx((i) => i + 1);
  };

  // Passa da "serie tutte uguali" a "una riga per serie" e viceversa
  const toggleUniform = (nextUniform) => {
    if (!nextUniform) {
      setSetRows(
        Array.from({ length: Math.max(1, sets) }, () => ({
          weight: noWeight ? 0 : weight,
          reps,
        }))
      );
    }
    setUniform(nextUniform);
  };

  const updateSetRow = (i, patch) =>
    setSetRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addSetRow = () =>
    setSetRows((prev) => [...prev, { ...(prev[prev.length - 1] || { weight, reps }) }]);

  const removeSetRow = (i) => setSetRows((prev) => prev.filter((_, idx) => idx !== i));

  const addToSession = () => {
    if (!exerciseInput.trim()) return;

    // Serie differenziate: salvo il dettaglio riga per riga e uso come valore
    // di riferimento la serie più pesante (o la migliore, se a corpo libero)
    let entry;
    if (!uniform && setRows.length) {
      const rows = setRows.map((r) => ({
        weight: noWeight ? 0 : Number(r.weight) || 0,
        reps: Number(r.reps) || 0,
      }));
      const best = rows.reduce(
        (acc, r) => (noWeight ? (r.reps > acc.reps ? r : acc) : r.weight > acc.weight ? r : acc),
        rows[0]
      );
      entry = {
        tempId: uid(),
        exercise: exerciseInput.trim(),
        weight: best.weight,
        sets: rows.length,
        reps: best.reps,
        setDetails: rows,
        backoff: isBackoff,
        type: exType,
        noWeight,
        warmup: !!currentBlock?.warmup,
      };
    } else {
      entry = {
        tempId: uid(),
        exercise: exerciseInput.trim(),
        weight: noWeight ? 0 : weight,
        sets,
        reps,
        backoff: isBackoff,
        type: exType,
        noWeight,
        warmup: !!currentBlock?.warmup,
      };
    }

    setSession((prev) => [...prev, entry]);
    setUniform(true);
    setSetRows([]);

    if (currentItem && currentItem.backoffSets > 0 && !isBackoff) {
      // Appena aggiunto il top set: proponi subito il back-off dello stesso esercizio,
      // con peso ridotto della percentuale impostata per questo esercizio (arrotondato per eccesso)
      const pct = getBackoffPercent(currentItem);
      const base = entry.weight || weight;
      setIsBackoff(true);
      setSets(currentItem.backoffSets);
      setReps(getBackoffReps(currentItem).max);
      setWeight(Math.ceil(base * (1 - pct / 100)));
    } else if (selectedScheda) {
      if (stepIdx < totalSteps - 1) {
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
        type: e.type || "reps",
        noWeight: !!e.noWeight,
        warmup: !!e.warmup,
        dayId,
        dayName,
        date,
        note: sessionNote.trim(),
      }));
      onAddBatch(entries);
      setSession([]);
      setSessionNote("");
      setDayId(null);
      if (schedaSel === "libero") setSchedaSel(null);
      setDate(todayISO());
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
    return Array.from(map.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.key < b.key ? 1 : -1;
    });
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

  // Cambia la data dell'intero allenamento (tutti gli esercizi di quella sessione)
  const changeSessionDate = (group, newDate) => {
    if (!newDate || newDate === group.date) return;
    group.entries.forEach((e) => onUpdate(e.id, { date: newDate }));
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
      // La modifica riporta l'esercizio a serie uniformi: il dettaglio
      // riga-per-riga non sarebbe più coerente con i valori inseriti qui.
      onUpdate(editingId, { ...editDraft, setDetails: null });
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
        <div className="g-field-label">Scheda</div>
        <select
          className="g-input g-select"
          value={schedaSel || ""}
          onChange={(e) => chooseScheda(e.target.value)}
        >
          <option value="" disabled>Scegli una scheda...</option>
          {mieSchede.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id === activeSchedaId ? `★ ${s.name}` : s.name}
            </option>
          ))}
          <option value="libero">— Giorno libero —</option>
        </select>

        {schedaSel && schedaSel !== "libero" && (
          <>
            <div className="g-field-label" style={{ marginTop: 12 }}>Giorno</div>
            <select
              className="g-input g-select"
              value={dayId || ""}
              onChange={(e) => setDayId(e.target.value || null)}
            >
              <option value="" disabled>Scegli un giorno...</option>
              {schedaDays.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </>
        )}

        {schedaSel === "libero" && (
          <div className="g-free-day-hint">
            Giorno libero: registri quello che vuoi, senza seguire una scheda.
          </div>
        )}
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
      <div className="g-card" style={{ marginBottom: 14, padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label className="g-field-label" style={{ marginBottom: 0, flexShrink: 0 }}>Data</label>
          <input
            className="g-input"
            type="date"
            style={{ padding: "8px 10px" }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <label className="g-field-label" style={{ marginTop: 12 }}>Note</label>
        <textarea
          className="g-input"
          rows={2}
          style={{ resize: "vertical", fontFamily: "inherit" }}
          value={sessionNote}
          onChange={(e) => setSessionNote(e.target.value)}
        />
      </div>

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
        {selectedScheda ? (
          <>
            <div className="g-ex-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="g-ex-meta">
                  Esercizio {stepIdx + 1}/{totalSteps}
                  {(exerciseMeta[currentItem?.exercise] || []).length > 0 && (
                    <>
                      {" · "}
                      <button
                        className="g-parts-link"
                        onClick={() => setShowBodyDiagram((v) => !v)}
                      >
                        {(exerciseMeta[currentItem.exercise] || []).join(", ")}
                        {showBodyDiagram ? " ▲" : " ▼"}
                      </button>
                    </>
                  )}
                </div>
                <div className="g-ex-name">{exerciseInput}</div>
                <div className="g-ex-tags">
                  <span className="g-tag g-tag-target">
                    {currentBlock.sets}x{partAmountLabel(currentItem)}
                  </span>
                  {combo !== "none" && (
                    <span className="g-tag g-tag-link">
                      {comboLabel(combo)} {currentStep.partIdx + 1}/{blockParts.length}
                    </span>
                  )}
                  {currentBlock?.warmup && <span className="g-tag g-tag-warm">Riscaldamento</span>}
                  {noWeight && <span className="g-tag">Corpo libero</span>}
                  {amrap && <span className="g-tag">A sfinimento</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="g-icon-btn" onClick={goPrev} disabled={stepIdx === 0}>
                  <ChevronLeft size={15} />
                </button>
                <button
                  className="g-icon-btn"
                  onClick={goNext}
                  disabled={stepIdx === totalSteps - 1}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
            {currentBlock?.note && (
              <div className="g-ex-note">{currentBlock.note}</div>
            )}
            {restInfo.kind === "superset" && (
              <div className="g-ex-note g-ex-note-link">
                Superset: subito dopo → {restInfo.nextExercise}
              </div>
            )}
            {showBodyDiagram && (exerciseMeta[currentItem?.exercise] || []).length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                <BodyDiagram selected={exerciseMeta[currentItem.exercise] || []} size={64} />
              </div>
            )}
          </>
        ) : (
          <>
            <label className="g-field-label">Esercizio</label>
            <ExercisePicker
              exercises={exercises}
              value={exerciseInput}
              onChange={setExerciseInput}
              placeholder=""
            />
          </>
        )}

        <div className="g-seg" style={{ marginTop: 18 }}>
          <button
            className={`g-seg-btn ${uniform ? "active" : ""}`}
            onClick={() => toggleUniform(true)}
          >
            Serie uguali
          </button>
          <button
            className={`g-seg-btn ${!uniform ? "active" : ""}`}
            onClick={() => toggleUniform(false)}
          >
            Serie diverse
          </button>
        </div>

        {!noWeight && uniform && (
        <div style={{ marginTop: 20 }}>
          <label className="g-field-label" style={{ textAlign: "center" }}>
            Peso
            {isBackoff && currentItem && (
              <span style={{ color: "var(--steel)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {" "}(-{getBackoffPercent(currentItem)}%)
              </span>
            )}
          </label>
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
        )}

        {uniform ? (
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
            <label className="g-field-label" style={{ textAlign: "center" }}>
              {timeBased ? "Secondi" : amrap ? "Rip. fatte" : "Ripetizioni"}
              {currentItem && !amrap && (() => {
                const range = isBackoff ? getBackoffReps(currentItem) : getReps(currentItem);
                return (
                  <span style={{ color: "var(--accent)" }}>
                    {" "}({repsLabel(range.min, range.max)}{timeBased ? "s" : ""})
                  </span>
                );
              })()}
            </label>
            <div className="g-counter">
              <button
                className="g-counter-btn"
                onClick={() => setReps((r) => Math.max(amrap ? 0 : 1, r - amountStep))}
              >
                −
              </button>
              <div className="g-counter-num">{reps}</div>
              <button className="g-counter-btn" onClick={() => setReps((r) => r + amountStep)}>+</button>
            </div>
            {amrap && <div className="g-range-badge">Fino a sfinimento</div>}
          </div>
        </div>
        ) : (
          <div className="g-sets-wrap">
            <div className="g-field-label" style={{ textAlign: "center" }}>Serie svolte</div>
            {setRows.map((r, i) => (
              <div className="g-set-row" key={i}>
                <span className="g-set-num">{i + 1}ª</span>
                {!noWeight && (
                  <>
                    <input
                      className="g-input g-set-input ghisa-mono"
                      type="number"
                      step="0.5"
                      value={r.weight}
                      onChange={(e) => updateSetRow(i, { weight: e.target.value })}
                    />
                    <span className="g-set-unit">kg</span>
                  </>
                )}
                <input
                  className="g-input g-set-input ghisa-mono"
                  type="number"
                  min="0"
                  value={r.reps}
                  onChange={(e) => updateSetRow(i, { reps: e.target.value })}
                />
                <span className="g-set-unit">{timeBased ? "sec" : "rip"}</span>
                {setRows.length > 1 && (
                  <button className="g-del-btn" onClick={() => removeSetRow(i)} aria-label="Togli serie">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              className="g-icon-btn"
              style={{ width: "100%", justifyContent: "center", padding: 8, marginTop: 2 }}
              onClick={addSetRow}
            >
              <Plus size={14} /> Aggiungi serie
            </button>
          </div>
        )}

        {!noWeight && !amrap && (
          <div className="g-toggle-row">
            <button
              className={`g-toggle-pill ${isBackoff ? "active" : ""}`}
              onClick={() => setIsBackoff((v) => !v)}
            >
              Serie back-off
            </button>
          </div>
        )}

        {(currentRest > 0 || timeBased) && (
          <div className="g-timer-box">
            {timeBased && currentRest > 0 && (
              <div className="g-timer-tabs">
                <button
                  className={`g-step-pill ${timerMode === "exercise" ? "active" : ""}`}
                  onClick={() => setTimerMode("exercise")}
                >
                  Esercizio
                </button>
                <button
                  className={`g-step-pill ${timerMode === "rest" ? "active" : ""}`}
                  onClick={() => setTimerMode("rest")}
                >
                  Recupero
                </button>
              </div>
            )}
            <div className="g-timer-label">
              {activeTimerMode === "exercise"
                ? "Durata esercizio"
                : restInfo.kind === "jumpset"
                ? `Jumpset — 1' poi ${restInfo.nextExercise}`
                : "Recupero consigliato"}
            </div>
            <div
              className="g-timer-display ghisa-mono"
              style={timerRemaining === 0 && !timerRunning ? { color: "var(--accent)" } : undefined}
            >
              {formatMMSS(timerRemaining)}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="g-icon-btn" onClick={() => setTimerRunning((r) => !r)} style={{ gap: 5 }}>
                {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                {timerRunning ? "Pausa" : "Avvia"}
              </button>
              <button
                className="g-icon-btn"
                onClick={() => {
                  setTimerRemaining(activeTimerDuration);
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
                  <div className="g-history-sets">{logSummary(e)}</div>
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
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                        <label className="g-field-label" style={{ marginBottom: 0, flexShrink: 0 }}>
                          Data allenamento
                        </label>
                        <input
                          className="g-input"
                          type="date"
                          style={{ padding: "7px 10px", fontSize: 13 }}
                          value={g.date}
                          onChange={(e) => changeSessionDate(g, e.target.value)}
                        />
                      </div>
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
                              <div className="g-history-sets">{logSummary(l)}</div>
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
                            placeholder=""
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
