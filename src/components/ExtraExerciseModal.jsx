import { useState, useEffect } from "react";
import { X, Plus, Minus, BookOpen, Info, ChevronDown, ChevronUp } from "lucide-react";
import { uid, STEPS, EX_TYPES, defaultDuration } from "../lib/utils";
import ExercisePicker from "./ExercisePicker";
import DurationField from "./DurationField";
import SetFieldStepper from "./SetFieldStepper";
import BodyDiagram from "./BodyDiagram";

// Modale per aggiungere alla sessione in corso un esercizio fuori scheda
// (riscaldamento, accessorio, serie diverse...): stesse opzioni del form
// "Giorno libero", ma senza toccare il percorso a step della scheda.
export default function ExtraExerciseModal({
  title = "Esercizio extra", exercises, exerciseMeta = {}, exerciseGuide = {}, suggestWeight, onOpenGuide, onAdd, onClose,
}) {
  const [exercise, setExercise] = useState("");
  const [type, setType] = useState("reps");
  const [noWeight, setNoWeight] = useState(false);
  const [warmup, setWarmup] = useState(false);
  const [uniform, setUniform] = useState(true);
  const [weight, setWeight] = useState(20);
  const [weightStep, setWeightStep] = useState(2.5);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [setRows, setSetRows] = useState([]);
  const [backoff, setBackoff] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const nome = exercise.trim();
  const parti = exerciseMeta[nome] || [];
  const aTempo = type === "time";
  const aCardio = type === "cardio";
  const aSfinimento = type === "amrap";
  const boAllowed = !aSfinimento && !aCardio && !noWeight;

  // Peso proposto: ultimo top set registrato per l'esercizio scelto, altrimenti 20 kg
  useEffect(() => {
    if (suggestWeight) setWeight(suggestWeight(nome));
  }, [nome]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseType = (id) => {
    if (id === type) return;
    // Cambiando tipo si riparte da un default sensato per quel tipo
    setType(id);
    setReps(id === "time" || id === "cardio" ? defaultDuration(id) : 10);
    setUniform(true);
    setSetRows([]);
  };

  const toggleUniform = (next) => {
    setUniform(next);
    if (!next) setSetRows(Array.from({ length: Math.max(1, sets) }, () => ({ weight, reps })));
  };
  const updateRow = (j, patch) => setSetRows((prev) => prev.map((r, k) => (k === j ? { ...r, ...patch } : r)));
  const addRow = () => setSetRows((prev) => [...prev, { ...(prev[prev.length - 1] || { weight, reps }) }]);
  const removeRow = (j) => setSetRows((prev) => prev.filter((_, k) => k !== j));

  const confirm = () => {
    if (!nome) return;
    const base = {
      tempId: uid(),
      exercise: nome,
      backoff: boAllowed && backoff,
      type,
      noWeight,
      warmup,
    };
    let entry;
    if (!aCardio && !uniform && setRows.length) {
      const righe = setRows.map((r) => ({
        weight: noWeight ? 0 : Number(r.weight) || 0,
        reps: Number(r.reps) || 0,
      }));
      const best = righe.reduce(
        (acc, r) => (noWeight ? (r.reps > acc.reps ? r : acc) : r.weight > acc.weight ? r : acc),
        righe[0]
      );
      entry = { ...base, weight: best.weight, sets: righe.length, reps: best.reps, setDetails: righe };
    } else {
      entry = {
        ...base,
        weight: noWeight ? 0 : Number(weight) || 0,
        sets: aCardio ? 1 : Number(sets) || 1,
        reps: Number(reps) || 0,
      };
    }
    onAdd(entry);
  };

  return (
    <div className="g-modal-overlay" onClick={onClose}>
      <div className="g-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <Plus size={17} color="var(--accent)" /> {title}
          </div>
          <button className="g-icon-btn" onClick={onClose} aria-label="Chiudi"><X size={16} /></button>
        </div>

        <label className="g-field-label" style={{ marginTop: 16 }}>Esercizio</label>
        {/* Esercizio a sinistra, guida e parte del corpo a destra */}
        <div className="g-extra-row" style={{ marginTop: 0, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ExercisePicker exercises={exercises} value={exercise} onChange={setExercise} placeholder="" />
          </div>
          <button
            className="g-round-btn"
            disabled={!nome}
            onClick={() => onOpenGuide(nome)}
            aria-label="Guida all'esercizio"
            title="Guida all'esercizio"
          >
            <BookOpen size={16} color={exerciseGuide[nome] ? "var(--success)" : undefined} />
          </button>
          <button
            className={`g-round-btn ${showBody ? "active" : ""}`}
            disabled={!nome}
            onClick={() => setShowBody((s) => !s)}
            aria-label="Parte del corpo"
            title="Parte del corpo"
          >
            <Info size={16} />
          </button>
        </div>

        {showBody && nome && (
          <div className="g-extra-body">
            {parti.length > 0 ? (
              <>
                <div className="g-extra-field-label" style={{ marginBottom: 6 }}>{parti.join(", ")}</div>
                <BodyDiagram selected={parti} size={64} />
              </>
            ) : (
              <div className="g-extra-field-label">Nessuna parte del corpo registrata per questo esercizio.</div>
            )}
          </div>
        )}

        <label className="g-field-label" style={{ marginTop: 14 }}>Tipo</label>
        <div className="g-seg">
          {EX_TYPES.map((t) => (
            <button key={t.id} className={`g-seg-btn ${type === t.id ? "active" : ""}`} onClick={() => chooseType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="g-extra-sep" />

        {!aCardio && (
          <div className="g-seg" style={{ marginTop: 14 }}>
            <button className={`g-seg-btn ${uniform ? "active" : ""}`} onClick={() => toggleUniform(true)}>
              Serie uguali
            </button>
            <button className={`g-seg-btn ${!uniform ? "active" : ""}`} onClick={() => toggleUniform(false)}>
              Serie diverse
            </button>
          </div>
        )}

        {!aCardio && uniform && !noWeight && (
          <div style={{ marginTop: 14 }}>
            <label className="g-field-label" style={{ textAlign: "center" }}>Peso</label>
            <div className="g-weight-row">
              <button className="plate-btn" onClick={() => setWeight((w) => Math.max(0, Math.round((w - weightStep) * 100) / 100))}>
                <Minus size={22} />
              </button>
              <div className="g-weight-mid">
                <input
                  className="weight-readout ghisa-mono"
                  type="number"
                  step="0.5"
                  value={weight}
                  onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                />
                <div className="weight-unit">KG</div>
              </div>
              <button className="plate-btn" onClick={() => setWeight((w) => Math.round((w + weightStep) * 100) / 100)}>
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

        {/* Serie × ripetizioni (o durata, per il cardio) */}
        {(aCardio || uniform) && (
          <div className="g-extra-row" style={{ marginTop: 14 }}>
            <div className="g-extra-amount">
              {aCardio ? (
                <DurationField value={reps} onChange={setReps} />
              ) : (
                <>
                  <div className="g-extra-field">
                    <span className="g-extra-field-label">Serie</span>
                    <SetFieldStepper mono step={1} min={1} value={sets} onChange={(v) => setSets(v)} />
                  </div>
                  <span className="g-extra-times">×</span>
                  <div className="g-extra-field">
                    <span className="g-extra-field-label">{aTempo ? "Sec" : aSfinimento ? "Rip. fatte" : "Rip"}</span>
                    <SetFieldStepper
                      mono
                      step={aTempo ? 15 : 1}
                      min={aSfinimento ? 0 : 1}
                      value={reps}
                      onChange={(v) => setReps(v)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!aCardio && !uniform && (
          <div className="g-sets-wrap" style={{ marginTop: 14 }}>
            <div className="g-set-head">
              <span className="g-set-num" />
              {!noWeight && <span className="g-set-col">Peso</span>}
              <span className="g-set-col">{aTempo ? "Sec" : "Rip"}</span>
              {setRows.length > 1 && <span className="g-set-spacer" />}
            </div>
            {setRows.map((r, j) => (
              <div className="g-set-row" key={j}>
                <span className="g-set-num">{j + 1}ª</span>
                {!noWeight && (
                  <SetFieldStepper mono step={0.25} value={r.weight} onChange={(val) => updateRow(j, { weight: val })} />
                )}
                <SetFieldStepper mono step={1} value={r.reps} onChange={(val) => updateRow(j, { reps: val })} />
                {setRows.length > 1 && (
                  <button className="g-del-btn" onClick={() => removeRow(j)} aria-label="Rimuovi serie">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button className="g-icon-btn" style={{ width: "100%", justifyContent: "center", padding: 8, marginTop: 2 }} onClick={addRow}>
              <Plus size={14} /> Aggiungi serie
            </button>
          </div>
        )}

        <button
          className="g-icon-btn"
          style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
          onClick={() => setShowAdvanced((s) => !s)}
        >
          Opzioni avanzate {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showAdvanced && (
          <div className="g-extra-body">
            <label className="g-checkbox-row" style={{ marginTop: 0 }}>
              <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} />
              Riscaldamento
            </label>
            <label className="g-checkbox-row">
              <input type="checkbox" checked={noWeight} onChange={(e) => setNoWeight(e.target.checked)} />
              Senza carico (corpo libero)
            </label>
            {boAllowed && (
              <label className="g-checkbox-row">
                <input type="checkbox" checked={backoff} onChange={(e) => setBackoff(e.target.checked)} />
                Serie back-off
              </label>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="g-icon-btn" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>
            Annulla
          </button>
          <button className="g-submit" style={{ flex: 1, marginTop: 0 }} disabled={!nome} onClick={confirm}>
            Aggiungi
          </button>
        </div>
      </div>
    </div>
  );
}
