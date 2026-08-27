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
  BookOpen,
} from "lucide-react";
import {
  uid, confirmThen, todayISO, formatDate, formatMMSS, STEPS,
  getReps, getBackoffReps, getBackoffPercent, repsLabel,
  getExType, isDurationBased, isAmrap, logSummary, EX_TYPES, defaultDuration,
  flattenSteps, restAfterPart, getCombo, comboLabel, getParts, partAmountLabel,
  dayOptions, getDays, startAlarm, JUMPSET_REST,
} from "../lib/utils";
import BodyDiagram from "./BodyDiagram";
import ExercisePicker from "./ExercisePicker";
import DurationField from "./DurationField";
import ExerciseGuideModal from "./ExerciseGuideModal";

// Timer compatto per la pausa tra gli esercizi di un jumpset
function MiniTimer({ seconds }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [ringing, setRinging] = useState(false);
  const stopRef = useRef(null);

  useEffect(() => {
    setLeft(seconds);
    setRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          setRunning(false);
          stopRef.current = startAlarm();
          setRinging(true);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => () => { if (stopRef.current) stopRef.current(); }, []);

  const stopAll = () => {
    if (stopRef.current) stopRef.current();
    stopRef.current = null;
    setRinging(false);
    setLeft(seconds);
    setRunning(false);
  };

  return (
    <div className="g-mini-timer">
      <span className="g-mini-timer-label">Pausa</span>
      <span className="g-mini-timer-value ghisa-mono">{formatMMSS(left)}</span>
      {ringing ? (
        <button className="g-mini-timer-btn active" onClick={stopAll}>Ferma</button>
      ) : (
        <>
          <button className="g-mini-timer-btn" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button className="g-mini-timer-btn" onClick={stopAll}>
            <RotateCcw size={13} />
          </button>
        </>
      )}
    </div>
  );
}

export default function LogPage({
  exercises, exerciseMeta, exerciseGuide = {}, canManageGuide, onSetGuide, onClearGuide,
  logs, schede, onAddBatch, onDelete, onDeleteBatch, onUpdate, draft, onSaveDraft, activeSchedaId,
}) {
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
  // Giorno libero: tipo di esercizio (ripetizioni/a tempo/a sfinimento/cardio),
  // come in scheda, ma scelto lì per lì
  const [freeType, setFreeType] = useState("reps");
  const [freeNoWeight, setFreeNoWeight] = useState(false);
  const [freeWarmup, setFreeWarmup] = useState(false);
  // Anche in giorno libero si può fare "serie diverse" (carico/reps riga per riga),
  // come per gli esercizi di scheda
  const [freeUniform, setFreeUniform] = useState(true);
  const [freeSetRows, setFreeSetRows] = useState([]);
  // Serie uniformi (stesso carico e ripetizioni) oppure una riga per serie
  // Valori compilati per ciascun esercizio del blocco
  const [partVals, setPartVals] = useState([]);
  const [backoffPhase, setBackoffPhase] = useState(false);
  const [timerMode, setTimerMode] = useState("rest"); // 'rest' | 'exercise' 
  const [date, setDate] = useState(() => (draft ? draft.date : todayISO()));
  const [sessionNote, setSessionNote] = useState(() => (draft ? draft.note || "" : ""));
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  // Modifica di un esercizio già aggiunto alla sessione in corso (non ancora salvata)
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [sessionEditDraft, setSessionEditDraft] = useState(null);
  const isFirstRender = useRef(true);
  const alarmStopRef = useRef(null);
  const durationRef = useRef(0); // durata corrente del timer, per il riarmo
  const [alarmOn, setAlarmOn] = useState(false);

  // Ferma la suoneria e rimette il timer pronto per la serie successiva,
  // così non serve premere Reset a mano.
  const stopAlarm = () => {
    if (alarmStopRef.current) alarmStopRef.current();
    alarmStopRef.current = null;
    setAlarmOn(false);
    setTimerRemaining(durationRef.current);
    setTimerRunning(false);
  };
  useEffect(() => () => { if (alarmStopRef.current) alarmStopRef.current(); }, []);
  useEffect(() => {
    if (!alarmOn) return;
    // Se non la fermi tu, dopo 10 secondi tace e il timer si riarma comunque
    const t = setTimeout(() => {
      alarmStopRef.current = null;
      setAlarmOn(false);
      setTimerRemaining(durationRef.current);
    }, 10000);
    return () => clearTimeout(t);
  }, [alarmOn]);
  const [completed, setCompleted] = useState(false);
  const [showBodyDiagram, setShowBodyDiagram] = useState(false);
  // Nome dell'esercizio di cui sto guardando la guida (o null): la modale è
  // la stessa dell'anagrafica, letta qui in sola visualizzazione a meno di
  // essere admin/PT (allora si può collegare/correggere la guida al volo).
  const [guideFor, setGuideFor] = useState(null);

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
  const blocks = useMemo(
    () => (selectedScheda ? selectedScheda.items || [] : []),
    [selectedScheda]
  );
  const totalSteps = blocks.length;
  const currentBlock = blocks[stepIdx] || null;
  const blockParts = currentBlock ? getParts(currentBlock) : [];
  const combo = currentBlock ? getCombo(currentBlock) : "none";
  const currentRest = currentBlock ? currentBlock.restSeconds || 0 : 0;

  // Nella fase back-off restano solo gli esercizi che ne prevedono uno
  const activeParts = useMemo(() => {
    const list = blockParts.map((p, i) => ({ part: p, idx: i }));
    return backoffPhase ? list.filter((x) => x.part.backoffSets > 0) : list;
  }, [currentBlock, backoffPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Il primo esercizio del blocco guida timer e riepiloghi; in "giorno libero"
  // non c'è uno step di scheda, quindi il tipo lo scelgo lì per lì (freeType)
  const currentItem = activeParts[0]?.part || null;
  const exType = selectedScheda ? (currentItem ? getExType(currentItem) : "reps") : freeType;
  const noWeight = selectedScheda ? (currentItem ? !!currentItem.noWeight : false) : freeNoWeight;
  const timeBased = exType === "time";
  const cardio = exType === "cardio";
  const amrap = exType === "amrap";
  const amountStep = timeBased || cardio ? 15 : 1;
  // Il timer cronometra il recupero, oppure la durata dell'esercizio se è a tempo/cardio
  const activeTimerMode = timeBased || cardio ? (currentRest > 0 ? timerMode : "exercise") : "rest";
  const activeTimerDuration =
    activeTimerMode === "exercise"
      ? (selectedScheda ? partVals[activeParts[0]?.idx]?.reps || 0 : reps || 0)
      : currentRest;

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

  // Ultimo carico usato per un esercizio (solo top set con carico)
  const ultimoPeso = (nome) => {
    const prec = logs
      .filter((l) => l.exercise === nome && !l.backoff && !l.noWeight)
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    return prec.length ? prec[0].weight : 20;
  };

  // Precompila i valori di tutti gli esercizi del blocco
  useEffect(() => {
    if (!currentBlock) return;
    setBackoffPhase(false);
    setPartVals(
      getParts(currentBlock).map((p) => ({
        weight: p.noWeight ? 0 : ultimoPeso(p.exercise),
        reps: getExType(p) === "amrap" ? 0 : getReps(p).max,
        sets: currentBlock.sets,
        uniform: true,
        setRows: [],
      }))
    );
    // NB: non includere selectedScheda tra le dipendenze — arriva un nuovo
    // oggetto (stesso contenuto) ad ogni sync col cloud e resetterebbe il form.
  }, [dayId, stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // In giorno libero il campo esercizio resta libero
  useEffect(() => {
    if (!selectedScheda) setExerciseInput("");
  }, [dayId, selectedScheda]);

  useEffect(() => {
    if (noWeight) return; // esercizio a corpo libero: il carico non serve
    const relevant = logs
      .filter((l) => l.exercise === exerciseInput && !l.backoff && !l.noWeight)
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    if (relevant.length) setWeight(relevant[0].weight);
    else setWeight(20); // nessuno storico: non tenere il peso (ridotto) dell'esercizio precedente
  }, [exerciseInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimerMode((selectedScheda ? isDurationBased(currentItem) : timeBased || cardio) ? "exercise" : "rest");
  }, [dayId, stepIdx, freeType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    durationRef.current = activeTimerDuration;
  }, [activeTimerDuration]);

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
          // La suoneria continua finché non la fermi (o per 10 secondi)
          alarmStopRef.current = startAlarm();
          setAlarmOn(true);
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

  // --- valori dei singoli esercizi del blocco ---
  const updatePart = (idx, patch) =>
    setPartVals((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  const toggleUniform = (idx, nextUniform) =>
    setPartVals((prev) =>
      prev.map((v, i) => {
        if (i !== idx) return v;
        if (nextUniform) return { ...v, uniform: true };
        return {
          ...v,
          uniform: false,
          setRows: Array.from({ length: Math.max(1, v.sets) }, () => ({
            weight: v.weight,
            reps: v.reps,
          })),
        };
      })
    );

  const updateSetRow = (idx, j, patch) =>
    setPartVals((prev) =>
      prev.map((v, i) =>
        i === idx ? { ...v, setRows: v.setRows.map((r, k) => (k === j ? { ...r, ...patch } : r)) } : v
      )
    );

  const addSetRow = (idx) =>
    setPartVals((prev) =>
      prev.map((v, i) =>
        i === idx
          ? { ...v, setRows: [...v.setRows, { ...(v.setRows[v.setRows.length - 1] || { weight: v.weight, reps: v.reps }) }] }
          : v
      )
    );

  const removeSetRow = (idx, j) =>
    setPartVals((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, setRows: v.setRows.filter((_, k) => k !== j) } : v))
    );

  // --- "serie diverse" per l'esercizio di giorno libero ---
  const toggleFreeUniform = (nextUniform) => {
    if (nextUniform) {
      setFreeUniform(true);
    } else {
      setFreeUniform(false);
      setFreeSetRows(Array.from({ length: Math.max(1, sets) }, () => ({ weight, reps })));
    }
  };
  const updateFreeSetRow = (j, patch) =>
    setFreeSetRows((prev) => prev.map((r, k) => (k === j ? { ...r, ...patch } : r)));
  const addFreeSetRow = () =>
    setFreeSetRows((prev) => [...prev, { ...(prev[prev.length - 1] || { weight, reps }) }]);
  const removeFreeSetRow = (j) =>
    setFreeSetRows((prev) => prev.filter((_, k) => k !== j));

  const buildEntry = (part, v) => {
    const senzaCarico = !!part.noWeight;
    const base = {
      tempId: uid(),
      exercise: part.exercise,
      backoff: backoffPhase,
      type: getExType(part),
      noWeight: senzaCarico,
      warmup: !!currentBlock?.warmup,
    };
    if (!v.uniform && v.setRows.length) {
      const righe = v.setRows.map((r) => ({
        weight: senzaCarico ? 0 : Number(r.weight) || 0,
        reps: Number(r.reps) || 0,
      }));
      const best = righe.reduce(
        (acc, r) => (senzaCarico ? (r.reps > acc.reps ? r : acc) : r.weight > acc.weight ? r : acc),
        righe[0]
      );
      return { ...base, weight: best.weight, sets: righe.length, reps: best.reps, setDetails: righe };
    }
    return {
      ...base,
      weight: senzaCarico ? 0 : Number(v.weight) || 0,
      sets: Number(v.sets) || 1,
      reps: Number(v.reps) || 0,
    };
  };

  const addToSession = () => {
    // Giorno libero: un esercizio scritto a mano, con tipo scelto lì per lì
    if (!selectedScheda) {
      if (!exerciseInput.trim()) return;
      const boAllowed = freeType !== "amrap" && freeType !== "cardio" && !freeNoWeight;
      const base = {
        tempId: uid(),
        exercise: exerciseInput.trim(),
        backoff: boAllowed && isBackoff,
        type: freeType,
        noWeight: freeNoWeight,
        warmup: freeWarmup,
      };
      let entry;
      if (!freeUniform && freeSetRows.length) {
        const righe = freeSetRows.map((r) => ({
          weight: freeNoWeight ? 0 : Number(r.weight) || 0,
          reps: Number(r.reps) || 0,
        }));
        const best = righe.reduce(
          (acc, r) => (freeNoWeight ? (r.reps > acc.reps ? r : acc) : r.weight > acc.weight ? r : acc),
          righe[0]
        );
        entry = { ...base, weight: best.weight, sets: righe.length, reps: best.reps, setDetails: righe };
      } else {
        entry = {
          ...base,
          weight: freeNoWeight ? 0 : weight,
          sets: freeType === "cardio" ? 1 : sets,
          reps,
        };
      }
      setSession((prev) => [...prev, entry]);
      setExerciseInput("");
      setIsBackoff(false);
      setFreeType("reps");
      setFreeNoWeight(false);
      setFreeWarmup(false);
      setFreeUniform(true);
      setFreeSetRows([]);
      return;
    }

    // Registro in un colpo solo tutti gli esercizi del blocco
    const entries = activeParts.map((x) => buildEntry(x.part, partVals[x.idx] || {}));
    if (!entries.length) return;
    setSession((prev) => [...prev, ...entries]);

    const conBackoff = blockParts.some((p) => p.backoffSets > 0);
    if (!backoffPhase && conBackoff) {
      // Seconda fase: gli stessi esercizi a carico ridotto
      setBackoffPhase(true);
      setPartVals((prev) =>
        blockParts.map((p, i) => {
          if (p.backoffSets <= 0) return prev[i];
          const base = prev[i]?.weight || 0;
          return {
            weight: p.noWeight ? 0 : Math.ceil(base * (1 - getBackoffPercent(p) / 100)),
            reps: getBackoffReps(p).max,
            sets: p.backoffSets,
            uniform: true,
            setRows: [],
          };
        })
      );
      return;
    }

    if (stepIdx < totalSteps - 1) {
      goNext();
    } else {
      setCompleted(true);
    }
  };

  const removeFromSession = (tempId) => {
    setSession((prev) => prev.filter((e) => e.tempId !== tempId));
  };

  // Modifica (compreso il nome dell'esercizio) di una riga già aggiunta alla
  // sessione in corso, prima di salvarla
  const startEditSession = (e) => {
    setEditingSessionId(e.tempId);
    setSessionEditDraft({
      exercise: e.exercise,
      weight: e.weight,
      sets: e.sets,
      reps: e.reps,
      backoff: !!e.backoff,
      type: e.type || "reps",
      noWeight: !!e.noWeight,
      warmup: !!e.warmup,
    });
  };

  const cancelEditSession = () => {
    setEditingSessionId(null);
    setSessionEditDraft(null);
  };

  const saveEditSession = () => {
    if (!editingSessionId || !sessionEditDraft || !sessionEditDraft.exercise.trim()) return;
    const d = sessionEditDraft;
    const boAllowed = d.type !== "amrap" && d.type !== "cardio" && !d.noWeight;
    setSession((prev) =>
      prev.map((e) =>
        e.tempId === editingSessionId
          ? {
              ...e,
              exercise: d.exercise.trim(),
              weight: d.noWeight ? 0 : Number(d.weight) || 0,
              sets: d.type === "cardio" ? 1 : Number(d.sets) || 1,
              reps: Number(d.reps) || 0,
              backoff: boAllowed && d.backoff,
              type: d.type,
              noWeight: d.noWeight,
              warmup: d.warmup,
              setDetails: null,
            }
          : e
      )
    );
    setEditingSessionId(null);
    setSessionEditDraft(null);
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
                  {combo !== "none" && <span className="g-combo-label"> · {comboLabel(combo)}</span>}
                  {backoffPhase && <span style={{ color: "var(--steel)" }}> · back-off</span>}
                </div>
                <div className="g-ex-name">{blockParts.map((p) => p.exercise).join(" + ")}</div>
                <div className="g-ex-tags">
                  {currentBlock?.warmup && <span className="g-tag g-tag-warm">Riscaldamento</span>}
                  {combo === "jumpset" && (
                    <span className="g-tag g-tag-link">
                      {formatMMSS(currentBlock?.jumpsetRestSeconds ?? JUMPSET_REST)} tra gli esercizi
                    </span>
                  )}
                  {combo === "superset" && <span className="g-tag g-tag-link">Senza pausa</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="g-icon-btn" onClick={goPrev} disabled={stepIdx === 0}>
                  <ChevronLeft size={15} />
                </button>
                <button className="g-icon-btn" onClick={goNext} disabled={stepIdx === totalSteps - 1}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {currentBlock?.note && <div className="g-ex-note">{currentBlock.note}</div>}

            {activeParts.map((x, k) => {
              const part = x.part;
              const v = partVals[x.idx] || { weight: 0, reps: 0, sets: 1, uniform: true, setRows: [] };
              const t = getExType(part);
              const senzaCarico = !!part.noWeight;
              const aTempo = t === "time";
              const aCardio = t === "cardio";
              const aSfinimento = t === "amrap";
              const passo = aTempo ? 15 : 1;
              const q = backoffPhase ? getBackoffReps(part) : getReps(part);
              const nSerie = backoffPhase ? part.backoffSets : currentBlock.sets;
              const parti = exerciseMeta[part.exercise] || [];
              const multiplo = blockParts.length > 1;

              return (
                <div key={x.idx}>
                  {k > 0 && (
                    combo === "jumpset" ? (
                      <MiniTimer seconds={currentBlock.jumpsetRestSeconds ?? JUMPSET_REST} />
                    ) : (
                      <div className="g-combo-arrow">↓  subito dopo, senza pausa</div>
                    )
                  )}
                  <div className={multiplo ? "g-part-block" : ""}>
                    {multiplo && (
                      <div className="g-part-block-head">
                        <span className="g-part-block-name">{part.exercise}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            className="g-parts-link"
                            onClick={() => setGuideFor(part.exercise)}
                            title="Guida esercizio"
                            aria-label="Guida esercizio"
                          >
                            <BookOpen size={13} color={exerciseGuide[part.exercise] ? "var(--success)" : undefined} />
                          </button>
                          <span className="g-tag g-tag-target">
                            {aCardio ? formatMMSS(q.max) : `${nSerie}x${repsLabel(q.min, q.max)}${aTempo ? "s" : ""}`}
                          </span>
                        </span>
                      </div>
                    )}
                    {!multiplo && (
                      <div className="g-ex-tags" style={{ marginTop: 0, marginBottom: 4 }}>
                        <span className="g-tag g-tag-target">
                          {aCardio ? formatMMSS(q.max) : `${nSerie}x${repsLabel(q.min, q.max)}${aTempo ? "s" : ""}`}
                        </span>
                        <button
                          className="g-parts-link g-tag"
                          onClick={() => setGuideFor(part.exercise)}
                          title="Guida esercizio"
                        >
                          <BookOpen size={11} color={exerciseGuide[part.exercise] ? "var(--success)" : undefined} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                          Guida
                        </button>
                        {parti.length > 0 && (
                          <button className="g-parts-link g-tag" onClick={() => setShowBodyDiagram((b) => !b)}>
                            {parti.join(", ")}{showBodyDiagram ? " ▲" : " ▼"}
                          </button>
                        )}
                        {senzaCarico && <span className="g-tag">Corpo libero</span>}
                        {aSfinimento && <span className="g-tag">A sfinimento</span>}
                        {aCardio && <span className="g-tag">Cardio</span>}
                      </div>
                    )}

                    {!multiplo && showBodyDiagram && parti.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                        <BodyDiagram selected={parti} size={64} />
                      </div>
                    )}

                    {!aCardio && (
                      <div className="g-seg" style={{ marginTop: 12 }}>
                        <button className={`g-seg-btn ${v.uniform ? "active" : ""}`} onClick={() => toggleUniform(x.idx, true)}>
                          Serie uguali
                        </button>
                        <button className={`g-seg-btn ${!v.uniform ? "active" : ""}`} onClick={() => toggleUniform(x.idx, false)}>
                          Serie diverse
                        </button>
                      </div>
                    )}

                    {aCardio ? (
                      <>
                        {!senzaCarico && (
                          <div style={{ marginTop: 16 }}>
                            <label className="g-field-label" style={{ textAlign: "center" }}>Peso</label>
                            <div className="g-weight-row">
                              <button className="plate-btn" onClick={() => updatePart(x.idx, { weight: Math.max(0, Math.round((v.weight - weightStep) * 100) / 100) })}>
                                <Minus size={22} />
                              </button>
                              <div className="g-weight-mid">
                                <input
                                  className="weight-readout ghisa-mono"
                                  type="number"
                                  value={v.weight}
                                  onChange={(e) => updatePart(x.idx, { weight: parseFloat(e.target.value) || 0 })}
                                  step="0.5"
                                />
                                <div className="weight-unit">KG</div>
                              </div>
                              <button className="plate-btn" onClick={() => updatePart(x.idx, { weight: Math.round((v.weight + weightStep) * 100) / 100 })}>
                                <Plus size={22} />
                              </button>
                            </div>
                            <div className="g-step-row">
                              {STEPS.map((st) => (
                                <button key={st} className={`g-step-pill ${weightStep === st ? "active" : ""}`} onClick={() => setWeightStep(st)}>
                                  ±{st}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: 16 }}>
                          <label className="g-field-label" style={{ textAlign: "center" }}>Durata</label>
                          <DurationField value={v.reps} onChange={(secs) => updatePart(x.idx, { reps: secs, sets: 1 })} />
                        </div>
                      </>
                    ) : v.uniform ? (
                      <>
                        {!senzaCarico && (
                          <div style={{ marginTop: 16 }}>
                            <label className="g-field-label" style={{ textAlign: "center" }}>
                              Peso
                              {backoffPhase && (
                                <span style={{ color: "var(--steel)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                                  {" "}(-{getBackoffPercent(part)}%)
                                </span>
                              )}
                            </label>
                            <div className="g-weight-row">
                              <button className="plate-btn" onClick={() => updatePart(x.idx, { weight: Math.max(0, Math.round((v.weight - weightStep) * 100) / 100) })}>
                                <Minus size={22} />
                              </button>
                              <div className="g-weight-mid">
                                <input
                                  className="weight-readout ghisa-mono"
                                  type="number"
                                  value={v.weight}
                                  onChange={(e) => updatePart(x.idx, { weight: parseFloat(e.target.value) || 0 })}
                                  step="0.5"
                                />
                                <div className="weight-unit">KG</div>
                              </div>
                              <button className="plate-btn" onClick={() => updatePart(x.idx, { weight: Math.round((v.weight + weightStep) * 100) / 100 })}>
                                <Plus size={22} />
                              </button>
                            </div>
                            <div className="g-step-row">
                              {STEPS.map((st) => (
                                <button key={st} className={`g-step-pill ${weightStep === st ? "active" : ""}`} onClick={() => setWeightStep(st)}>
                                  ±{st}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="g-sets-reps-row">
                          <div className="g-sets-reps-col">
                            <label className="g-field-label" style={{ textAlign: "center" }}>Serie</label>
                            <div className="g-counter">
                              <button className="g-counter-btn" onClick={() => updatePart(x.idx, { sets: Math.max(1, v.sets - 1) })}>−</button>
                              <div className="g-counter-num">{v.sets}</div>
                              <button className="g-counter-btn" onClick={() => updatePart(x.idx, { sets: v.sets + 1 })}>+</button>
                            </div>
                          </div>
                          <div className="g-sets-reps-col">
                            <label className="g-field-label" style={{ textAlign: "center" }}>
                              {aTempo ? "Secondi" : aSfinimento ? "Rip. fatte" : "Ripetizioni"}
                              {!aSfinimento && (
                                <span style={{ color: "var(--accent)" }}> ({repsLabel(q.min, q.max)}{aTempo ? "s" : ""})</span>
                              )}
                            </label>
                            <div className="g-counter">
                              <button className="g-counter-btn" onClick={() => updatePart(x.idx, { reps: Math.max(aSfinimento ? 0 : 1, v.reps - passo) })}>−</button>
                              <div className="g-counter-num">{v.reps}</div>
                              <button className="g-counter-btn" onClick={() => updatePart(x.idx, { reps: v.reps + passo })}>+</button>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="g-sets-wrap">
                        <div className="g-set-head">
                          <span className="g-set-num" />
                          {!senzaCarico && <span className="g-set-col">Peso</span>}
                          <span className="g-set-col">{aTempo ? "Sec" : "Rip"}</span>
                          {v.setRows.length > 1 && <span className="g-set-spacer" />}
                        </div>
                        {v.setRows.map((r, j) => (
                          <div className="g-set-row" key={j}>
                            <span className="g-set-num">{j + 1}ª</span>
                            {!senzaCarico && (
                              <input
                                className="g-input g-set-input ghisa-mono"
                                type="number"
                                step="0.5"
                                value={r.weight}
                                onChange={(e) => updateSetRow(x.idx, j, { weight: e.target.value })}
                              />
                            )}
                            <input
                              className="g-input g-set-input ghisa-mono"
                              type="number"
                              min="0"
                              value={r.reps}
                              onChange={(e) => updateSetRow(x.idx, j, { reps: e.target.value })}
                            />
                            {v.setRows.length > 1 && (
                              <button className="g-del-btn" onClick={() => removeSetRow(x.idx, j)}>
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button className="g-icon-btn" style={{ width: "100%", justifyContent: "center", padding: 8, marginTop: 2 }} onClick={() => addSetRow(x.idx)}>
                          <Plus size={14} /> Aggiungi serie
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="g-field-label" style={{ marginBottom: 6 }}>Esercizio</label>
              {exerciseInput.trim() && (
                <button
                  className="g-parts-link"
                  style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 3, marginBottom: 6 }}
                  onClick={() => setGuideFor(exerciseInput.trim())}
                >
                  <BookOpen size={12} color={exerciseGuide[exerciseInput.trim()] ? "var(--success)" : undefined} /> Guida
                </button>
              )}
            </div>
            <ExercisePicker exercises={exercises} value={exerciseInput} onChange={setExerciseInput} placeholder="" />

            <div className="g-seg" style={{ marginTop: 12 }}>
              {EX_TYPES.map((t) => (
                <button
                  key={t.id}
                  className={`g-seg-btn ${freeType === t.id ? "active" : ""}`}
                  onClick={() => {
                    if (freeType === t.id) return;
                    // Ripetizioni e durata sono cose distinte: cambiando tipo si
                    // riparte da un default sensato per quel tipo, invece di
                    // trascinarsi il numero del tipo precedente.
                    setFreeType(t.id);
                    setReps(t.id === "time" || t.id === "cardio" ? defaultDuration(t.id) : 10);
                    setFreeUniform(true);
                    setFreeSetRows([]);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="g-checkbox-row" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={freeNoWeight} onChange={(e) => setFreeNoWeight(e.target.checked)} />
              Senza carico (corpo libero)
            </label>
            <label className="g-checkbox-row">
              <input type="checkbox" checked={freeWarmup} onChange={(e) => setFreeWarmup(e.target.checked)} />
              Riscaldamento
            </label>

            {freeType === "cardio" ? (
              <div style={{ marginTop: 16 }}>
                <label className="g-field-label" style={{ textAlign: "center" }}>Durata</label>
                <DurationField value={reps} onChange={setReps} />
              </div>
            ) : (
              <>
                <div className="g-seg" style={{ marginTop: 12 }}>
                  <button className={`g-seg-btn ${freeUniform ? "active" : ""}`} onClick={() => toggleFreeUniform(true)}>
                    Serie uguali
                  </button>
                  <button className={`g-seg-btn ${!freeUniform ? "active" : ""}`} onClick={() => toggleFreeUniform(false)}>
                    Serie diverse
                  </button>
                </div>

                {freeUniform ? (
                  <>
                    {!freeNoWeight && (
                      <div style={{ marginTop: 14 }}>
                        <label className="g-field-label" style={{ textAlign: "center" }}>Peso</label>
                        <div className="g-weight-row">
                          <button className="plate-btn" onClick={() => adjust(-weightStep)}><Minus size={22} /></button>
                          <div className="g-weight-mid">
                            <input className="weight-readout ghisa-mono" type="number" value={weight}
                              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} step="0.5" />
                            <div className="weight-unit">KG</div>
                          </div>
                          <button className="plate-btn" onClick={() => adjust(weightStep)}><Plus size={22} /></button>
                        </div>
                        <div className="g-step-row">
                          {STEPS.map((st) => (
                            <button key={st} className={`g-step-pill ${weightStep === st ? "active" : ""}`} onClick={() => setWeightStep(st)}>
                              ±{st}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="g-sets-reps-row">
                      <div className="g-sets-reps-col">
                        <label className="g-field-label" style={{ textAlign: "center" }}>Serie</label>
                        <div className="g-counter">
                          <button className="g-counter-btn" onClick={() => setSets((x) => Math.max(1, x - 1))}>−</button>
                          <div className="g-counter-num">{sets}</div>
                          <button className="g-counter-btn" onClick={() => setSets((x) => x + 1)}>+</button>
                        </div>
                      </div>
                      <div className="g-sets-reps-col">
                        <label className="g-field-label" style={{ textAlign: "center" }}>
                          {freeType === "time" ? "Secondi" : freeType === "amrap" ? "Rip. fatte" : "Ripetizioni"}
                        </label>
                        {freeType === "time" ? (
                          <DurationField value={reps} onChange={setReps} />
                        ) : (
                          <div className="g-counter">
                            <button className="g-counter-btn" onClick={() => setReps((x) => Math.max(freeType === "amrap" ? 0 : 1, x - 1))}>−</button>
                            <div className="g-counter-num">{reps}</div>
                            <button className="g-counter-btn" onClick={() => setReps((x) => x + 1)}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="g-sets-wrap">
                    <div className="g-set-head">
                      <span className="g-set-num" />
                      {!freeNoWeight && <span className="g-set-col">Peso</span>}
                      <span className="g-set-col">{freeType === "time" ? "Sec" : "Rip"}</span>
                      {freeSetRows.length > 1 && <span className="g-set-spacer" />}
                    </div>
                    {freeSetRows.map((r, j) => (
                      <div className="g-set-row" key={j}>
                        <span className="g-set-num">{j + 1}ª</span>
                        {!freeNoWeight && (
                          <input
                            className="g-input g-set-input ghisa-mono"
                            type="number"
                            step="0.5"
                            value={r.weight}
                            onChange={(e) => updateFreeSetRow(j, { weight: e.target.value })}
                          />
                        )}
                        <input
                          className="g-input g-set-input ghisa-mono"
                          type="number"
                          min="0"
                          value={r.reps}
                          onChange={(e) => updateFreeSetRow(j, { reps: e.target.value })}
                        />
                        {freeSetRows.length > 1 && (
                          <button className="g-del-btn" onClick={() => removeFreeSetRow(j)}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button className="g-icon-btn" style={{ width: "100%", justifyContent: "center", padding: 8, marginTop: 2 }} onClick={addFreeSetRow}>
                      <Plus size={14} /> Aggiungi serie
                    </button>
                  </div>
                )}
              </>
            )}

            {freeType !== "amrap" && freeType !== "cardio" && !freeNoWeight && (
              <div className="g-toggle-row">
                <button className={`g-toggle-pill ${isBackoff ? "active" : ""}`} onClick={() => setIsBackoff((v) => !v)}>
                  Serie back-off
                </button>
              </div>
            )}
          </>
        )}

        {(currentRest > 0 || timeBased || cardio) && (
          <div className="g-timer-box">
            {timeBased && currentRest > 0 && (
              <div className="g-timer-tabs">
                <button className={`g-step-pill ${timerMode === "exercise" ? "active" : ""}`} onClick={() => setTimerMode("exercise")}>
                  Esercizio
                </button>
                <button className={`g-step-pill ${timerMode === "rest" ? "active" : ""}`} onClick={() => setTimerMode("rest")}>
                  Recupero
                </button>
              </div>
            )}
            <div className="g-timer-label">
              {activeTimerMode === "exercise" ? "Durata esercizio" : "Recupero consigliato"}
            </div>
            <div className="g-timer-display ghisa-mono">{formatMMSS(timerRemaining)}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {alarmOn ? (
                <button className="g-submit" style={{ marginTop: 0, padding: "10px 22px" }} onClick={stopAlarm}>
                  Ferma suoneria
                </button>
              ) : (
                <>
                  <button className="g-icon-btn" onClick={() => { stopAlarm(); setTimerRunning((r) => !r); }} style={{ gap: 5 }}>
                    {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                    {timerRunning ? "Pausa" : "Avvia"}
                  </button>
                  <button className="g-icon-btn" onClick={() => { stopAlarm(); setTimerRemaining(activeTimerDuration); setTimerRunning(false); }} style={{ gap: 5 }}>
                    <RotateCcw size={14} /> Reset
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <button
          className="g-submit g-submit-secondary"
          style={!selectedScheda ? { marginTop: 16 } : undefined}
          disabled={selectedScheda ? activeParts.length === 0 : !exerciseInput.trim()}
          onClick={addToSession}
        >
          {backoffPhase ? "+ Aggiungi back-off alla sessione" : "+ Aggiungi alla sessione"}
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
            {session.map((e) =>
              editingSessionId === e.tempId ? (
                <div className="g-edit-row" key={e.tempId}>
                  <label className="g-field-label">Esercizio</label>
                  <ExercisePicker
                    exercises={exercises}
                    value={sessionEditDraft.exercise}
                    onChange={(v) => setSessionEditDraft((d) => ({ ...d, exercise: v }))}
                    placeholder=""
                  />
                  <div className="g-seg" style={{ marginTop: 8 }}>
                    {EX_TYPES.map((t) => (
                      <button
                        key={t.id}
                        className={`g-seg-btn ${sessionEditDraft.type === t.id ? "active" : ""}`}
                        onClick={() => setSessionEditDraft((d) => ({ ...d, type: t.id }))}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <label className="g-checkbox-row">
                    <input
                      type="checkbox"
                      checked={sessionEditDraft.noWeight}
                      onChange={(ev) => setSessionEditDraft((d) => ({ ...d, noWeight: ev.target.checked }))}
                    />
                    Senza carico (corpo libero)
                  </label>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {!sessionEditDraft.noWeight && (
                      <div style={{ flex: 1 }}>
                        <label className="g-field-label">Peso</label>
                        <input
                          className="g-input g-num-small"
                          type="number"
                          step="0.5"
                          value={sessionEditDraft.weight}
                          onChange={(ev) => setSessionEditDraft((d) => ({ ...d, weight: parseFloat(ev.target.value) || 0 }))}
                        />
                      </div>
                    )}
                    {sessionEditDraft.type !== "cardio" && (
                      <div style={{ flex: 1 }}>
                        <label className="g-field-label">Serie</label>
                        <input
                          className="g-input g-num-small"
                          type="number"
                          min="1"
                          value={sessionEditDraft.sets}
                          onChange={(ev) => setSessionEditDraft((d) => ({ ...d, sets: parseInt(ev.target.value) || 1 }))}
                        />
                      </div>
                    )}
                    <div style={{ flex: 1.4 }}>
                      <label className="g-field-label">
                        {sessionEditDraft.type === "time" || sessionEditDraft.type === "cardio"
                          ? "Durata"
                          : sessionEditDraft.type === "amrap"
                          ? "Rip. fatte"
                          : "Ripetizioni"}
                      </label>
                      {sessionEditDraft.type === "time" || sessionEditDraft.type === "cardio" ? (
                        <DurationField
                          value={sessionEditDraft.reps}
                          onChange={(secs) => setSessionEditDraft((d) => ({ ...d, reps: secs }))}
                        />
                      ) : (
                        <input
                          className="g-input g-num-small"
                          type="number"
                          min="0"
                          value={sessionEditDraft.reps}
                          onChange={(ev) => setSessionEditDraft((d) => ({ ...d, reps: parseInt(ev.target.value) || 0 }))}
                        />
                      )}
                    </div>
                  </div>
                  {sessionEditDraft.type !== "amrap" && sessionEditDraft.type !== "cardio" && !sessionEditDraft.noWeight && (
                    <label className="g-checkbox-row">
                      <input
                        type="checkbox"
                        checked={sessionEditDraft.backoff}
                        onChange={(ev) => setSessionEditDraft((d) => ({ ...d, backoff: ev.target.checked }))}
                      />
                      Serie back-off
                    </label>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="g-icon-btn" style={{ flex: 1, justifyContent: "center" }} onClick={cancelEditSession}>
                      Annulla
                    </button>
                    <button
                      className="g-submit"
                      style={{ flex: 1, marginTop: 0 }}
                      disabled={!sessionEditDraft.exercise.trim()}
                      onClick={saveEditSession}
                    >
                      Salva
                    </button>
                  </div>
                </div>
              ) : (
                <div className="g-history-row" key={e.tempId}>
                  <div className="g-history-main">
                    <div className="g-history-ex">
                      {e.exercise}
                      {e.backoff && <span style={{ color: "var(--steel)", fontSize: 11 }}> · back-off</span>}
                    </div>
                    <div className="g-history-sets">{logSummary(e)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button className="g-del-btn" onClick={() => startEditSession(e)} aria-label="Modifica">
                      <Pencil size={15} />
                    </button>
                    <button className="g-del-btn" onClick={() => removeFromSession(e.tempId)} aria-label="Rimuovi">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )
            )}
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

      {guideFor && (
        <ExerciseGuideModal
          exerciseName={guideFor}
          savedSlug={exerciseGuide[guideFor]}
          canManage={canManageGuide}
          onSelect={(slug) => onSetGuide && onSetGuide(guideFor, slug)}
          onClear={() => onClearGuide && onClearGuide(guideFor)}
          onClose={() => setGuideFor(null)}
        />
      )}
    </div>
  );
}
