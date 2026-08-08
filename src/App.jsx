import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Dumbbell,
  TrendingUp,
  Flame,
  Trash2,
  Plus,
  Minus,
  ListChecks,
  BarChart3,
  Lock,
  Unlock,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Info,
  Sun,
  Moon,
  LogIn,
} from "lucide-react";

import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { ADMIN_EMAIL, PAYPAL_LINK } from "./config";

const STEPS = [0.5, 1.25, 2.5, 5, 10];
const EX_KEY = "ghisa-exercises";
const LOG_KEY = "ghisa-logs";
const SCHEDE_KEY = "ghisa-schede";
const EX_META_KEY = "ghisa-exercise-meta";
const DRAFT_KEY = "ghisa-draft-session";

const BODY_PARTS = [
  "Petto", "Schiena", "Spalle", "Bicipiti", "Tricipiti",
  "Avambracci", "Gambe", "Glutei", "Polpacci", "Core",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function confirmThen(message, fn) {
  if (window.confirm(message)) fn();
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function BodyDiagram({ selected = [], size = 90 }) {
  const c = (part) => (selected.includes(part) ? "var(--accent)" : "var(--surface-2)");
  const stroke = "var(--line)";
  const h = Math.round(size * 1.75);

  return (
    <div style={{ display: "flex", gap: 18, justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ textAlign: "center" }}>
        <svg width={size} height={h} viewBox="0 0 100 175" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="16" r="13" fill="var(--line)" />
          <rect x="44" y="27" width="12" height="10" fill="var(--line)" />
          <ellipse cx="24" cy="46" rx="11" ry="9" fill={c("Spalle")} stroke={stroke} strokeWidth="1" />
          <ellipse cx="76" cy="46" rx="11" ry="9" fill={c("Spalle")} stroke={stroke} strokeWidth="1" />
          <rect x="34" y="40" width="32" height="26" rx="6" fill={c("Petto")} stroke={stroke} strokeWidth="1" />
          <rect x="36" y="68" width="28" height="30" rx="6" fill={c("Core")} stroke={stroke} strokeWidth="1" />
          <rect x="12" y="50" width="12" height="34" rx="6" fill={c("Bicipiti")} stroke={stroke} strokeWidth="1" />
          <rect x="76" y="50" width="12" height="34" rx="6" fill={c("Bicipiti")} stroke={stroke} strokeWidth="1" />
          <rect x="10" y="84" width="11" height="34" rx="5" fill={c("Avambracci")} stroke={stroke} strokeWidth="1" />
          <rect x="79" y="84" width="11" height="34" rx="5" fill={c("Avambracci")} stroke={stroke} strokeWidth="1" />
          <rect x="34" y="100" width="14" height="60" rx="6" fill={c("Gambe")} stroke={stroke} strokeWidth="1" />
          <rect x="52" y="100" width="14" height="60" rx="6" fill={c("Gambe")} stroke={stroke} strokeWidth="1" />
          <rect x="33" y="160" width="16" height="10" rx="4" fill="var(--line)" />
          <rect x="51" y="160" width="16" height="10" rx="4" fill="var(--line)" />
        </svg>
        <div className="g-diagram-label">Fronte</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <svg width={size} height={h} viewBox="0 0 100 175" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="16" r="13" fill="var(--line)" />
          <rect x="44" y="27" width="12" height="10" fill="var(--line)" />
          <ellipse cx="24" cy="46" rx="11" ry="9" fill={c("Spalle")} stroke={stroke} strokeWidth="1" />
          <ellipse cx="76" cy="46" rx="11" ry="9" fill={c("Spalle")} stroke={stroke} strokeWidth="1" />
          <rect x="32" y="40" width="36" height="34" rx="8" fill={c("Schiena")} stroke={stroke} strokeWidth="1" />
          <rect x="12" y="50" width="12" height="34" rx="6" fill={c("Tricipiti")} stroke={stroke} strokeWidth="1" />
          <rect x="76" y="50" width="12" height="34" rx="6" fill={c("Tricipiti")} stroke={stroke} strokeWidth="1" />
          <rect x="10" y="84" width="11" height="34" rx="5" fill="var(--line)" />
          <rect x="79" y="84" width="11" height="34" rx="5" fill="var(--line)" />
          <rect x="34" y="76" width="32" height="24" rx="10" fill={c("Glutei")} stroke={stroke} strokeWidth="1" />
          <rect x="34" y="100" width="14" height="30" rx="6" fill="var(--line)" />
          <rect x="52" y="100" width="14" height="30" rx="6" fill="var(--line)" />
          <rect x="34" y="130" width="14" height="30" rx="6" fill={c("Polpacci")} stroke={stroke} strokeWidth="1" />
          <rect x="52" y="130" width="14" height="30" rx="6" fill={c("Polpacci")} stroke={stroke} strokeWidth="1" />
          <rect x="33" y="160" width="16" height="10" rx="4" fill="var(--line)" />
          <rect x="51" y="160" width="16" height="10" rx="4" fill="var(--line)" />
        </svg>
        <div className="g-diagram-label">Retro</div>
      </div>
    </div>
  );
}

function ExercisePicker({ exercises, value, onChange, placeholder, locked }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const query = value || "";
  const matches = exercises
    .filter((e) => e.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);
  const exactMatch = exercises.some((e) => e.toLowerCase() === query.trim().toLowerCase());

  if (locked) {
    return (
      <div className="g-locked-field">
        <Lock size={13} color="var(--ink-dim)" />
        {value}
      </div>
    );
  }

  return (
    <div className="g-autocomplete-wrap" ref={wrapRef}>
      <input
        className="g-input"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && (
        <div className="g-autocomplete-list">
          {matches.map((m) => (
            <div
              key={m}
              className="g-autocomplete-item"
              onMouseDown={() => {
                onChange(m);
                setOpen(false);
              }}
            >
              {m}
            </div>
          ))}
          {query.trim() && !exactMatch && (
            <div
              className="g-autocomplete-item g-autocomplete-new"
              onMouseDown={() => setOpen(false)}
            >
              Non lo trovi? Inserisci: "{query.trim()}"
            </div>
          )}
          {matches.length === 0 && !query.trim() && (
            <div className="g-autocomplete-item" style={{ color: "var(--ink-dim)", cursor: "default" }}>
              Scrivi per cercare o aggiungere un esercizio
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("stats"); // 'stats' | 'log' | 'admin'
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState([]);
  const [schede, setSchede] = useState([]);
  const [exerciseMeta, setExerciseMeta] = useState({});
  const [draftSession, setDraftSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("ghisa-theme") || "dark";
    } catch (e) {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ghisa-theme", theme);
    } catch (e) {
      /* ignora */
    }
    document.body.style.background = theme === "light" ? "#e7e2d4" : "#0b0c0e";
  }, [theme]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const isAdmin = !!authUser && authUser.email === ADMIN_EMAIL;

  useEffect(() => {
    if (view === "admin" && authUser && !isAdmin) setView("stats");
  }, [view, authUser, isAdmin]);

  const signIn = useCallback(() => {
    signInWithPopup(auth, googleProvider).catch((e) => console.error(e));
  }, []);

  const signOutUser = useCallback(() => {
    signOut(auth).catch((e) => console.error(e));
  }, []);

  // Riferimenti sempre aggiornati ai dati locali, usati solo per la
  // migrazione una tantum quando un utente fa login per la prima volta.
  const logsRef = useRef(logs);
  const schedeRef = useRef(schede);
  const draftRef = useRef(draftSession);
  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { schedeRef.current = schede; }, [schede]);
  useEffect(() => { draftRef.current = draftSession; }, [draftSession]);

  // Caricamento iniziale da localStorage: veloce, e funziona anche senza login/offline
  useEffect(() => {
    let ex = [];
    let lg = [];
    let sc = [];
    let meta = {};
    let draft = null;
    try {
      const raw = localStorage.getItem(EX_KEY);
      if (raw) ex = JSON.parse(raw);
    } catch (e) {
      /* nessun dato salvato ancora */
    }
    try {
      const raw = localStorage.getItem(LOG_KEY);
      if (raw) lg = JSON.parse(raw);
    } catch (e) {
      /* nessun dato salvato ancora */
    }
    try {
      const raw = localStorage.getItem(SCHEDE_KEY);
      if (raw) sc = JSON.parse(raw);
    } catch (e) {
      /* nessun dato salvato ancora */
    }
    try {
      const raw = localStorage.getItem(EX_META_KEY);
      if (raw) meta = JSON.parse(raw);
    } catch (e) {
      /* nessun dato salvato ancora */
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) draft = JSON.parse(raw);
    } catch (e) {
      /* nessun dato salvato ancora */
    }
    setExercises(ex);
    setLogs(lg);
    setSchede(sc);
    setExerciseMeta(meta);
    setDraftSession(draft);
    setLoading(false);
  }, []);

  // Anagrafica esercizi: SEMPRE la stessa per tutti (letta anche senza login),
  // modificabile solo dall'admin. Sincronizzata in tempo reale.
  useEffect(() => {
    const ref = doc(db, "shared", "registry");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.exercises)) {
            setExercises(data.exercises);
            try { localStorage.setItem(EX_KEY, JSON.stringify(data.exercises)); } catch (e) {}
          }
          if (data.exerciseMeta && typeof data.exerciseMeta === "object") {
            setExerciseMeta(data.exerciseMeta);
            try { localStorage.setItem(EX_META_KEY, JSON.stringify(data.exerciseMeta)); } catch (e) {}
          }
        }
      },
      (e) => console.error(e)
    );
    return unsub;
  }, []);

  // Schede, allenamenti e bozza: privati per ciascun utente che ha fatto login.
  // Senza login restano solo su questo dispositivo (localStorage), come prima.
  useEffect(() => {
    if (!authUser) return;
    const ref = doc(db, "users", authUser.uid);
    let didInit = false;
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.logs)) {
            setLogs(data.logs);
            try { localStorage.setItem(LOG_KEY, JSON.stringify(data.logs)); } catch (e) {}
          }
          if (Array.isArray(data.schede)) {
            setSchede(data.schede);
            try { localStorage.setItem(SCHEDE_KEY, JSON.stringify(data.schede)); } catch (e) {}
          }
          if (data.draftSession !== undefined) {
            setDraftSession(data.draftSession);
            try {
              if (data.draftSession) localStorage.setItem(DRAFT_KEY, JSON.stringify(data.draftSession));
              else localStorage.removeItem(DRAFT_KEY);
            } catch (e) {}
          }
        } else if (!didInit) {
          didInit = true;
          // Primo accesso di questo account: l'admin porta su i propri dati
          // locali esistenti; ogni altro utente parte pulito, per non
          // ritrovarsi con la scheda/gli allenamenti di qualcun altro.
          const isThisAdmin = authUser.email === ADMIN_EMAIL;
          const initial = isThisAdmin
            ? { logs: logsRef.current, schede: schedeRef.current, draftSession: draftRef.current }
            : { logs: [], schede: [], draftSession: null };
          try {
            await setDoc(ref, initial);
          } catch (e) {
            console.error(e);
          }
        }
      },
      (e) => console.error(e)
    );
    return unsub;
  }, [authUser]);

  const persist = useCallback(
    (key, value) => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
        setSaveError(false);
      } catch (e) {
        setSaveError(true);
      }

      if (key === EX_KEY || key === EX_META_KEY) {
        // Anagrafica condivisa: scrivibile solo dall'admin (le regole di
        // sicurezza di Firestore rifiutano il resto, la UI qui è già
        // riservata all'admin).
        const field = key === EX_KEY ? "exercises" : "exerciseMeta";
        setDoc(doc(db, "shared", "registry"), { [field]: value }, { merge: true }).catch((e) =>
          console.error(e)
        );
        return;
      }

      if (authUser) {
        const field = key === LOG_KEY ? "logs" : key === SCHEDE_KEY ? "schede" : key === DRAFT_KEY ? "draftSession" : null;
        if (field) {
          setDoc(doc(db, "users", authUser.uid), { [field]: value }, { merge: true }).catch((e) =>
            console.error(e)
          );
        }
      }
    },
    [authUser]
  );

  const addLog = useCallback(
    (entry) => {
      setLogs((prev) => {
        const next = [entry, ...prev];
        persist(LOG_KEY, next);
        return next;
      });
      setExercises((prev) => {
        if (prev.includes(entry.exercise)) return prev;
        const next = [...prev, entry.exercise];
        persist(EX_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const addLogsBatch = useCallback(
    (entries) => {
      if (!entries.length) return;
      setLogs((prev) => {
        const next = [...entries, ...prev];
        persist(LOG_KEY, next);
        return next;
      });
      setExercises((prev) => {
        const names = new Set(prev);
        let changed = false;
        entries.forEach((e) => {
          if (!names.has(e.exercise)) {
            names.add(e.exercise);
            changed = true;
          }
        });
        if (!changed) return prev;
        const next = Array.from(names);
        persist(EX_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const deleteLog = useCallback(
    (id) => {
      setLogs((prev) => {
        const next = prev.filter((l) => l.id !== id);
        persist(LOG_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const deleteLogsBatch = useCallback(
    (ids) => {
      const idSet = new Set(ids);
      setLogs((prev) => {
        const next = prev.filter((l) => !idSet.has(l.id));
        persist(LOG_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const updateLog = useCallback(
    (id, patch) => {
      setLogs((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
        persist(LOG_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const saveDraft = useCallback(
    (draft) => {
      setDraftSession(draft);
      persist(DRAFT_KEY, draft);
    },
    [persist]
  );

  const addExerciseToRegistry = useCallback(
    (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setExercises((prev) => {
        if (prev.some((e) => e.toLowerCase() === trimmed.toLowerCase())) return prev;
        const next = [...prev, trimmed];
        persist(EX_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const removeExerciseFromRegistry = useCallback(
    (name) => {
      setExercises((prev) => {
        const next = prev.filter((e) => e !== name);
        persist(EX_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const setExerciseBodyParts = useCallback(
    (name, parts) => {
      setExerciseMeta((prev) => {
        const next = { ...prev, [name]: parts };
        persist(EX_META_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const mergeExercises = useCallback(
    (namesToMerge, keepName) => {
      const toReplace = namesToMerge.filter((n) => n !== keepName);
      if (toReplace.length === 0) return;

      setLogs((prev) => {
        const next = prev.map((l) =>
          toReplace.includes(l.exercise) ? { ...l, exercise: keepName } : l
        );
        persist(LOG_KEY, next);
        return next;
      });

      setSchede((prev) => {
        const next = prev.map((s) => ({
          ...s,
          items: s.items.map((it) =>
            toReplace.includes(it.exercise) ? { ...it, exercise: keepName } : it
          ),
        }));
        persist(SCHEDE_KEY, next);
        return next;
      });

      setExercises((prev) => {
        const next = prev.filter((e) => !toReplace.includes(e));
        if (!next.includes(keepName)) next.push(keepName);
        persist(EX_KEY, next);
        return next;
      });

      setExerciseMeta((prev) => {
        const merged = new Set(prev[keepName] || []);
        toReplace.forEach((n) => (prev[n] || []).forEach((p) => merged.add(p)));
        const next = { ...prev };
        toReplace.forEach((n) => delete next[n]);
        next[keepName] = Array.from(merged);
        persist(EX_META_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const renameExercise = useCallback(
    (oldName, newNameRaw) => {
      const newName = newNameRaw.trim();
      if (!newName || newName === oldName) return;

      const collision = exercises.find(
        (e) => e.toLowerCase() === newName.toLowerCase() && e !== oldName
      );
      if (collision) {
        // Un esercizio con quel nome esiste già: uniamo invece di duplicare
        mergeExercises([oldName, collision], collision);
        return;
      }

      setLogs((prev) => {
        const next = prev.map((l) => (l.exercise === oldName ? { ...l, exercise: newName } : l));
        persist(LOG_KEY, next);
        return next;
      });

      setSchede((prev) => {
        const next = prev.map((s) => ({
          ...s,
          items: s.items.map((it) => (it.exercise === oldName ? { ...it, exercise: newName } : it)),
        }));
        persist(SCHEDE_KEY, next);
        return next;
      });

      setExercises((prev) => {
        const next = prev.map((e) => (e === oldName ? newName : e));
        persist(EX_KEY, next);
        return next;
      });

      setExerciseMeta((prev) => {
        if (!prev[oldName]) return prev;
        const next = { ...prev };
        next[newName] = prev[oldName];
        delete next[oldName];
        persist(EX_META_KEY, next);
        return next;
      });
    },
    [exercises, persist, mergeExercises]
  );

  const saveScheda = useCallback(
    (scheda) => {
      setSchede((prev) => {
        const idx = prev.findIndex((s) => s.id === scheda.id);
        let next;
        if (idx === -1) next = [...prev, scheda];
        else {
          next = prev.slice();
          next[idx] = scheda;
        }
        persist(SCHEDE_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const deleteScheda = useCallback(
    (id) => {
      setSchede((prev) => {
        const next = prev.filter((s) => s.id !== id);
        persist(SCHEDE_KEY, next);
        return next;
      });
    },
    [persist]
  );

  return (
    <div className="ghisa-root" data-theme={theme}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

        .ghisa-root {
          --bg: #16181c;
          --surface: #1e2126;
          --surface-2: #262a31;
          --ink: #f1ede4;
          --ink-dim: #9ba1ab;
          --accent: #c1502e;
          --accent-dim: rgba(193, 80, 46, 0.16);
          --line: #33383f;
          --success: #8fb996;
          --steel: #7c8b99;
          background: var(--bg);
          color: var(--ink);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          width: 100%;
          overflow: hidden;
          box-sizing: border-box;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .ghisa-root[data-theme="light"] {
          --bg: #eee9dc;
          --surface: #fbfaf6;
          --surface-2: #e9e3d3;
          --ink: #211f1a;
          --ink-dim: #6b6a63;
          --accent-dim: rgba(193, 80, 46, 0.12);
          --line: #d8d1bd;
          --success: #3f7a4c;
          --steel: #5c6773;
        }
        .ghisa-root * { box-sizing: border-box; min-width: 0; transition: background 0.2s ease, border-color 0.2s ease; }

        input[type="date"], input[type="number"], input[type="text"], textarea {
          width: 100%;
          max-width: 100%;
          -webkit-appearance: none;
          appearance: none;
        }
        input[type="date"] {
          font-family: 'Inter', sans-serif;
          color-scheme: dark;
        }
        .ghisa-root[data-theme="light"] input[type="date"] { color-scheme: light; }
        body {
          background: #0b0c0e;
          margin: 0;
        }
        @media (min-width: 640px) {
          .ghisa-root {
            max-width: 520px;
            margin: 32px auto;
            min-height: calc(100vh - 64px);
            border-radius: 20px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
          }
        }
        @media (min-width: 1024px) {
          .ghisa-root {
            max-width: 820px;
          }
          .g-sets-reps-row { gap: 60px; }
          .g-stat-grid { gap: 16px; }
        }
        .ghisa-display { font-family: 'Oswald', sans-serif; }
        .ghisa-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }

        .g-header {
          border-bottom: 1px solid var(--line);
          padding: 20px 20px 0 20px;
        }
        .g-title {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--ink);
          display: flex;
          align-items: center;
          gap: 10px;
          font-style: italic;
          transform: skewX(-4deg);
        }
        .g-title > svg { transform: skewX(4deg); }
        .g-subtitle {
          color: var(--ink-dim);
          font-size: 12.5px;
          margin-top: 2px;
          margin-bottom: 14px;
        }
        .g-tabs { display: flex; gap: 14px; }
        .g-tab {
          background: none;
          border: none;
          color: var(--ink-dim);
          font-family: 'Oswald', sans-serif;
          font-size: 12.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 10px 2px 12px 2px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }
        .g-tab.active { color: var(--ink); border-bottom-color: var(--accent); }
        .g-tab:hover { color: var(--ink); }

        .g-body { padding: 20px; }

        .g-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 18px;
        }

        .g-chip {
          background: var(--surface-2);
          border: 1px solid var(--line);
          color: var(--ink-dim);
          font-size: 13px;
          padding: 7px 14px;
          border-radius: 999px;
          cursor: pointer;
          white-space: nowrap;
          font-weight: 500;
        }
        .g-chip.active {
          background: var(--accent-dim);
          border-color: var(--accent);
          color: var(--ink);
        }

        .g-empty {
          text-align: center;
          padding: 46px 20px;
          color: var(--ink-dim);
        }
        .g-empty-cta {
          margin-top: 14px;
          background: var(--accent);
          color: #fff;
          border: none;
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
        }

        .g-draft-banner {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--accent-dim); border: 1px solid var(--accent);
          border-radius: 10px; padding: 9px 12px; margin-bottom: 12px;
          font-size: 12.5px; color: var(--ink);
        }
        .g-draft-banner .g-del-btn {
          color: var(--accent); font-weight: 600; font-size: 12px; background: none; border: none; cursor: pointer;
        }

        .g-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
        .g-stat-box { background: var(--surface-2); border-radius: 10px; padding: 12px; text-align: center; }
        .g-stat-num { font-size: 22px; font-weight: 700; }
        .g-stat-label { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }

        .g-pr-badge {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(143,185,150,0.15); color: var(--success);
          font-size: 11px; padding: 3px 9px; border-radius: 999px; font-weight: 600;
        }

        .plate-btn {
          width: 56px; height: 56px; border-radius: 50%;
          border: 3px solid var(--accent);
          background: var(--surface-2);
          color: var(--accent);
          font-size: 24px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow: 0 0 0 3px var(--bg), 0 0 0 4px var(--line);
          flex-shrink: 0;
          touch-action: manipulation;
        }
        .plate-btn:active { transform: scale(0.94); }

        .g-weight-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }
        .g-weight-mid { min-width: 110px; max-width: 140px; text-align: center; flex: 1; }

        .weight-readout {
          font-family: 'JetBrains Mono', monospace;
          font-size: 40px;
          font-weight: 700;
          text-align: center;
          background: transparent;
          border: none;
          color: var(--ink);
          width: 100%;
          outline: none;
          -moz-appearance: textfield;
        }
        .weight-readout::-webkit-outer-spin-button,
        .weight-readout::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .weight-unit { color: var(--ink-dim); font-size: 15px; font-family: 'Oswald', sans-serif; letter-spacing: 0.05em; }

        @media (max-width: 359px) {
          .plate-btn { width: 48px; height: 48px; font-size: 20px; }
          .weight-readout { font-size: 32px; }
          .g-weight-row { gap: 10px; }
          .g-body { padding: 16px; }
          .g-title { font-size: 22px; }
        }

        .g-counter-btn, .g-del-btn, .g-chip, .g-step-pill {
          touch-action: manipulation;
        }
        .g-counter-btn {
          min-width: 38px; min-height: 38px;
        }

        .g-step-row { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
        .g-step-pill {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          padding: 5px 10px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--ink-dim);
          cursor: pointer;
        }
        .g-step-pill.active { border-color: var(--accent); color: var(--ink); background: var(--accent-dim); }

        .g-field-label {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em;
          color: var(--ink-dim); margin-bottom: 6px; display: block;
        }
        .g-input {
          width: 100%; background: var(--surface-2); border: 1px solid var(--line);
          color: var(--ink); border-radius: 10px; padding: 10px 12px; font-size: 14px;
          outline: none; font-family: 'Inter', sans-serif;
        }
        .g-input:focus { border-color: var(--accent); }

        .g-select {
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239ba1ab' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 34px;
          cursor: pointer;
        }

        .g-counter { display: flex; align-items: center; gap: 10px; }
        .g-counter-btn {
          width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--line);
          background: var(--surface-2); color: var(--ink); font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .g-counter-num { font-family: 'JetBrains Mono', monospace; font-size: 17px; width: 30px; text-align: center; }

        .g-submit {
          width: 100%; background: var(--accent); color: #fff; border: none;
          padding: 13px; border-radius: 10px; font-weight: 700; font-size: 14px;
          letter-spacing: 0.03em; text-transform: uppercase; cursor: pointer; margin-top: 4px;
        }
        .g-submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .g-submit-secondary {
          background: var(--surface-2); color: var(--ink); border: 1px solid var(--line);
        }

        .g-timer-box {
          margin-top: 16px; background: var(--surface-2); border: 1px solid var(--line);
          border-radius: 12px; padding: 14px; text-align: center;
        }
        .g-timer-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-dim); margin-bottom: 4px; }
        .g-timer-display { font-size: 32px; font-weight: 700; margin-bottom: 10px; }

        .g-history-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 4px; border-bottom: 1px solid var(--line);
        }
        .g-history-row:last-child { border-bottom: none; }
        .g-history-date {
          font-family: 'Oswald', sans-serif; font-size: 11px; color: var(--ink-dim);
          text-transform: uppercase; width: 46px; flex-shrink: 0;
        }
        .g-history-main { flex: 1; padding: 0 10px; }
        .g-history-ex { font-weight: 600; font-size: 14px; }
        .g-history-sets { font-size: 12px; color: var(--ink-dim); font-family: 'JetBrains Mono', monospace; }
        .g-del-btn { background: none; border: none; color: var(--ink-dim); cursor: pointer; padding: 6px; }
        .g-del-btn:hover { color: var(--accent); }

        .g-error-banner {
          background: rgba(193,80,46,0.15); border: 1px solid var(--accent);
          color: var(--ink); font-size: 12.5px; padding: 8px 12px; border-radius: 8px; margin-bottom: 14px;
        }

        datalist { display: none; }

        .g-autocomplete-wrap { position: relative; }
        .g-autocomplete-list {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
          background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px;
          max-height: 220px; overflow-y: auto; box-shadow: 0 10px 24px rgba(0,0,0,0.4);
        }
        .g-autocomplete-item {
          padding: 10px 12px; font-size: 13.5px; cursor: pointer; border-bottom: 1px solid var(--line);
        }
        .g-autocomplete-item:last-child { border-bottom: none; }
        .g-autocomplete-item:hover { background: var(--accent-dim); }
        .g-autocomplete-new { color: var(--accent); font-weight: 600; }

        .g-locked-field {
          width: 100%; background: var(--surface); border: 1px solid var(--line);
          color: var(--ink); border-radius: 10px; padding: 10px 12px; font-size: 14px;
          display: flex; align-items: center; gap: 8px;
        }

        .g-sets-reps-row {
          display: flex; justify-content: center; gap: 32px; margin-top: 22px;
        }
        .g-sets-reps-col { display: flex; flex-direction: column; align-items: center; }

        .g-session-name { font-weight: 600; font-size: 14px; }
        .g-note-dot { color: var(--accent); font-size: 8px; margin-left: 6px; vertical-align: middle; }
        .g-edit-row { background: var(--surface-2); border-radius: 10px; padding: 12px; margin-bottom: 8px; }

        .g-admin-subtabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .g-admin-subtab {
          flex: 1; text-align: center; padding: 9px; border-radius: 10px;
          border: 1px solid var(--line); background: var(--surface-2);
          color: var(--ink-dim); font-size: 12.5px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer;
        }
        .g-admin-subtab.active { border-color: var(--accent); color: var(--ink); background: var(--accent-dim); }

        .g-pin-dots { display: flex; gap: 14px; justify-content: center; margin: 18px 0; }
        .g-pin-dot {
          width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--line);
        }
        .g-pin-dot.filled { background: var(--accent); border-color: var(--accent); }
        .g-pin-keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 240px; margin: 0 auto; }
        .g-pin-key {
          background: var(--surface-2); border: 1px solid var(--line); color: var(--ink);
          border-radius: 10px; padding: 14px 0; font-size: 18px; font-family: 'JetBrains Mono', monospace;
          cursor: pointer; touch-action: manipulation;
        }
        .g-pin-key:active { transform: scale(0.95); }
        .g-pin-error { color: var(--accent); font-size: 12.5px; text-align: center; margin-top: 10px; }

        .g-reg-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 4px; border-bottom: 1px solid var(--line);
        }
        .g-reg-row:last-child { border-bottom: none; }
        .g-reg-name { font-size: 14px; font-weight: 500; }
        .g-reg-count { font-size: 11px; color: var(--ink-dim); margin-top: 1px; }
        .g-bodyparts-panel {
          display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start;
          padding: 10px 4px 14px 4px;
          border-bottom: 1px solid var(--line);
        }

        .g-scheda-row {
          padding: 12px 4px; border-bottom: 1px solid var(--line);
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .g-scheda-row:last-child { border-bottom: none; }
        .g-scheda-item-view {
          padding: 8px 4px; margin-left: 4px; border-left: 2px solid var(--line); padding-left: 12px; margin-bottom: 6px;
          font-size: 13px;
        }
        .g-part-badge {
          background: var(--accent-dim); color: var(--accent); font-size: 10.5px;
          padding: 2px 8px; border-radius: 999px; font-weight: 600;
        }
        .g-diagram-label {
          font-size: 10px; color: var(--ink-dim); margin-top: 4px;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .g-scheda-name { font-weight: 600; font-size: 14.5px; }
        .g-scheda-meta { font-size: 11.5px; color: var(--ink-dim); margin-top: 2px; }
        .g-icon-btn {
          background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-dim);
          border-radius: 8px; padding: 7px; cursor: pointer; display: flex; align-items: center;
        }
        .g-icon-btn:hover { color: var(--ink); }
        .g-icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .g-draft-item {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--surface-2); border-radius: 8px; padding: 8px 10px; margin-bottom: 6px;
          font-size: 13px;
        }
        .g-draft-item-active { border: 1px solid var(--accent); }
        .g-order-btn {
          background: none; border: none; color: var(--ink-dim); font-size: 9px; cursor: pointer;
          padding: 1px 4px; line-height: 1;
        }
        .g-order-btn:hover { color: var(--ink); }
        .g-order-btn:disabled { opacity: 0.25; cursor: not-allowed; }
        .g-inline-row { display: flex; gap: 8px; align-items: flex-end; margin-top: 10px; }
        .g-inline-row .g-field-label { margin-bottom: 4px; }
        .g-num-small { width: 100%; }
        .g-checkbox-row {
          display: flex; align-items: center; gap: 8px; margin-top: 12px;
          font-size: 12.5px; color: var(--ink-dim); cursor: pointer;
        }
        .g-checkbox-row input { width: 16px; height: 16px; accent-color: var(--accent); flex-shrink: 0; }

        .g-info-btn {
          position: absolute; top: 20px; right: 20px;
          background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-dim);
          border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center;
          justify-content: center; cursor: pointer;
        }
        .g-info-btn:hover { color: var(--ink); }

        .g-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100;
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .g-modal {
          background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
          padding: 22px; max-width: 380px; width: 100%; max-height: 80vh; overflow-y: auto;
        }
      `}</style>

      <div className="g-header" style={{ position: "relative", paddingRight: 96 }}>
        <button
          className="g-info-btn"
          style={{ right: 56 }}
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          aria-label="Cambia tema"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          className="g-info-btn"
          onClick={() => setInfoOpen(true)}
          aria-label="Informazioni"
        >
          <Info size={18} />
        </button>
        <div className="g-title ghisa-display">
          <Dumbbell size={24} color="var(--accent)" />
          GHISA
        </div>
        <div className="g-subtitle">Scheda e progressi di ghisa</div>
        <div className="g-tabs">
          <button
            className={`g-tab ${view === "stats" ? "active" : ""}`}
            onClick={() => setView("stats")}
          >
            <BarChart3 size={14} /> Statistiche
          </button>
          <button
            className={`g-tab ${view === "log" ? "active" : ""}`}
            onClick={() => setView("log")}
          >
            <ListChecks size={14} /> Allenamento
          </button>
          <button
            className={`g-tab ${view === "schede" ? "active" : ""}`}
            onClick={() => setView("schede")}
          >
            <BarChart3 size={14} style={{ transform: "rotate(90deg)" }} /> Schede
          </button>
          {!authUser ? (
            <button
              className={`g-tab ${view === "admin" ? "active" : ""}`}
              onClick={() => setView("admin")}
            >
              <LogIn size={14} /> Login
            </button>
          ) : isAdmin ? (
            <button
              className={`g-tab ${view === "admin" ? "active" : ""}`}
              onClick={() => setView("admin")}
            >
              <Unlock size={14} /> Admin
            </button>
          ) : null}
        </div>
      </div>

      <div className="g-body">
        {saveError && (
          <div className="g-error-banner">
            Non riesco a salvare i dati in questo momento. Continua pure, riprovo automaticamente al prossimo salvataggio.
          </div>
        )}
        {loading ? (
          <div className="g-empty">Caricamento...</div>
        ) : view === "stats" ? (
          <StatsPage exercises={exercises} logs={logs} goToLog={() => setView("log")} />
        ) : view === "log" ? (
          <LogPage
            exercises={exercises}
            exerciseMeta={exerciseMeta}
            logs={logs}
            schede={schede}
            onAddBatch={addLogsBatch}
            onDelete={deleteLog}
            onDeleteBatch={deleteLogsBatch}
            onUpdate={updateLog}
            draft={draftSession}
            onSaveDraft={saveDraft}
          />
        ) : view === "schede" ? (
          <SchedeManager
            exercises={exercises}
            exerciseMeta={exerciseMeta}
            schede={schede}
            onAddExercise={addExerciseToRegistry}
            onSaveScheda={saveScheda}
            onDeleteScheda={deleteScheda}
          />
        ) : (
          <AdminPage
            exercises={exercises}
            exerciseMeta={exerciseMeta}
            logs={logs}
            authUser={authUser}
            isAdmin={isAdmin}
            authLoading={authLoading}
            onSignIn={signIn}
            onSignOut={signOutUser}
            onAddExercise={addExerciseToRegistry}
            onRemoveExercise={removeExerciseFromRegistry}
            onMergeExercises={mergeExercises}
            onRenameExercise={renameExercise}
            onSetBodyParts={setExerciseBodyParts}
          />
        )}
      </div>

      {infoOpen && <InfoModal isAdmin={isAdmin} onClose={() => setInfoOpen(false)} />}
    </div>
  );
}

function InfoModal({ isAdmin, onClose }) {
  return (
    <div className="g-modal-overlay" onClick={onClose}>
      <div className="g-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="g-title ghisa-display" style={{ fontSize: 20 }}>
            <Dumbbell size={20} color="var(--accent)" /> GHISA
          </div>
          <button className="g-icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.6, marginTop: 12 }}>
          GHISA è la tua scheda di allenamento: crea le tue schede, registra gli allenamenti
          (con serie, ripetizioni, carico e back-off), e tieni traccia dei progressi nel tempo
          con statistiche dedicate. Pensata per essere usata comodamente dal telefono, in
          palestra.
        </p>

        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 14 }}>
          Ideata da <span style={{ color: "var(--ink)", fontWeight: 600 }}>Stefano</span>.
        </p>

        {isAdmin && PAYPAL_LINK && (
          <a
            href={PAYPAL_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="g-empty-cta"
            style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 16 }}
          >
            Offrimi un caffè su PayPal
          </a>
        )}
      </div>
    </div>
  );
}

function StatsPage({ exercises, logs, goToLog }) {
  const exWithLogs = useMemo(
    () => exercises.filter((e) => logs.some((l) => l.exercise === e)),
    [exercises, logs]
  );
  const [selected, setSelected] = useState(exWithLogs[0] || "");

  useEffect(() => {
    if (!selected && exWithLogs.length) setSelected(exWithLogs[0]);
    if (selected && !exWithLogs.includes(selected) && exWithLogs.length) {
      setSelected(exWithLogs[0]);
    }
  }, [exWithLogs, selected]);

  if (exWithLogs.length === 0) {
    return (
      <div className="g-card g-empty">
        <TrendingUp size={30} color="var(--ink-dim)" style={{ margin: "0 auto 10px" }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
          Ancora nessun dato registrato
        </div>
        <div style={{ marginTop: 4, fontSize: 13 }}>
          Vai su Scheda e registra il tuo primo allenamento per vedere i progressi qui.
        </div>
        <button className="g-empty-cta" onClick={goToLog}>Vai ad Allenamento</button>
      </div>
    );
  }

  const exLogs = logs
    .filter((l) => l.exercise === selected && !l.backoff)
    .slice()
    .sort((a, b) => (a.date + a.id > b.date + b.id ? 1 : -1));

  const backoffLogs = logs
    .filter((l) => l.exercise === selected && l.backoff)
    .slice()
    .sort((a, b) => (a.date + a.id > b.date + b.id ? 1 : -1));

  const hasBackoff = backoffLogs.length > 0;

  const topByDate = {};
  exLogs.forEach((l) => { topByDate[l.date] = l.weight; });
  const backoffByDate = {};
  backoffLogs.forEach((l) => { backoffByDate[l.date] = l.weight; });

  const allDates = Array.from(new Set([...exLogs.map((l) => l.date), ...backoffLogs.map((l) => l.date)])).sort();

  const chartData = allDates.map((date) => ({
    date,
    label: formatDate(date),
    peso: topByDate[date] ?? null,
    pesoBackoff: backoffByDate[date] ?? null,
  }));

  const current = exLogs[exLogs.length - 1]?.weight ?? 0;
  const record = Math.max(...exLogs.map((l) => l.weight));
  const first = exLogs[0]?.weight ?? 0;
  const delta = current - first;
  const isPR = current === record;

  const recentHistory = logs
    .filter((l) => l.exercise === selected)
    .slice()
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .slice(0, 5);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {exWithLogs.map((e) => (
          <button
            key={e}
            className={`g-chip ${selected === e ? "active" : ""}`}
            onClick={() => setSelected(e)}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="g-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="g-field-label" style={{ marginBottom: 2 }}>{selected}</div>
            <div className="ghisa-mono" style={{ fontSize: 34, fontWeight: 700 }}>
              {current}
              <span style={{ fontSize: 14, color: "var(--ink-dim)", marginLeft: 4 }}>kg</span>
            </div>
          </div>
          {isPR && (
            <span className="g-pr-badge">
              <Flame size={12} /> Record personale
            </span>
          )}
        </div>

        {hasBackoff && (
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-dim)" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
              Top set
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-dim)" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--steel)", display: "inline-block" }} />
              Back-off
            </div>
          </div>
        )}

        <div style={{ width: "100%", height: 180, marginTop: 14 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#33383f" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#9ba1ab"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#33383f" }}
              />
              <YAxis
                stroke="#9ba1ab"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 5", "dataMax + 5"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e2126",
                  border: "1px solid #33383f",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#9ba1ab" }}
                formatter={(v, name) => [`${v} kg`, name === "pesoBackoff" ? "Back-off" : "Top set"]}
              />
              <Line
                type="monotone"
                dataKey="peso"
                stroke="#c1502e"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#c1502e", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
              {hasBackoff && (
                <Line
                  type="monotone"
                  dataKey="pesoBackoff"
                  stroke="#7c8b99"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 3, fill: "#7c8b99", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="g-stat-grid">
          <div className="g-stat-box">
            <div className="g-stat-num ghisa-mono">{record}</div>
            <div className="g-stat-label">Record kg</div>
          </div>
          <div className="g-stat-box">
            <div className="g-stat-num ghisa-mono" style={{ color: delta >= 0 ? "var(--success)" : "var(--accent)" }}>
              {delta >= 0 ? "+" : ""}{delta}
            </div>
            <div className="g-stat-label">Da inizio</div>
          </div>
          <div className="g-stat-box">
            <div className="g-stat-num ghisa-mono">{exLogs.length}</div>
            <div className="g-stat-label">Sessioni</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="g-field-label">Ultimi allenamenti — {selected}</div>
        <div className="g-card" style={{ padding: "4px 14px" }}>
          {recentHistory.map((l) => (
            <div className="g-history-row" key={l.id}>
              <div className="g-history-date">{formatDate(l.date)}</div>
              <div className="g-history-main">
                <div className="g-history-sets">
                  {l.sets} x {l.reps} @ {l.weight} kg
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminPage({
  exercises,
  exerciseMeta,
  logs,
  authUser,
  isAdmin,
  authLoading,
  onSignIn,
  onSignOut,
  onAddExercise,
  onRemoveExercise,
  onMergeExercises,
  onRenameExercise,
  onSetBodyParts,
}) {
  if (authLoading) {
    return <div className="g-card g-empty">Verifica accesso...</div>;
  }

  if (!authUser) {
    return (
      <div className="g-card" style={{ textAlign: "center", padding: "34px 20px" }}>
        <Lock size={26} color="var(--ink-dim)" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 600, fontSize: 15 }}>Accesso riservato</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 4, marginBottom: 16 }}>
          Accedi con Google per gestire l'anagrafica esercizi.
        </div>
        <button className="g-empty-cta" onClick={onSignIn}>Accedi con Google</button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="g-card" style={{ textAlign: "center", padding: "34px 20px" }}>
        <Lock size={26} color="var(--accent)" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 600, fontSize: 15 }}>Non sei autorizzato</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 4, marginBottom: 16 }}>
          Hai fatto accesso come {authUser.email}, ma questo non è l'account admin.
        </div>
        <button className="g-icon-btn" onClick={onSignOut}>Esci e cambia account</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="g-field-label" style={{ marginBottom: 0 }}>Anagrafica esercizi</div>
        <button className="g-icon-btn" onClick={onSignOut} style={{ fontSize: 12, gap: 5 }}>
          <Unlock size={13} /> Esci
        </button>
      </div>
      <ExerciseRegistry
        exercises={exercises}
        exerciseMeta={exerciseMeta}
        logs={logs}
        onAdd={onAddExercise}
        onRemove={onRemoveExercise}
        onMerge={onMergeExercises}
        onRename={onRenameExercise}
        onSetBodyParts={onSetBodyParts}
      />
    </div>
  );
}

function ExerciseRegistry({ exercises, exerciseMeta, logs, onAdd, onRemove, onMerge, onRename, onSetBodyParts }) {
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

function SchedeManager({ exercises, exerciseMeta, schede, onAddExercise, onSaveScheda, onDeleteScheda }) {
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

function LogPage({ exercises, exerciseMeta, logs, schede, onAddBatch, onDelete, onDeleteBatch, onUpdate, draft, onSaveDraft }) {
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
  }, [dayId, stepIdx, selectedScheda]);

  useEffect(() => {
    const relevant = logs
      .filter((l) => l.exercise === exerciseInput && !l.backoff)
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    if (relevant.length) setWeight(relevant[0].weight);
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
