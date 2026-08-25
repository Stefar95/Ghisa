export const STEPS = [0.5, 1.25, 2.5, 5, 10];

// Numero minimo di caratteri prima che una ricerca (esercizi, utenti...) parta
export const SEARCH_MIN_CHARS = 2;

export const BODY_PARTS = [
  "Petto", "Schiena", "Spalle", "Bicipiti", "Tricipiti",
  "Avambracci", "Gambe", "Glutei", "Polpacci", "Core",
];

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function confirmThen(message, fn) {
  if (window.confirm(message)) fn();
}

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// --- Range ripetizioni e % back-off, con fallback per le schede create prima di queste opzioni ---

export function getReps(item) {
  const min = item.repsMin ?? item.reps ?? 1;
  const max = item.repsMax ?? item.reps ?? min;
  return { min, max };
}

export function getBackoffReps(item) {
  const min = item.backoffRepsMin ?? item.backoffReps ?? 1;
  const max = item.backoffRepsMax ?? item.backoffReps ?? min;
  return { min, max };
}

export function getBackoffPercent(item) {
  return item.backoffPercent ?? 30;
}

export function repsLabel(min, max) {
  return min === max ? `${min}` : `${min}-${max}`;
}

// Tipo di esercizio: a ripetizioni (default), a tempo (plank...), a sfinimento (AMRAP),
// cardio (cyclette, tapis roulant...: una durata unica, senza serie né recupero)
export const EX_TYPES = [
  { id: "reps", label: "Ripetizioni" },
  { id: "time", label: "A tempo" },
  { id: "amrap", label: "A sfinimento" },
  { id: "cardio", label: "Cardio" },
];

export function getExType(item) {
  return item?.type || "reps";
}

export function isTimeBased(item) {
  return getExType(item) === "time";
}

export function isAmrap(item) {
  return getExType(item) === "amrap";
}

export function isCardio(item) {
  return getExType(item) === "cardio";
}

// Esercizi la cui "quantità" per serie è una durata (mm:ss) e non un numero di ripetizioni
export function isDurationBased(item) {
  return isTimeBased(item) || isCardio(item);
}

// Durata di default proposta quando si passa a un tipo a tempo: 30" per un
// esercizio a tempo (plank...), 10' per un cardio continuo (cyclette...)
export function defaultDuration(type) {
  return type === "cardio" ? 600 : 30;
}

export function hasNoWeight(item) {
  return !!item?.noWeight;
}

export function isWarmup(item) {
  return !!item?.warmup;
}

// Unità della "quantità" per serie: ripetizioni o secondi
export function amountUnit(item) {
  return isDurationBased(item) ? "sec" : "rip";
}

// Etichetta obiettivo di una riga di scheda: "3x5-7", "3x30-45s", "3x max", "20:00" (cardio)
export function targetLabel(item) {
  const t = getExType(item);
  if (t === "cardio") return formatMMSS(getReps(item).max);
  if (t === "amrap") return `${item.sets}x max`;
  const { min, max } = getReps(item);
  if (t === "time") return `${item.sets}x ${repsLabel(min, max)}s`;
  return `${item.sets}x${repsLabel(min, max)}`;
}

// Riepilogo di un allenamento registrato: "3 x 45s · corpo libero"
export function logSummary(l) {
  const t = l.type || "reps";
  const unit = t === "time" ? "s" : "";

  // Cardio: durata unica, niente concetto di serie
  if (t === "cardio") {
    const durata = formatMMSS(l.reps || 0);
    return l.noWeight ? durata : `${durata} · ${l.weight} kg`;
  }

  // Serie non uniformi: le elenchiamo una per una (es. "40x10 · 40x10 · 50x8")
  if (Array.isArray(l.setDetails) && l.setDetails.length) {
    return l.setDetails
      .map((d) => (l.noWeight ? `${d.reps}${unit}` : `${d.weight}x${d.reps}${unit}`))
      .join(" · ");
  }

  const amount = t === "time" ? `${l.reps}s` : t === "amrap" ? `${l.reps} (max)` : `${l.reps}`;
  const load = l.noWeight ? "corpo libero" : `${l.weight} kg`;
  return `${l.sets} x ${amount} · ${load}`;
}


// --- Blocchi: un elemento di scheda può contenere più esercizi (superset/jumpset) ---

export const JUMPSET_REST = 60; // default: 1' di pausa tra gli esercizi di un jumpset (modificabile per blocco)

export const COMBO_TYPES = [
  { id: "none", label: "Singolo" },
  { id: "superset", label: "Superset", desc: "Un esercizio dopo l'altro" },
  { id: "jumpset", label: "Jumpset", desc: "Una breve pausa tra un esercizio e l'altro" },
];

export function getCombo(item) {
  return item?.combo || "none";
}

export function comboLabel(c) {
  return c === "superset" ? "Superset" : c === "jumpset" ? "Jumpset" : "";
}

// Normalizza un elemento di scheda in una lista di esercizi.
// Le schede vecchie (un solo esercizio per riga) continuano a funzionare.
export function getParts(item) {
  if (Array.isArray(item?.parts) && item.parts.length) return item.parts;
  if (!item) return [];
  const r = getReps(item);
  const bo = getBackoffReps(item);
  return [
    {
      exercise: item.exercise,
      type: item.type || "reps",
      noWeight: !!item.noWeight,
      repsMin: r.min,
      repsMax: r.max,
      backoffSets: item.backoffSets || 0,
      backoffRepsMin: bo.min,
      backoffRepsMax: bo.max,
      backoffPercent: getBackoffPercent(item),
    },
  ];
}

export function makePart(overrides = {}) {
  return {
    exercise: "",
    type: "reps",
    noWeight: false,
    repsMin: 8,
    repsMax: 8,
    backoffSets: 0,
    backoffRepsMin: 8,
    backoffRepsMax: 8,
    backoffPercent: 30,
    ...overrides,
  };
}

// "8-10", "30s", "max", "20:00" (cardio)
export function partAmountLabel(p) {
  const t = p?.type || "reps";
  if (t === "cardio") return formatMMSS(p.repsMax ?? p.repsMin ?? 0);
  if (t === "amrap") return "max";
  const lbl = repsLabel(p.repsMin ?? 1, p.repsMax ?? p.repsMin ?? 1);
  return t === "time" ? `${lbl}s` : lbl;
}

// "Panca + Croci"
export function blockTitle(item) {
  return getParts(item).map((p) => p.exercise).join(" + ");
}

// "4x 8-10 + 7-9" (un cardio da solo non ha serie: solo la durata, "20:00")
export function blockTarget(item) {
  const parts = getParts(item);
  if (parts.length === 1) {
    if (parts[0].type === "cardio") return partAmountLabel(parts[0]);
    return `${item.sets}x${partAmountLabel(parts[0])}`;
  }
  return `${item.sets}x ${parts.map(partAmountLabel).join(" + ")}`;
}

// Recupero dopo un esercizio: dentro un blocco è breve (0 superset, la pausa
// impostata per il jumpset), il recupero della scheda vale solo a fine blocco.
export function restAfterPart(item, partIdx) {
  const parts = getParts(item);
  const combo = getCombo(item);
  if (partIdx < parts.length - 1 && combo !== "none") {
    return combo === "jumpset"
      ? { seconds: item.jumpsetRestSeconds ?? JUMPSET_REST, kind: "jumpset", nextExercise: parts[partIdx + 1].exercise }
      : { seconds: 0, kind: "superset", nextExercise: parts[partIdx + 1].exercise };
  }
  return { seconds: item.restSeconds || 0, kind: "rest" };
}

// Elenco piatto di tutti gli esercizi della scheda, per avanzare a step
export function flattenSteps(items) {
  const steps = [];
  (items || []).forEach((item, itemIdx) => {
    getParts(item).forEach((part, partIdx) => {
      steps.push({ item, itemIdx, part, partIdx });
    });
  });
  return steps;
}

// --- Schede a più giorni ---
// Una scheda è un programma che contiene più giorni di allenamento.
// Le schede vecchie (un solo elenco di esercizi) diventano un giorno unico,
// mantenendo lo stesso id e nome così storico e statistiche restano coerenti.
export function getDays(scheda) {
  if (Array.isArray(scheda?.days) && scheda.days.length) return scheda.days;
  if (Array.isArray(scheda?.items)) {
    return [{ id: scheda.id, name: scheda.name, items: scheda.items }];
  }
  return [];
}

export function makeDay(name = "Giorno 1") {
  return { id: uid(), name, items: [] };
}

// Elenco piatto dei giorni di tutte le schede, per il menu in allenamento
export function dayOptions(schede) {
  const out = [];
  (schede || []).forEach((s) => {
    const days = getDays(s);
    days.forEach((d) => {
      out.push({
        id: d.id,
        // Con un solo giorno basta il nome della scheda (come prima)
        label: days.length > 1 ? `${s.name} · ${d.name}` : s.name,
        scheda: s,
        day: d,
      });
    });
  });
  return out;
}

// --- Suoneria di fine timer ---
// Suona a intervalli finché non viene fermata, e comunque si spegne da sola
// dopo 10 secondi. Restituisce la funzione per interromperla.
export function startAlarm(maxMs = 10000) {
  let ctx = null;
  let interval = null;
  let stopped = false;

  const beep = () => {
    if (stopped) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!ctx) ctx = new Ctx();
      const t = ctx.currentTime;
      [0, 0.18].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(offset ? 1046 : 880, t + offset);
        gain.gain.setValueAtTime(0.0001, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.3, t + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.18);
      });
      if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    } catch (e) {
      /* audio non disponibile */
    }
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (interval) clearInterval(interval);
    if (ctx) setTimeout(() => ctx.close().catch(() => {}), 300);
  };

  beep();
  interval = setInterval(beep, 900);
  setTimeout(stop, maxMs);
  return stop;
}

// "8:00" o "480" -> 480 secondi
export function parseMMSS(text) {
  const v = String(text || "").trim();
  if (!v) return 0;
  if (v.includes(":")) {
    const [m, s] = v.split(":");
    return Math.max(0, (parseInt(m) || 0) * 60 + (parseInt(s) || 0));
  }
  return Math.max(0, parseInt(v) || 0);
}
