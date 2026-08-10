import { useState, useEffect, useCallback, useRef } from "react";
import { Dumbbell, ListChecks, BarChart3, Unlock, Info, Sun, Moon, LogIn, User } from "lucide-react";

import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot, collection, addDoc, deleteDoc, query, where } from "firebase/firestore";
import { ADMIN_EMAIL } from "./config";
import { uid, confirmThen } from "./lib/utils";

import InfoModal from "./components/InfoModal";
import AccountModal from "./components/AccountModal";
import StatsPage from "./components/StatsPage";
import LogPage from "./components/LogPage";
import SchedeManager from "./components/SchedeManager";
import AdminPage from "./components/AdminPage";

const EX_KEY = "ghisa-exercises";
const LOG_KEY = "ghisa-logs";
const SCHEDE_KEY = "ghisa-schede";
const EX_META_KEY = "ghisa-exercise-meta";
const DRAFT_KEY = "ghisa-draft-session";
const ACTIVE_KEY = "ghisa-active-scheda";

export default function App() {
  const [view, setView] = useState("stats"); // 'stats' | 'log' | 'admin'
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState([]);
  const [schede, setSchede] = useState([]);
  const [exerciseMeta, setExerciseMeta] = useState({});
  const [draftSession, setDraftSession] = useState(null);
  const [activeSchedaId, setActiveSchedaId] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
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

  const isAdmin = !!authUser && authUser.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
  const [isPT, setIsPT] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const isStaff = isAdmin || isPT;

  useEffect(() => {
    if (view === "admin" && authUser && !isStaff) setView("stats");
  }, [view, authUser, isStaff]);

  // Registra/aggiorna il proprio profilo nella directory utenti (email, nome,
  // ultimo accesso) e resta in ascolto del proprio ruolo (l'admin può
  // assegnare/togliere Personal Trainer dalla pagina Utenti).
  useEffect(() => {
    if (!authUser) {
      setIsPT(false);
      return;
    }
    const ref = doc(db, "directory", authUser.uid);
    setDoc(
      ref,
      {
        email: authUser.email,
        displayName: authUser.displayName || "",
        lastSeen: Date.now(),
      },
      { merge: true }
    ).catch((e) => console.error(e));
    const unsub = onSnapshot(
      ref,
      (snap) => setIsPT(!!(snap.exists() && snap.data().isPT)),
      (e) => console.error(e)
    );
    return unsub;
  }, [authUser]);

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
    let active = null;
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
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      if (raw) active = JSON.parse(raw);
    } catch (e) {
      /* nessun dato salvato ancora */
    }
    setExercises(ex);
    setLogs(lg);
    setSchede(sc);
    setExerciseMeta(meta);
    setDraftSession(draft);
    setActiveSchedaId(active);
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
          if (data.activeSchedaId !== undefined) {
            setActiveSchedaId(data.activeSchedaId);
            try {
              localStorage.setItem(ACTIVE_KEY, JSON.stringify(data.activeSchedaId));
            } catch (e) {}
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
          const isThisAdmin = authUser.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
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

  // Schede assegnate a me da admin o personal trainer
  useEffect(() => {
    if (!authUser) {
      setAssignments([]);
      return;
    }
    const q = query(collection(db, "assignments"), where("toUid", "==", authUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
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
        // Anagrafica condivisa: unica per tutti. Chiunque sia autenticato può
        // aggiungere esercizi (anche creando una scheda), così l'elenco resta
        // lo stesso per admin, personal trainer e utenti normali.
        if (!authUser) return;
        const field = key === EX_KEY ? "exercises" : "exerciseMeta";
        setDoc(doc(db, "shared", "registry"), { [field]: value }, { merge: true }).catch((e) =>
          console.error(e)
        );
        return;
      }

      if (authUser) {
        const field =
          key === LOG_KEY ? "logs" :
          key === SCHEDE_KEY ? "schede" :
          key === DRAFT_KEY ? "draftSession" :
          key === ACTIVE_KEY ? "activeSchedaId" : null;
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

  // Dopo una pulizia del database, azzera anche la copia locale su questo
  // dispositivo: altrimenti la cache continuerebbe a mostrare i dati vecchi.
  const wipeLocal = useCallback((targets) => {
    const clear = (key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        /* ignora */
      }
    };
    if (targets.includes("esercizi")) {
      setExercises([]);
      setExerciseMeta({});
      clear(EX_KEY);
      clear(EX_META_KEY);
    }
    if (targets.includes("allenamenti")) {
      setLogs([]);
      setDraftSession(null);
      clear(LOG_KEY);
      clear(DRAFT_KEY);
    }
    if (targets.includes("schede")) {
      setSchede([]);
      clear(SCHEDE_KEY);
    }
  }, []);

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

  // Accetta una scheda assegnata: entra tra le mie e diventa modificabile da me
  const acceptAssignment = useCallback(
    (a) => {
      // La scheda assegnata diventa una mia copia, con giorni e id nuovi
      const src = a.scheda || {};
      const nuova = {
        id: uid(),
        name: src.name || "Scheda assegnata",
        days: (Array.isArray(src.days) && src.days.length
          ? src.days
          : [{ id: uid(), name: src.name || "Giorno 1", items: src.items || [] }]
        ).map((d) => ({ ...d, id: uid() })),
      };
      setSchede((prev) => {
        const next = [...prev, nuova];
        persist(SCHEDE_KEY, next);
        return next;
      });
      deleteDoc(doc(db, "assignments", a.id)).catch((e) => console.error(e));
    },
    [persist]
  );

  const rejectAssignment = useCallback((a) => {
    confirmThen(`Rifiutare la scheda "${a.scheda?.name}"?`, () => {
      deleteDoc(doc(db, "assignments", a.id)).catch((e) => console.error(e));
    });
  }, []);

  const setActiveScheda = useCallback(
    (id) => {
      setActiveSchedaId(id);
      persist(ACTIVE_KEY, id);
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
      if (activeSchedaId === id) {
        setActiveSchedaId(null);
        persist(ACTIVE_KEY, null);
      }
    },
    [persist, activeSchedaId]
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
        input[type="number"] { -moz-appearance: textfield; }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
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
            max-width: 980px;
          }
          .g-sets-reps-row { gap: 60px; }
          .g-stat-grid { gap: 16px; }
          .g-tab { font-size: 13.5px; padding: 13px 8px 14px 8px; }
        }
        @media (min-width: 1400px) {
          .ghisa-root { max-width: 1160px; }
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
        .g-tabs { display: flex; gap: 6px; width: 100%; }
        .g-tab {
          flex: 1 1 0;
          min-width: 0;
          background: none;
          border: none;
          color: var(--ink-dim);
          font-family: 'Oswald', sans-serif;
          font-size: 10.5px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          padding: 8px 2px 9px 2px;
          cursor: pointer;
          border-bottom: 2px solid var(--line);
          /* Su telefono icona sopra e testo sotto: quattro voci ci stanno
             senza tagliare le parole. */
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          touch-action: manipulation;
        }
        .g-tab svg { flex-shrink: 0; }
        .g-tab > span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }

        /* Da tablet in su torna comodo affiancare icona e testo */
        @media (min-width: 620px) {
          .g-tabs { gap: 10px; }
          .g-tab {
            flex-direction: row;
            justify-content: center;
            font-size: 12.5px;
            padding: 11px 6px 12px 6px;
            gap: 6px;
          }
        }
        .g-tab.active {
          color: var(--ink);
          border-bottom-color: var(--accent);
          background: linear-gradient(to bottom, transparent 55%, var(--accent-dim));
        }
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
          .g-tab { font-size: 9.5px; padding: 7px 1px 8px 1px; }
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
        .g-danger-banner {
          display: flex; align-items: flex-start; gap: 8px;
          background: rgba(193,80,46,0.12); border: 1px solid var(--accent);
          border-radius: 10px; padding: 10px 12px; margin-bottom: 14px;
          font-size: 12.5px; color: var(--ink); line-height: 1.45;
        }
        .g-danger-banner svg { flex-shrink: 0; margin-top: 1px; color: var(--accent); }

        .g-ex-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }

        .g-tag {
          display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
          font-weight: 600; padding: 2px 7px; border-radius: 5px; margin-right: 5px;
          background: var(--surface-2); color: var(--ink-dim); border: 1px solid var(--line);
          white-space: nowrap; line-height: 1.25;
        }
        .g-tag-warm { background: rgba(214,158,46,0.16); color: #d69e2e; border-color: rgba(214,158,46,0.4); }
        .g-tag-link { background: rgba(124,139,153,0.18); color: var(--steel); border-color: var(--steel); }
        .g-ex-note {
          margin-top: 10px; padding: 8px 10px; border-radius: 8px;
          background: var(--surface-2); border-left: 3px solid var(--accent);
          font-size: 12.5px; color: var(--ink); line-height: 1.4; font-style: italic;
        }
        .g-ex-note-link { border-left-color: var(--steel); font-style: normal; font-weight: 600; }
        .g-tag-target {
          background: var(--accent-dim); color: var(--accent); border-color: var(--accent);
          font-size: 13px; padding: 4px 11px; border-radius: 7px;
          font-family: 'JetBrains Mono', monospace; letter-spacing: 0;
          text-transform: none; line-height: 1.25;
        }
        .g-ex-tags { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
        .g-ex-tags .g-tag { margin-right: 0; }

        .g-seg { display: flex; gap: 6px; }
        .g-seg-btn {
          flex: 1; padding: 9px 4px; border-radius: 9px; border: 1px solid var(--line);
          background: var(--surface-2); color: var(--ink-dim); font-size: 12px; font-weight: 600;
          cursor: pointer; white-space: nowrap;
        }
        .g-seg-btn.active { border-color: var(--accent); color: var(--ink); background: var(--accent-dim); }

        .g-timer-tabs { display: flex; gap: 6px; justify-content: center; margin-bottom: 10px; }
        .g-ex-meta {
          font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--ink-dim); margin-bottom: 2px;
        }
        .g-ex-name {
          font-family: 'Oswald', sans-serif; font-size: 19px; font-weight: 600;
          letter-spacing: 0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .g-parts-link {
          background: none; border: none; padding: 0; cursor: pointer;
          color: var(--accent); font: inherit; letter-spacing: inherit; text-transform: inherit;
        }
        .g-sets-reps-col { display: flex; flex-direction: column; align-items: center; }
        .g-range-badge {
          margin-top: 6px; font-size: 10.5px; color: var(--steel);
          background: var(--surface-2); padding: 2px 8px; border-radius: 999px; font-weight: 600;
        }

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
        .g-menu {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 40;
          min-width: 178px; background: var(--surface-2); border: 1px solid var(--line);
          border-radius: 10px; padding: 5px; box-shadow: 0 12px 28px rgba(0,0,0,0.45);
        }
        .g-menu-item {
          display: flex; align-items: center; gap: 9px; width: 100%;
          background: none; border: none; color: var(--ink); cursor: pointer;
          padding: 9px 10px; border-radius: 7px; font-size: 13px; text-align: left;
        }
        .g-menu-item:hover { background: var(--accent-dim); }
        .g-menu-item svg { color: var(--ink-dim); flex-shrink: 0; }
        .g-menu-danger { color: var(--accent); }
        .g-menu-danger svg { color: var(--accent); }
        .g-menu-danger:hover { background: rgba(193,80,46,0.14); }

        .g-active-badge {
          display: inline-flex; align-items: center; gap: 3px; margin-left: 8px;
          background: rgba(143,185,150,0.16); color: var(--success);
          border: 1px solid rgba(143,185,150,0.45);
          font-size: 9.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 2px 7px; border-radius: 999px;
          vertical-align: middle;
        }
        .g-scheda-active { border-left: 3px solid var(--success); padding-left: 9px; margin-left: -12px; }

        .g-free-day-hint {
          margin-top: 10px; padding: 9px 11px; border-radius: 9px;
          background: var(--surface-2); border: 1px dashed var(--line);
          font-size: 12px; color: var(--ink-dim); line-height: 1.4;
        }

        .g-donate-box {
          margin-top: 20px; padding: 14px; border-radius: 12px;
          background: var(--surface-2); border: 1px solid var(--line);
        }
        .g-donate-box code {
          background: var(--surface); padding: 1px 5px; border-radius: 4px; font-size: 11px;
        }

        .g-rest-stepper {
          display: flex; align-items: center; gap: 6px;
        }
        .g-rest-value {
          flex: 1; text-align: center; font-size: 15px; font-weight: 700;
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 8px; padding: 7px 4px;
        }

        .g-day-row {
          display: flex; align-items: center; gap: 4px;
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: 10px; padding: 10px 12px; margin-bottom: 6px;
        }
        .g-day-ex-list {
          margin: 4px 0 0 0; padding-left: 16px; color: var(--ink-dim);
          font-size: 12px; line-height: 1.6;
        }
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
        .g-draft-item-moving { opacity: 0.55; border: 1px dashed var(--accent); }
        .g-move-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          background: var(--accent-dim); border: 1px solid var(--accent); border-radius: 8px;
          padding: 8px 10px; margin-bottom: 8px; font-size: 12px;
        }
        .g-move-bar .g-del-btn { color: var(--accent); font-weight: 600; font-size: 12px; padding: 2px 4px; }
        .g-move-slot {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; margin-bottom: 6px; padding: 7px;
          background: none; border: 1px dashed var(--accent); border-radius: 8px;
          color: var(--accent); font-size: 11.5px; font-weight: 600; cursor: pointer;
        }
        .g-move-slot:hover { background: var(--accent-dim); }

        .g-block-form {
          margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--line);
        }
        .g-part-card {
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: 10px; padding: 12px; margin-bottom: 8px;
        }
        .g-part-card .g-input { background: var(--surface); }

        .g-set-row {
          display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
        }
        .g-set-num {
          width: 26px; flex-shrink: 0; font-size: 12px; font-weight: 700;
          color: var(--ink-dim); font-family: 'Oswald', sans-serif;
        }
        .g-set-input {
          flex: 1; min-width: 0; text-align: center; padding: 8px 4px; font-size: 15px;
          -moz-appearance: textfield;
        }
        .g-set-input::-webkit-outer-spin-button,
        .g-set-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .g-set-unit {
          font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase;
          letter-spacing: 0.04em; width: 24px; flex-shrink: 0;
        }
        .g-set-row .g-del-btn { opacity: 0.5; }
        .g-set-row:hover .g-del-btn { opacity: 1; }
        .g-sets-wrap {
          margin-top: 18px; background: var(--surface-2); border: 1px solid var(--line);
          border-radius: 12px; padding: 12px;
        }
        .g-sets-wrap .g-input { background: var(--surface); }

        .g-toggle-row { display: flex; justify-content: center; margin-top: 16px; }
        .g-toggle-pill {
          border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-dim);
          border-radius: 999px; padding: 7px 16px; font-size: 12.5px; font-weight: 600;
          cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
          touch-action: manipulation;
        }
        .g-toggle-pill::before {
          content: ""; width: 8px; height: 8px; border-radius: 50%;
          background: var(--line); flex-shrink: 0;
        }
        .g-toggle-pill.active {
          border-color: var(--accent); background: var(--accent-dim); color: var(--accent);
        }
        .g-toggle-pill.active::before { background: var(--accent); }
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

      <div className="g-header" style={{ position: "relative", paddingRight: 132 }}>
        <button
          className="g-info-btn"
          style={{ right: 92 }}
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          aria-label="Cambia tema"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          className="g-info-btn"
          style={{ right: 56 }}
          onClick={() => setInfoOpen(true)}
          aria-label="Informazioni"
        >
          <Info size={18} />
        </button>
        <button
          className="g-info-btn"
          onClick={() => (authUser ? setAccountOpen(true) : signIn())}
          aria-label={authUser ? "Account" : "Accedi"}
        >
          {authUser ? <User size={17} /> : <LogIn size={17} />}
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
            <BarChart3 size={15} /> <span>Statistiche</span>
          </button>
          <button
            className={`g-tab ${view === "log" ? "active" : ""}`}
            onClick={() => setView("log")}
          >
            <ListChecks size={15} /> <span>Allenamento</span>
          </button>
          <button
            className={`g-tab ${view === "schede" ? "active" : ""}`}
            onClick={() => setView("schede")}
          >
            <BarChart3 size={15} style={{ transform: "rotate(90deg)" }} /> <span>Schede</span>
          </button>
          {isStaff && (
            <button
              className={`g-tab ${view === "admin" ? "active" : ""}`}
              onClick={() => setView("admin")}
            >
              <Unlock size={15} /> <span>Admin</span>
            </button>
          )}
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
          <StatsPage logs={logs} goToLog={() => setView("log")} />
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
            activeSchedaId={activeSchedaId}
          />
        ) : view === "schede" ? (
          <SchedeManager
            exercises={exercises}
            exerciseMeta={exerciseMeta}
            schede={schede}
            onAddExercise={addExerciseToRegistry}
            onSaveScheda={saveScheda}
            onDeleteScheda={deleteScheda}
            canAssign={isStaff}
            authUser={authUser}
            assignments={assignments}
            onAcceptAssignment={acceptAssignment}
            onRejectAssignment={rejectAssignment}
            activeSchedaId={activeSchedaId}
            onSetActive={setActiveScheda}
          />
        ) : (
          <AdminPage
            exercises={exercises}
            exerciseMeta={exerciseMeta}
            logs={logs}
            authUser={authUser}
            isAdmin={isAdmin}
            isPT={isPT}
            authLoading={authLoading}
            onSignIn={signIn}
            onSignOut={signOutUser}
            onAddExercise={addExerciseToRegistry}
            onRemoveExercise={removeExerciseFromRegistry}
            onMergeExercises={mergeExercises}
            onRenameExercise={renameExercise}
            onSetBodyParts={setExerciseBodyParts}
            onLocalWipe={wipeLocal}
          />
        )}
      </div>

      {infoOpen && <InfoModal isAdmin={isAdmin} onClose={() => setInfoOpen(false)} />}
      {accountOpen && (
        <AccountModal
          authUser={authUser}
          isAdmin={isAdmin}
          isPT={isPT}
          onSignOut={signOutUser}
          onClose={() => setAccountOpen(false)}
        />
      )}
    </div>
  );
}
