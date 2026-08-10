import { useState, useEffect, useCallback, useRef } from "react";
import { Dumbbell, ListChecks, BarChart3, Unlock, Info, Sun, Moon, LogIn } from "lucide-react";

import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { ADMIN_EMAIL } from "./config";

import InfoModal from "./components/InfoModal";
import StatsPage from "./components/StatsPage";
import LogPage from "./components/LogPage";
import SchedeManager from "./components/SchedeManager";
import AdminPage from "./components/AdminPage";

const EX_KEY = "ghisa-exercises";
const LOG_KEY = "ghisa-logs";
const SCHEDE_KEY = "ghisa-schede";
const EX_META_KEY = "ghisa-exercise-meta";
const DRAFT_KEY = "ghisa-draft-session";

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

