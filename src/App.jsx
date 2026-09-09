import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dumbbell, ListChecks, BarChart3, Unlock, Info, Sun, Moon, LogIn, User } from "lucide-react";

import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc, setDoc, updateDoc, onSnapshot, collection, deleteDoc, getDocs,
  query, where, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { ADMIN_EMAIL } from "./config";
import { uid, confirmThen, getDays, mapSchedaExercises, withSchedaHistory } from "./lib/utils";

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
const EX_GUIDE_KEY = "ghisa-exercise-guide";
const DRAFT_KEY = "ghisa-draft-session";
const ACTIVE_KEY = "ghisa-active-scheda";

export default function App() {
  const [view, setView] = useState("stats"); // 'stats' | 'log' | 'admin'
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState([]);
  const [schede, setSchede] = useState([]);
  const [exerciseMeta, setExerciseMeta] = useState({});
  // Collegamento (facoltativo) tra un esercizio e lo slug della guida esterna
  // scelto da un admin/PT: { [esercizio]: slug }
  const [exerciseGuide, setExerciseGuide] = useState({});
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
  const isStaff = isAdmin || isPT;

  useEffect(() => {
    if (view === "admin" && authUser && !isStaff) setView("stats");
  }, [view, authUser, isStaff]);

  // Conteggio totale degli allenamenti registrati per esercizio, su tutti gli
  // utenti: serve solo ad admin/PT nell'anagrafica esercizi. Letto una tantum
  // (non in tempo reale) quando si apre la sezione, per non pesare troppo su
  // Firestore: ogni utente conta come 1 lettura, indipendentemente da quanti
  // allenamenti ha registrato.
  const [totalLogCounts, setTotalLogCounts] = useState({});
  const [totalsLoading, setTotalsLoading] = useState(false);

  const fetchTotalLogCounts = useCallback(async () => {
    if (!isStaff) return;
    setTotalsLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const counts = {};
      snap.forEach((d) => {
        const userLogs = d.data()?.logs;
        if (!Array.isArray(userLogs)) return;
        userLogs.forEach((l) => {
          // Il back-off fa parte dello stesso allenamento del top set: contarlo
          // a parte lo conterebbe due volte per la stessa sessione. Le voci
          // cancellate (deletedAt) non vanno contate: non sono più un allenamento valido.
          if (!l?.exercise || l.backoff || l.deletedAt) return;
          counts[l.exercise] = (counts[l.exercise] || 0) + 1;
        });
      });
      setTotalLogCounts(counts);
    } catch (e) {
      console.error(e);
    } finally {
      setTotalsLoading(false);
    }
  }, [isStaff]);

  useEffect(() => {
    if (view === "admin" && isStaff) fetchTotalLogCounts();
  }, [view, isStaff]); // eslint-disable-line react-hooks/exhaustive-deps

  // Admin/PT possono guardare le statistiche di un altro utente, cercandolo
  // per nome/email: elenco utenti (solo mentre si è sulla tab Statistiche, per
  // non tenere un listener acceso inutilmente) e log dell'utente scelto.
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [viewingUid, setViewingUid] = useState(null);
  const [viewingLogs, setViewingLogs] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  // true = sono sul pulsante "Altro utente" (ricerca aperta o utente già
  // scelto); false = sto guardando i miei dati. Vive qui (non nei componenti
  // figli) perché è condiviso tra Statistiche e Allenamento.
  const [viewingOther, setViewingOther] = useState(false);

  // Il selettore "vedi di un altro utente" vale sia in Statistiche sia in
  // Allenamento (stesso utente scelto in entrambe): si azzera solo uscendo da
  // entrambe le tab, così cambiare tab non fa perdere la selezione.
  useEffect(() => {
    if (view !== "stats" && view !== "log") {
      setViewingUid(null);
      setViewingOther(false);
    }
  }, [view]);

  useEffect(() => {
    if (!isStaff || !authUser || (view !== "stats" && view !== "log")) {
      setStaffDirectory([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, "directory"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u) => u.uid !== authUser.uid)
          .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
        setStaffDirectory(list);
      },
      (e) => console.error(e)
    );
    return unsub;
  }, [isStaff, authUser, view]);

  useEffect(() => {
    if (!viewingUid) {
      setViewingLogs(null);
      return;
    }
    setViewingLoading(true);
    const unsub = onSnapshot(
      doc(db, "users", viewingUid),
      (snap) => {
        const data = snap.data();
        setViewingLogs(Array.isArray(data?.logs) ? data.logs : []);
        setViewingLoading(false);
      },
      (e) => {
        console.error(e);
        setViewingLogs([]);
        setViewingLoading(false);
      }
    );
    return unsub;
  }, [viewingUid]);

  const viewingUser = staffDirectory.find((u) => u.uid === viewingUid) || null;
  // Le voci cancellate (deletedAt) restano nel documento ma non vanno mai
  // mostrate in Allenamento/Statistiche: solo l'admin le vede, in Admin → Cancellati.
  const activeLogs = useMemo(() => logs.filter((l) => !l.deletedAt), [logs]);
  const viewingActiveLogs = useMemo(
    () => (viewingLogs || []).filter((l) => !l.deletedAt),
    [viewingLogs]
  );
  const statsLogs = viewingUid ? viewingActiveLogs : activeLogs;

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

  // Ultimo elenco di id confermati dal cloud per i log: serve a distinguere,
  // nel merge di protezione qui sotto, una voce mai ancora sincronizzata (da
  // salvare) da una voce che il cloud aveva già e ora non ha più perché è
  // stata davvero rimossa altrove (es. Admin → Cancellati → elimina per
  // sempre): quella non va resuscitata. Le schede non ne hanno più bisogno:
  // sono documenti scritti/letti direttamente, non un array da fondere.
  const lastServerLogIdsRef = useRef(null);

  // ⚠️ Cambio di account sullo stesso dispositivo (login, logout o switch a
  // un altro account Google): logs/schede/bozza/scheda-attiva sono privati
  // per utente e NON devono mai restare visibili dopo che l'account cambia.
  // Prima di questa protezione, lo stato in memoria e il localStorage
  // dell'account precedente restavano com'erano finché non arrivava lo
  // snapshot del nuovo account — nel frattempo si vedevano gli allenamenti
  // di un altro utente, e in certi casi potevano perfino essere rimandati
  // per errore dentro il documento del nuovo account. Ora si azzera tutto
  // SUBITO al cambio uid; l'unica eccezione è un ref "ponte" che porta
  // avanti i dati locali solo per il primo login dell'admin su un
  // dispositivo con dati offline da migrare (comportamento già esistente).
  const preLoginSnapshotRef = useRef(null);
  const prevUidRef = useRef(undefined); // undefined = stato d'auth non ancora risolto la prima volta
  useEffect(() => {
    const uid = authUser ? authUser.uid : null;
    if (prevUidRef.current !== undefined && prevUidRef.current !== uid) {
      preLoginSnapshotRef.current = {
        logs: logsRef.current,
        schede: schedeRef.current,
        draftSession: draftRef.current,
      };
      setLogs([]);
      setSchede([]);
      setOwnedSchede([]);
      setReceivedSchede([]);
      setOwnedLoaded(false);
      setReceivedLoaded(false);
      setDraftSession(null);
      setActiveSchedaId(null);
      setViewingUid(null);
      lastServerLogIdsRef.current = null;
      try {
        localStorage.removeItem(LOG_KEY);
        localStorage.removeItem(SCHEDE_KEY);
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(ACTIVE_KEY);
      } catch (e) {
        /* ignora */
      }
    }
    prevUidRef.current = uid;
  }, [authUser]);

  // Caricamento iniziale da localStorage: veloce, e funziona anche senza login/offline
  useEffect(() => {
    let ex = [];
    let guide = {};
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
      const raw = localStorage.getItem(EX_GUIDE_KEY);
      if (raw) guide = JSON.parse(raw);
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
    setExerciseGuide(guide);
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
          if (data.exerciseGuide && typeof data.exerciseGuide === "object") {
            setExerciseGuide(data.exerciseGuide);
            try { localStorage.setItem(EX_GUIDE_KEY, JSON.stringify(data.exerciseGuide)); } catch (e) {}
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
    // Ogni volta che cambia l'account (login/logout/switch) si riparte senza
    // "memoria" di cosa fosse già sincronizzato per l'account precedente.
    lastServerLogIdsRef.current = null;
    if (!authUser) return;
    const ref = doc(db, "users", authUser.uid);
    let didInit = false;
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.logs)) {
            const serverIds = new Set(data.logs.map((l) => l.id));
            const knownBefore = lastServerLogIdsRef.current;
            setLogs((prev) => {
              // Allenamenti presenti in locale ma non nel documento arrivato dal
              // cloud: li tengo e li rimando subito al cloud SOLO se non erano
              // già stati sincronizzati in precedenza (altrimenti vuol dire che
              // sono stati rimossi davvero altrove, es. eliminazione definitiva
              // da Admin → Cancellati, e non vanno resuscitati). Senza questa
              // protezione, un semplice setLogs(data.logs) qui poteva cancellare
              // allenamenti appena inseriti che non avevano ancora fatto in
              // tempo a salvarsi (login ancora in corso, rete assente in palestra...).
              const missing = prev.filter(
                (l) => l.id && !serverIds.has(l.id) && !(knownBefore && knownBefore.has(l.id))
              );
              const merged = missing.length ? [...missing, ...data.logs] : data.logs;
              try { localStorage.setItem(LOG_KEY, JSON.stringify(merged)); } catch (e) {}
              if (missing.length) persist(LOG_KEY, merged);
              return merged;
            });
            lastServerLogIdsRef.current = serverIds;
          }
          // Le schede non vivono più qui (vedi la sincronizzazione dedicata
          // più sotto, sulla collection condivisa "schede"): un campo
          // `schede` trovato qui è roba vecchia da migrare. Niente flag
          // "già migrato" da tenere in giro: migrateLegacySchede pulisce
          // questo campo SOLO dopo aver confermato che la scrittura nel
          // posto nuovo è andata a buon fine, quindi finché questo campo ha
          // qualcosa vuol dire che non ci è ancora riuscita — si ritenta ad
          // ogni sync, in automatico, anche se un tentativo precedente si
          // fosse fermato a metà (es. regole non ancora pubblicate).
          if (Array.isArray(data.schede) && data.schede.length) {
            migrateLegacySchede(data.schede);
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
          // locali esistenti (quelli di prima del login, salvati nel ponte
          // preLoginSnapshotRef appena sopra); ogni altro utente parte
          // pulito, per non ritrovarsi con la scheda/gli allenamenti di
          // qualcun altro che avesse usato l'app da questo stesso dispositivo.
          const isThisAdmin = authUser.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
          const bridge = preLoginSnapshotRef.current;
          // Le eventuali schede del ponte finiscono anche loro nel campo
          // `schede` del documento appena creato: rientrano così nel percorso
          // di migrazione qui sopra (lo scatena lo snapshot che arriva subito
          // dopo questa scrittura), senza doverlo duplicare qui.
          const initial = isThisAdmin && bridge
            ? { logs: bridge.logs, draftSession: bridge.draftSession, schede: bridge.schede || [] }
            : { logs: [], draftSession: null };
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
  }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrive su localStorage e, se loggato, sincronizza anche su Firestore.
  // ⚠️ Prima questa funzione segnalava solo gli errori di localStorage:
  // se la scrittura sul cloud falliva (connessione assente in palestra,
  // permessi, documento troppo grande...) l'errore finiva solo nella
  // console e l'utente non se ne accorgeva — è così che un allenamento
  // registrato poteva sparire senza alcun avviso al giro di sync successivo.
  // Ora il banner in cima resta acceso finché il cloud non conferma il salvataggio.
  const syncCloud = useCallback((ref, field, value) => {
    setDoc(ref, { [field]: value }, { merge: true })
      .then(() => setSaveError(false))
      .catch((e) => {
        console.error(e);
        setSaveError(true);
      });
  }, []);

  const persist = useCallback(
    (key, value) => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        setSaveError(true);
        return;
      }

      if (key === EX_KEY || key === EX_META_KEY || key === EX_GUIDE_KEY) {
        // Anagrafica condivisa: unica per tutti. Chiunque sia autenticato può
        // aggiungere esercizi (anche creando una scheda), così l'elenco resta
        // lo stesso per admin, personal trainer e utenti normali.
        if (!authUser) { setSaveError(false); return; }
        const field =
          key === EX_KEY ? "exercises" :
          key === EX_META_KEY ? "exerciseMeta" : "exerciseGuide";
        syncCloud(doc(db, "shared", "registry"), field, value);
        return;
      }

      if (!authUser) { setSaveError(false); return; }
      const field =
        key === LOG_KEY ? "logs" :
        key === SCHEDE_KEY ? "schede" :
        key === DRAFT_KEY ? "draftSession" :
        key === ACTIVE_KEY ? "activeSchedaId" : null;
      if (field) syncCloud(doc(db, "users", authUser.uid), field, value);
      else setSaveError(false);
    },
    [authUser, syncCloud]
  );

  // Migrazione: prima le schede vivevano dentro users/{uid}.schede (una copia
  // indipendente per ciascun utente — è così che nasceva il bug "l'admin non
  // vede le modifiche fatte dall'utente"). Ora la scheda è un documento UNICO
  // nella collection condivisa "schede": chi l'ha creata e chi se l'è vista
  // assegnare leggono/scrivono lo stesso documento. Qui si spostano i dati
  // vecchi trovati in users/{uid}.schede.
  // ⚠️ Il campo `schede` sul documento utente si svuota SOLO dopo che TUTTE
  // le scritture nel posto nuovo sono confermate: è quel campo, non un flag a
  // parte, a dire se la migrazione è già andata a buon fine. Un flag separato
  // scritto senza aspettare l'esito delle altre scritture aveva già causato
  // una perdita di visibilità: bastava un attimo di regole non ancora
  // pubblicate durante la primissima esecuzione, il flag restava "vero" per
  // sempre e la scheda spariva senza che si ritentasse mai più.
  const migratingRef = useRef(false);
  const migrateLegacySchede = useCallback(
    async (list) => {
      if (!authUser || !Array.isArray(list) || !list.length || migratingRef.current) return;
      migratingRef.current = true;
      const byName = authUser.displayName || authUser.email || "Tu";
      try {
        await Promise.all(
          list.filter((s) => s && s.id).map((s) => {
            if (s.sourceSchedaId) {
              // Copia ottenuta accettando un'assegnazione: l'originale resta
              // l'unico documento (lo crea/completa chi l'ha fatta), qui mi
              // limito ad aggiungermi tra chi ce l'ha assegnata.
              return setDoc(
                doc(db, "schede", s.sourceSchedaId),
                { assignedTo: arrayUnion({ uid: authUser.uid, name: byName }), assignedToUids: arrayUnion(authUser.uid) },
                { merge: true }
              );
            }
            return setDoc(
              doc(db, "schede", s.id),
              {
                id: s.id,
                name: s.name || "Scheda",
                days: getDays(s),
                ownerUid: authUser.uid,
                ownerName: byName,
                assignedTo: s.assignedTo || [],
                assignedToUids: (s.assignedTo || []).map((t) => t.uid),
                history: s.history || [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
              { merge: true }
            );
          })
        );
        // Solo ora, con tutte le scritture confermate, svuoto il campo
        // vecchio: è questo a spegnere la migrazione, non un flag a parte.
        await setDoc(doc(db, "users", authUser.uid), { schede: [] }, { merge: true });
      } catch (e) {
        console.error(e);
        setSaveError(true);
        // Non tocco il campo `schede`: al prossimo giro (nuovo login, nuovo
        // snapshot, rete tornata) si ritenta da capo.
      } finally {
        migratingRef.current = false;
      }
    },
    [authUser]
  );

  // Schede: due ascolti in parallelo (quelle che possiedo, quelle che mi sono
  // state assegnate) uniti in un solo elenco. Niente più coda di
  // "assegnazioni in sospeso" da accettare: essendo lo stesso documento,
  // compare subito a chi viene assegnato.
  const [ownedSchede, setOwnedSchede] = useState([]);
  const [receivedSchede, setReceivedSchede] = useState([]);
  // ⚠️ Non basta "authUser esiste" per fidarsi del risultato: se le regole
  // Firestore sulla collection "schede" non sono ancora state pubblicate (o
  // la rete è assente), gli ascolti qui sotto vanno in errore e non
  // chiamerebbero mai la callback di successo — senza questi due flag,
  // l'unione qui sotto scriverebbe comunque "vuoto" su schede E sulla cache
  // locale, facendo SPARIRE dalla vista una scheda che invece è ancora lì,
  // semplicemente non ancora letta. Si aggiorna solo quando ENTRAMBI gli
  // ascolti hanno davvero risposto almeno una volta (anche con zero schede).
  const [ownedLoaded, setOwnedLoaded] = useState(false);
  const [receivedLoaded, setReceivedLoaded] = useState(false);
  useEffect(() => {
    // Senza login non si tocca lo stato: resta quello letto da localStorage
    // all'avvio (offline/senza account, come logs e draftSession). Il logout
    // vero e proprio azzera già tutto nella guardia di cambio account qui sopra.
    if (!authUser) return;
    setOwnedLoaded(false);
    setReceivedLoaded(false);
    const unsubOwned = onSnapshot(
      query(collection(db, "schede"), where("ownerUid", "==", authUser.uid)),
      (snap) => {
        setOwnedSchede(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setOwnedLoaded(true);
      },
      (e) => {
        console.error(e);
        setSaveError(true);
      }
    );
    const unsubReceived = onSnapshot(
      query(collection(db, "schede"), where("assignedToUids", "array-contains", authUser.uid)),
      (snap) => {
        setReceivedSchede(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setReceivedLoaded(true);
      },
      (e) => {
        console.error(e);
        setSaveError(true);
      }
    );
    return () => {
      unsubOwned();
      unsubReceived();
    };
  }, [authUser]);

  useEffect(() => {
    // Senza login non tocco lo stato: resta quello letto da localStorage
    // all'avvio (offline/senza account). Il logout azzera già tutto nella
    // guardia di cambio account qui sopra. E finché non ho la conferma di
    // ENTRAMBI gli ascolti, non tocco né lo stato né la cache: uno dei due
    // potrebbe essere ancora in caricamento o in errore (permessi non ancora
    // propagati, rete assente...) e "vuoto" qui non vorrebbe dire "non hai
    // schede", vorrebbe dire "non sono ancora riuscito a controllare".
    if (!authUser || !ownedLoaded || !receivedLoaded) return;
    const merged = [...ownedSchede, ...receivedSchede];
    setSchede(merged);
    try {
      localStorage.setItem(SCHEDE_KEY, JSON.stringify(merged));
    } catch (e) {
      /* ignora */
    }
  }, [authUser, ownedSchede, receivedSchede, ownedLoaded, receivedLoaded]);

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

  // ⚠️ La cancellazione di un allenamento NON è mai fisica: si marca solo con
  // deletedAt (data/ora di cancellazione). Le voci con deletedAt restano nel
  // documento ma sono nascoste ovunque tramite activeLogs/statsLogs; solo un
  // admin può vederle e ripristinarle (o eliminarle per sempre) dalla sezione
  // Admin → Cancellati. Vedi [[ghisa-log-soft-delete]] in memoria.
  const deleteLog = useCallback(
    (id) => {
      setLogs((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, deletedAt: Date.now() } : l));
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
        const next = prev.map((l) => (idSet.has(l.id) ? { ...l, deletedAt: Date.now() } : l));
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
      setExerciseGuide({});
      clear(EX_KEY);
      clear(EX_META_KEY);
      clear(EX_GUIDE_KEY);
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

  // Collega/scollega la guida esterna (slug di @bryllim/workout-guide) scelta
  // da un admin/PT per un esercizio: da quel momento chi la apre in
  // Allenamento vede subito l'immagine giusta, senza dover cercare.
  const setExerciseGuideSlug = useCallback(
    (name, slug) => {
      setExerciseGuide((prev) => {
        const next = { ...prev, [name]: slug };
        persist(EX_GUIDE_KEY, next);
        return next;
      });
    },
    [persist]
  );

  const clearExerciseGuideSlug = useCallback(
    (name) => {
      setExerciseGuide((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        persist(EX_GUIDE_KEY, next);
        return next;
      });
    },
    [persist]
  );

  // Applica una trasformazione esercizio-per-esercizio a tutte le schede che
  // vedo (mie o assegnate a me) e scrive solo quelle davvero cambiate, una
  // per una, direttamente sul documento condiviso — non più un unico array
  // da riscrivere tutto insieme.
  const updateSchedeExercises = useCallback(
    (mapPart, byName) => {
      schede.forEach((s) => {
        const mapped = mapSchedaExercises(s, mapPart);
        const days = getDays(mapped);
        if (JSON.stringify(days) === JSON.stringify(getDays(s))) return;
        const withHistory = withSchedaHistory({ ...s, days }, s, byName);
        updateDoc(doc(db, "schede", s.id), { days, history: withHistory.history, updatedAt: Date.now() }).catch((e) =>
          console.error(e)
        );
      });
    },
    [schede]
  );

  const mergeExercises = useCallback(
    (namesToMerge, keepName) => {
      const toReplace = namesToMerge.filter((n) => n !== keepName);
      if (toReplace.length === 0) return;
      const byName = authUser?.displayName || authUser?.email || "Tu";

      setLogs((prev) => {
        const next = prev.map((l) =>
          toReplace.includes(l.exercise) ? { ...l, exercise: keepName } : l
        );
        persist(LOG_KEY, next);
        return next;
      });

      updateSchedeExercises(
        (p) => (toReplace.includes(p.exercise) ? { ...p, exercise: keepName } : p),
        byName
      );

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

      setExerciseGuide((prev) => {
        // Tiene la guida di keepName se già c'è, altrimenti quella del primo
        // esercizio unito che ne aveva una
        const kept = prev[keepName] ?? toReplace.map((n) => prev[n]).find((s) => s);
        if (kept === undefined && !toReplace.some((n) => n in prev)) return prev;
        const next = { ...prev };
        toReplace.forEach((n) => delete next[n]);
        if (kept) next[keepName] = kept;
        else delete next[keepName];
        persist(EX_GUIDE_KEY, next);
        return next;
      });
    },
    [persist, updateSchedeExercises, authUser]
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
      const byName = authUser?.displayName || authUser?.email || "Tu";

      setLogs((prev) => {
        const next = prev.map((l) => (l.exercise === oldName ? { ...l, exercise: newName } : l));
        persist(LOG_KEY, next);
        return next;
      });

      updateSchedeExercises((p) => (p.exercise === oldName ? { ...p, exercise: newName } : p), byName);

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

      setExerciseGuide((prev) => {
        if (!prev[oldName]) return prev;
        const next = { ...prev };
        next[newName] = prev[oldName];
        delete next[oldName];
        persist(EX_GUIDE_KEY, next);
        return next;
      });
    },
    [exercises, persist, mergeExercises, updateSchedeExercises, authUser]
  );

  // ⚠️ La scheda è UNICA: un solo documento condiviso, non una copia per
  // utente. Chi la crea e chi se la vede assegnare scrivono sullo stesso
  // documento — le modifiche dell'uno sono subito visibili all'altro (prima
  // ognuno aveva la propria copia indipendente ed era facile disallinearle).
  // La cronologia (withSchedaHistory) resta quindi condivisa: registra chi ha
  // cambiato cosa e quando, chiunque sia stato.
  const saveScheda = useCallback(
    (scheda) => {
      const byName = authUser?.displayName || authUser?.email || "Tu";
      const existing = schede.find((s) => s.id === scheda.id);
      if (!existing) {
        // Nuova scheda: la creo io, di conseguenza ne sono il proprietario.
        // (assignedTo può arrivare già valorizzato solo da "Duplica e
        // assegna a...": lì si crea e si condivide in un solo passaggio.)
        const assignedTo = scheda.assignedTo || [];
        setDoc(doc(db, "schede", scheda.id), {
          id: scheda.id,
          name: scheda.name,
          days: scheda.days,
          ownerUid: authUser?.uid,
          ownerName: byName,
          assignedTo,
          assignedToUids: assignedTo.map((t) => t.uid),
          history: [{ at: Date.now(), byName, summary: "Scheda creata" }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }).catch((e) => console.error(e));
        return;
      }
      // Modifica di una scheda esistente: aggiorno solo nome/giorni/cronologia,
      // MAI ownerUid/assignedTo (così chi assegna e chi riceve restano quelli
      // che erano, indipendentemente da chi ha appena salvato).
      const withHistory = withSchedaHistory(scheda, existing, byName);
      updateDoc(doc(db, "schede", scheda.id), {
        name: scheda.name,
        days: scheda.days,
        history: withHistory.history,
        updatedAt: Date.now(),
      }).catch((e) => console.error(e));
    },
    [schede, authUser]
  );

  // Assegna una scheda a un'altra persona: da quel momento legge/scrive lo
  // stesso documento, non una copia. Idempotente (arrayUnion) e senza alcuna
  // "richiesta da accettare": compare subito tra le sue schede.
  const assignScheda = useCallback(
    (scheda, target) => {
      const byName = authUser?.displayName || authUser?.email || "Tu";
      const entry = { at: Date.now(), byName, summary: `Assegnata a ${target.name}` };
      updateDoc(doc(db, "schede", scheda.id), {
        assignedTo: arrayUnion({ uid: target.uid, name: target.name }),
        assignedToUids: arrayUnion(target.uid),
        history: [entry, ...(scheda.history || [])].slice(0, 30),
        updatedAt: Date.now(),
      }).catch((e) => console.error(e));
    },
    [authUser]
  );

  // L'owner toglie l'accesso a una persona (o se stessa, se è lei a "lasciare"
  // una scheda ricevuta): non cancella il documento, solo la lega/slega.
  const unassignScheda = useCallback(
    (scheda, target) => {
      const byName = authUser?.displayName || authUser?.email || "Tu";
      const isSelf = authUser && target.uid === authUser.uid;
      const summary = isSelf ? `${byName} ha lasciato la scheda` : `Rimossa a ${target.name}`;
      updateDoc(doc(db, "schede", scheda.id), {
        assignedTo: arrayRemove({ uid: target.uid, name: target.name }),
        assignedToUids: arrayRemove(target.uid),
        history: [{ at: Date.now(), byName, summary }, ...(scheda.history || [])].slice(0, 30),
        updatedAt: Date.now(),
      }).catch((e) => console.error(e));
    },
    [authUser]
  );

  const setActiveScheda = useCallback(
    (id) => {
      setActiveSchedaId(id);
      persist(ACTIVE_KEY, id);
    },
    [persist]
  );

  // Elimina il documento per tutti (owner/admin soltanto, vedi firestore.rules
  // — chi l'ha solo ricevuta non può farla sparire agli altri: usa "lascia").
  const deleteScheda = useCallback(
    (id) => {
      deleteDoc(doc(db, "schede", id)).catch((e) => console.error(e));
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
          --steel-dim: rgba(124, 139, 153, 0.16);
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
          --steel-dim: rgba(92, 103, 115, 0.12);
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

        /* Scheda in arrivo da un admin/PT, in attesa di accettazione */
        .g-assign-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          flex-wrap: wrap;
          background: var(--accent-dim); border: 1px solid var(--accent);
          border-radius: 12px; padding: 12px 14px; margin-bottom: 8px;
        }
        .g-assign-banner:last-child { margin-bottom: 0; }
        .g-assign-banner svg { color: var(--accent); flex-shrink: 0; }
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

        /* Campo di ricerca: lente a sinistra, x per cancellare a destra */
        .g-search-field { position: relative; display: flex; align-items: center; }
        .g-search-field > svg:first-child {
          position: absolute; left: 12px; color: var(--ink-dim); pointer-events: none;
        }
        .g-search-field .g-input { padding-left: 36px; padding-right: 32px; }
        .g-search-clear {
          position: absolute; right: 6px; background: none; border: none; color: var(--ink-dim);
          cursor: pointer; padding: 7px; display: flex; align-items: center;
        }
        .g-search-clear:hover { color: var(--ink); }

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
        /* Azioni "intermedie" (aggiungi al giorno/alla sessione): colore
           secondario del sito (--steel), non grigio, così si vede bene ma
           resta distinto dal salvataggio finale in arancione */
        .g-submit-secondary {
          background: var(--steel); color: #fff; border: none;
        }

        .g-timer-box {
          margin-top: 22px; background: var(--surface-2); border: 1px solid var(--line);
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
        .g-del-btn:disabled { opacity: 0.3; cursor: default; }
        .g-del-btn:disabled:hover { color: var(--ink-dim); }

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
        .g-searchable-trigger {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          text-align: left;
        }
        .g-searchable-trigger > span {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .g-locked-field {
          width: 100%; background: var(--surface); border: 1px solid var(--line);
          color: var(--ink); border-radius: 10px; padding: 10px 12px; font-size: 14px;
          display: flex; align-items: center; gap: 8px;
        }

        .g-sets-reps-row {
          display: flex; justify-content: center; gap: 32px; margin-top: 26px;
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
        /* Pillole "Guida"/"Parte del corpo": stesso trattamento (sfondo
           tinta steel, padding generoso, forma a pillola) delle sezioni di
           pausa jump/superset, non delle piccole etichette di stato. */
        .g-guide-pill {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 600; text-transform: none; letter-spacing: 0.01em;
          padding: 9px 14px; border-radius: 999px;
          background: rgba(124,139,153,0.16); color: var(--steel); border: 1px solid var(--steel);
          cursor: pointer; white-space: nowrap;
        }
        .g-guide-pill:hover { background: rgba(124,139,153,0.26); }
        .g-ex-note {
          margin: 10px 0 12px; padding: 8px 10px; border-radius: 8px;
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

        /* Riga che va a capo solo se serve: con 4 opzioni (Ripetizioni/A tempo/
           A sfinimento/Cardio) stanno su una riga sola quando c'è spazio (es.
           tablet), e vanno automaticamente su due righe quando lo schermo è
           stretto, invece di schiacciarsi. Con 2 sole opzioni (es. "Serie
           uguali"/"Serie diverse") restano sempre affiancate. */
        .g-seg { display: flex; flex-wrap: wrap; gap: 6px; }
        .g-seg-btn {
          flex: 1 1 105px; padding: 9px 4px; border-radius: 9px; border: 1px solid var(--ink-dim);
          background: var(--surface-2); color: var(--ink-dim); font-size: 12px; font-weight: 600;
          cursor: pointer; white-space: nowrap;
        }
        .g-seg-btn.active { border-color: var(--accent); color: var(--ink); background: var(--accent-dim); }

        /* Scelta superset/jumpset: nome + spiegazione compatta sotto, non un
           paragrafo separato — più chiaro con più di due esercizi abbinati */
        .g-combo-choice-row { display: flex; gap: 8px; }
        .g-combo-choice {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 8px 10px; border-radius: 9px; border: 1px solid var(--ink-dim);
          background: var(--surface-2); color: var(--ink-dim); cursor: pointer; text-align: center;
        }
        .g-combo-choice.active { border-color: var(--accent); background: var(--accent-dim); }
        .g-combo-choice-name { font-size: 12.5px; font-weight: 700; color: var(--ink); }
        .g-combo-choice-desc { font-size: 10.5px; color: var(--ink-dim); line-height: 1.25; }

        .g-timer-tabs { display: flex; gap: 6px; justify-content: center; margin-bottom: 10px; }
        .g-ex-meta {
          font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--ink-dim); margin-bottom: 2px;
        }
        .g-ex-name {
          font-family: 'Oswald', sans-serif; font-size: 19px; font-weight: 600;
          letter-spacing: 0.01em; line-height: 1.2;
          /* I nomi lunghi vanno a capo: devono restare leggibili per intero */
          white-space: normal; overflow-wrap: anywhere; word-break: break-word;
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

        /* flex-wrap: con 5 sotto-sezioni admin (Esercizi/Utenti/Dati/Cancellati/
           Pulizia) su un telefono stretto vanno su due righe invece di schiacciarsi */
        .g-admin-subtabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .g-admin-subtab {
          flex: 1 1 88px; text-align: center; padding: 9px 4px; border-radius: 10px;
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

        /* Elenco statico di risultati ricerca (es. scelta utente in Statistiche):
           stesso stile del menu a tendina di ExercisePicker, ma non "flottante" */
        .g-user-pick-list {
          margin-top: 8px; border: 1px solid var(--line); border-radius: 10px;
          background: var(--surface-2); max-height: 260px; overflow-y: auto;
        }
        .g-user-pick-item {
          padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--line);
        }
        .g-user-pick-item:last-child { border-bottom: none; }
        .g-user-pick-item:hover { background: var(--accent-dim); }
        .g-bodyparts-panel {
          display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start;
          padding: 10px 4px 14px 4px;
          border-bottom: 1px solid var(--line);
        }

        .g-scheda-row {
          padding: 13px 6px; border-bottom: 1px solid var(--line);
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          border-radius: 8px; transition: background 0.15s;
        }
        .g-scheda-row:hover { background: var(--surface-2); }
        .g-scheda-row:last-child { border-bottom: none; }
        .g-menu {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 40;
          min-width: 190px; background: var(--surface-2); border: 1px solid var(--line);
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
        .g-menu-divider { height: 1px; background: var(--line); margin: 5px 4px; }

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

        .g-row-card {
          margin-top: 12px; padding: 12px; border-radius: 12px;
          background: var(--surface-2); border: 1px solid var(--line);
        }
        .g-row-card .g-input { background: var(--surface); }
        .g-row-backoff { border-style: dashed; border-color: var(--steel); }
        .g-row-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .g-row-name {
          font-weight: 600; font-size: 14.5px; line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .g-row-parts { font-size: 10.5px; color: var(--ink-dim); margin-top: 2px; }
        .g-row-fields { display: flex; gap: 8px; margin-top: 12px; }
        .g-field-mini { flex: 1; min-width: 0; }
        .g-field-mini .g-field-label { text-align: center; font-size: 10px; }
        .g-mini-stepper { display: flex; align-items: center; gap: 4px; }
        .g-mini-stepper .g-counter-btn { width: 30px; height: 32px; min-width: 30px; flex-shrink: 0; }
        .g-mini-input {
          flex: 1; min-width: 0; text-align: center; padding: 7px 2px;
          font-size: 15px; font-weight: 600;
        }
        .g-mini-timer {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          margin: 16px 0; padding: 10px 14px; border-radius: 999px;
          background: rgba(124,139,153,0.16); border: 1px solid var(--steel);
        }
        .g-mini-timer-label {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em;
          color: var(--steel); font-weight: 700;
        }
        .g-mini-timer-value { font-size: 17px; font-weight: 700; min-width: 52px; text-align: center; }
        .g-mini-timer-btn {
          background: var(--surface); border: 1px solid var(--line); color: var(--ink);
          border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 12px;
          display: inline-flex; align-items: center; gap: 4px;
        }
        .g-mini-timer-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }

        .g-part-block {
          margin-top: 18px; padding: 16px; border-radius: 12px;
          background: var(--surface-2); border: 1px solid var(--line);
        }
        .g-part-block .g-input,
        .g-part-block .g-counter-btn,
        .g-part-block .g-step-pill { background: var(--surface); }
        .g-part-block-head {
          display: flex; flex-direction: column; align-items: flex-start;
          gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--line);
        }
        .g-part-block-name {
          font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 600;
          overflow-wrap: anywhere; line-height: 1.25;
        }

        .g-combo-list {
          margin-top: 12px; padding: 10px; border-radius: 10px;
          background: var(--surface-2); border: 1px solid var(--line);
        }
        .g-combo-list-title {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em;
          color: var(--steel); font-weight: 700; margin-bottom: 8px; text-align: center;
        }
        .g-combo-item {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          width: 100%; text-align: left; cursor: pointer;
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 8px; padding: 8px 10px; color: var(--ink-dim);
        }
        .g-combo-item.active {
          border-color: var(--accent); background: var(--accent-dim); color: var(--ink);
        }
        .g-combo-item-name { font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
        .g-combo-item-target {
          font-family: 'JetBrains Mono', monospace; font-size: 11.5px;
          color: var(--ink-dim); flex-shrink: 0;
        }
        .g-combo-arrow {
          text-align: center; font-size: 10.5px; color: var(--steel);
          text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700;
          margin: 16px 0; padding: 9px 14px; border-radius: 999px;
          background: rgba(124,139,153,0.16); border: 1px solid var(--steel);
        }

        .g-combo-divider {
          text-align: center; font-size: 11px; color: var(--steel);
          text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700;
          margin: 10px 0 -2px 0;
        }
        .g-combo-label { color: var(--steel); font-weight: 700; }

        /* Campo durata mm:ss con gli step +/- incorporati nella textbox
           (invece che a fianco), come nel recupero. */
        .g-duration-field { position: relative; }
        .g-duration-input {
          width: 100%; text-align: center; font-size: 15px; font-weight: 700;
          background: var(--surface); border: 1px solid var(--line); color: var(--ink);
          border-radius: 8px; padding: 9px 34px; outline: none; font-family: inherit;
        }
        .g-duration-input:focus { border-color: var(--accent); }
        .g-duration-btn {
          position: absolute; top: 1px; bottom: 1px; width: 30px;
          display: flex; align-items: center; justify-content: center;
          background: none; border: none; color: var(--ink-dim); font-size: 16px;
          cursor: pointer; touch-action: manipulation;
        }
        .g-duration-btn:hover, .g-duration-btn:active { color: var(--accent); }
        .g-duration-btn-left { left: 0; border-radius: 8px 0 0 8px; }
        .g-duration-btn-right { right: 0; border-radius: 0 8px 8px 0; }

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
        .g-scheda-name { font-weight: 600; font-size: 15.5px; }
        .g-scheda-meta { font-size: 12px; color: var(--ink-dim); margin-top: 3px; }
        .g-icon-btn {
          background: var(--surface-2); border: 1px solid var(--ink-dim); color: var(--ink-dim);
          border-radius: 8px; padding: 7px; cursor: pointer; display: flex; align-items: center;
        }
        .g-icon-btn:hover { color: var(--ink); }
        .g-icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .g-draft-item {
          display: flex; align-items: center; gap: 8px;
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: 10px; padding: 10px 10px; margin-bottom: 8px;
          font-size: 13.5px;
        }
        .g-draft-item-active { border-color: var(--accent); }
        .g-draft-item-moving { opacity: 0.55; border-style: dashed; border-color: var(--accent); }
        .g-draft-grip { padding: 8px; flex-shrink: 0; cursor: grab; }
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

        /* "Aggiungi giorno" / "Aggiungi esercizio": stesso trattamento, colore
           secondario del sito (--steel). Sfondo tinteggiato + bordo pieno
           (non più tratteggiato trasparente) perché si veda bene anche su
           schermi piccoli o con poca luce. */
        .g-add-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; padding: 10px; margin-top: 6px;
          background: var(--steel-dim); border: 1.5px solid var(--steel); border-radius: 9px;
          color: var(--steel); font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .g-add-btn:hover { opacity: 0.85; }

        .g-spin { animation: g-spin 0.9s linear infinite; }
        @keyframes g-spin { to { transform: rotate(360deg); } }

        .g-part-card {
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: 10px; padding: 12px; margin-bottom: 8px;
        }
        .g-part-card .g-input, .g-part-card .g-duration-input { background: var(--surface); }

        /* Bottone "Opzioni avanzate": intestazione a fisarmonica per i campi
           meno usati (back-off, superset/jumpset, riscaldamento, note). Tenerli
           chiusi di default snellisce di molto il form nel caso più comune
           (un solo esercizio, senza back-off). */
        .g-accordion-toggle {
          display: flex; align-items: center; gap: 8px; width: 100%;
          margin-top: 16px; padding: 11px 12px; border-radius: 10px;
          background: var(--surface-2); border: 1px solid var(--line);
          color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer;
          text-align: left;
        }
        .g-accordion-summary {
          flex: 1; min-width: 0; font-weight: 400; font-size: 11.5px; color: var(--ink-dim);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right;
        }
        .g-accordion-arrow { flex-shrink: 0; color: var(--ink-dim); transition: transform 0.15s; }
        .g-accordion-arrow-open { transform: rotate(180deg); }
        .g-accordion-body {
          margin-top: 10px; padding: 12px; border-radius: 10px;
          background: var(--surface-2); border: 1px solid var(--line);
        }
        .g-accordion-body .g-part-card { background: var(--surface); }
        .g-accordion-body .g-part-card .g-input,
        .g-accordion-body .g-part-card .g-duration-input { background: var(--surface-2); }
        .g-accordion-divider { height: 1px; background: var(--line); margin: 16px 0; }

        /* Barra di salvataggio del blocco: resta ancorata in fondo allo
           schermo così è sempre raggiungibile senza scorrere fino in fondo,
           anche quando le opzioni avanzate sono aperte. */
        .g-block-actions {
          position: sticky; bottom: 0; z-index: 5;
          display: flex; gap: 8px; margin: 20px -18px -18px -18px; padding: 12px 18px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          background: var(--surface); border-top: 1px solid var(--line);
          border-radius: 0 0 14px 14px;
          box-shadow: 0 -8px 18px -10px rgba(0,0,0,0.35);
        }

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
        .g-set-head {
          display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--ink-dim); font-weight: 700;
        }
        .g-set-col { flex: 1; text-align: center; }
        .g-set-spacer { width: 26px; flex-shrink: 0; }

        /* Stepper -/+ incorporato dentro la stessa casella (non pulsanti a
           fianco): un solo riquadro con i due tasti ai bordi interni. */
        .g-inline-stepper {
          flex: 1; min-width: 0; display: flex; align-items: stretch;
          background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px;
          overflow: hidden;
        }
        .g-inline-stepper:focus-within { border-color: var(--accent); }
        .g-inline-stepper-btn {
          flex-shrink: 0; width: 28px; background: none; border: none;
          color: var(--ink-dim); font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .g-inline-stepper-btn:hover { color: var(--accent); }
        .g-inline-stepper-input {
          flex: 1; min-width: 0; width: 100%; background: none; border: none; outline: none;
          text-align: center; color: var(--ink); font-size: 15px; padding: 8px 0;
          font-family: inherit; -moz-appearance: textfield;
        }
        .g-inline-stepper-input::-webkit-outer-spin-button,
        .g-inline-stepper-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .g-set-row .g-del-btn { opacity: 0.5; }
        .g-set-row:hover .g-del-btn { opacity: 1; }
        .g-sets-wrap {
          margin-top: 20px; background: var(--surface-2); border: 1px solid var(--line);
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
          background: none; border: none; color: var(--ink-dim); font-size: 11px; cursor: pointer;
          padding: 6px 8px; line-height: 1; touch-action: manipulation;
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

        /* Gruppo di checkbox (Corpo libero / Back-off / Riscaldamento): stanno
           affiancate su una riga sola quando c'è spazio, e vanno a capo una
           per una quando lo schermo è troppo stretto per contenerle tutte. */
        .g-checkbox-group { display: flex; flex-wrap: wrap; column-gap: 20px; row-gap: 4px; }
        .g-checkbox-group .g-checkbox-row { width: auto; flex: 0 0 auto; }

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

        /* Modale "Esercizio extra": serie × rip a sinistra, guida e parte
           del corpo come pulsanti tondi a destra */
        .g-extra-row { display: flex; align-items: flex-end; gap: 8px; margin-top: 12px; }
        .g-extra-sep { height: 1px; background: var(--line); margin-top: 16px; }
        .g-extra-amount { flex: 1; min-width: 0; display: flex; align-items: flex-end; gap: 6px; }
        .g-extra-field { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .g-extra-field-label { font-size: 11px; color: var(--ink-dim); font-weight: 600; }
        .g-extra-times { color: var(--ink-dim); font-weight: 700; padding-bottom: 9px; }
        .g-round-btn {
          flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          background: rgba(124,139,153,0.16); color: var(--steel); border: 1px solid var(--steel);
        }
        .g-round-btn:hover:not(:disabled), .g-round-btn.active { background: rgba(124,139,153,0.30); }
        .g-round-btn:disabled { opacity: 0.4; cursor: default; }
        .g-extra-body {
          margin-top: 10px; padding: 10px; border-radius: 10px;
          background: var(--surface-2); border: 1px solid var(--line);
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
            Non riesco a sincronizzare i dati con il cloud in questo momento (rete assente o instabile?).
            Continua pure: restano salvati su questo dispositivo e riproverò a inviarli appena la connessione torna.
            Non disinstallare l'app né cancellare i dati del browser finché questo avviso non sparisce.
          </div>
        )}
        {loading ? (
          <div className="g-empty">Caricamento...</div>
        ) : view === "stats" ? (
          <StatsPage
            logs={statsLogs}
            goToLog={() => setView("log")}
            isStaff={isStaff}
            directoryUsers={staffDirectory}
            viewingUid={viewingUid}
            viewingUser={viewingUser}
            viewingLoading={viewingLoading}
            onViewUser={setViewingUid}
            viewingOther={viewingOther}
            onSetViewingOther={setViewingOther}
          />
        ) : view === "log" ? (
          <LogPage
            exercises={exercises}
            exerciseMeta={exerciseMeta}
            exerciseGuide={exerciseGuide}
            canManageGuide={isStaff}
            onSetGuide={setExerciseGuideSlug}
            onClearGuide={clearExerciseGuideSlug}
            logs={activeLogs}
            schede={schede}
            onAddBatch={addLogsBatch}
            onDelete={deleteLog}
            onDeleteBatch={deleteLogsBatch}
            onUpdate={updateLog}
            draft={draftSession}
            onSaveDraft={saveDraft}
            activeSchedaId={activeSchedaId}
            isStaff={isStaff}
            directoryUsers={staffDirectory}
            viewingUid={viewingUid}
            viewingUser={viewingUser}
            viewingLoading={viewingLoading}
            viewingLogs={viewingActiveLogs}
            onViewUser={setViewingUid}
            viewingOther={viewingOther}
            onSetViewingOther={setViewingOther}
            myUid={authUser?.uid}
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
            onAssignScheda={assignScheda}
            onUnassignScheda={unassignScheda}
            activeSchedaId={activeSchedaId}
            onSetActive={setActiveScheda}
          />
        ) : (
          <AdminPage
            exercises={exercises}
            exerciseMeta={exerciseMeta}
            exerciseGuide={exerciseGuide}
            onSetGuide={setExerciseGuideSlug}
            onClearGuide={clearExerciseGuideSlug}
            logs={activeLogs}
            totalLogCounts={totalLogCounts}
            totalsLoading={totalsLoading}
            onRefreshTotals={fetchTotalLogCounts}
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
