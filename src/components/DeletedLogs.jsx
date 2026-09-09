import { useState, useCallback, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { AlertTriangle, RotateCcw, Trash2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "../firebase";
import { confirmThen, formatDate, logSummary } from "../lib/utils";

// Admin → Cancellati: mostra gli allenamenti cancellati (deletedAt valorizzato)
// di TUTTI gli utenti, con la possibilità di ripristinarli o di eliminarli
// per sempre. La cancellazione da Allenamento non rimuove mai davvero i dati:
// mette solo deletedAt, così se qualcosa sparisce per sbaglio (o per un bug)
// resta recuperabile da qui invece che perso per sempre.
export default function DeletedLogs() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState(null); // null = non ancora caricato
  const [expanded, setExpanded] = useState(() => new Set());
  const [busyKey, setBusyKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersSnap, dirSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "directory")),
      ]);
      const names = {};
      dirSnap.forEach((d) => {
        const data = d.data();
        names[d.id] = data.displayName || data.email || d.id;
      });
      const groups = new Map();
      usersSnap.forEach((d) => {
        const userLogs = d.data()?.logs;
        if (!Array.isArray(userLogs)) return;
        userLogs.forEach((l) => {
          if (!l?.deletedAt) return;
          const key = `${d.id}::${l.sessionId || l.id}`;
          if (!groups.has(key)) {
            groups.set(key, {
              key,
              uid: d.id,
              ownerName: names[d.id] || d.id,
              date: l.date,
              dayName: l.dayName || "Giorno libero",
              deletedAt: l.deletedAt,
              entries: [],
            });
          }
          const g = groups.get(key);
          g.entries.push(l);
          if (l.deletedAt > g.deletedAt) g.deletedAt = l.deletedAt;
        });
      });
      setSessions(Array.from(groups.values()).sort((a, b) => b.deletedAt - a.deletedAt));
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpanded = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Rilegge il documento fresco dell'utente (potrebbe nel frattempo aver
  // registrato altro) e applica la modifica solo alle voci di questa sessione.
  const patchSession = async (group, apply) => {
    const ref = doc(db, "users", group.uid);
    const snap = await getDoc(ref);
    const current = Array.isArray(snap.data()?.logs) ? snap.data().logs : [];
    const ids = new Set(group.entries.map((e) => e.id));
    const next = apply(current, ids);
    await setDoc(ref, { logs: next }, { merge: true });
  };

  const restore = (group) => {
    confirmThen(
      `Ripristinare l'allenamento del ${formatDate(group.date)} (${group.entries.length} esercizi) di ${group.ownerName}?`,
      async () => {
        setBusyKey(group.key);
        try {
          await patchSession(group, (current, ids) =>
            current.map((l) => (ids.has(l.id) ? { ...l, deletedAt: null } : l))
          );
          await load();
        } catch (e) {
          console.error(e);
          alert("Non sono riuscito a ripristinare: " + (e.message || e));
        } finally {
          setBusyKey(null);
        }
      }
    );
  };

  const purge = (group) => {
    const typed = window.prompt(
      `Eliminare DEFINITIVAMENTE l'allenamento del ${formatDate(group.date)} (${group.entries.length} esercizi) di ${group.ownerName}?\n\nNon sarà più recuperabile.\nScrivi ELIMINA per confermare.`
    );
    if (typed !== "ELIMINA") return;
    (async () => {
      setBusyKey(group.key);
      try {
        await patchSession(group, (current, ids) => current.filter((l) => !ids.has(l.id)));
        await load();
      } catch (e) {
        console.error(e);
        alert("Non sono riuscito a eliminare: " + (e.message || e));
      } finally {
        setBusyKey(null);
      }
    })();
  };

  return (
    <div>
      <div className="g-danger-banner">
        <AlertTriangle size={15} />
        <span>
          Gli allenamenti cancellati da Allenamento arrivano qui (mai eliminati davvero).
          Puoi ripristinarli o, se proprio non servono più, eliminarli per sempre.
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="g-field-label" style={{ marginBottom: 0 }}>
          {sessions === null ? "Cancellati" : `Cancellati (${sessions.length})`}
        </div>
        <button className="g-icon-btn" style={{ fontSize: 12, gap: 5 }} onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "g-spin" : ""} /> Aggiorna
        </button>
      </div>

      {error && (
        <div className="g-card g-empty" style={{ padding: 16, marginBottom: 12, color: "var(--accent)" }}>
          Errore: {error}
        </div>
      )}

      {sessions === null && loading ? (
        <div className="g-card g-empty">Caricamento...</div>
      ) : sessions && sessions.length === 0 ? (
        <div className="g-card g-empty">Nessun allenamento cancellato al momento.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(sessions || []).map((g) => {
            const isOpen = expanded.has(g.key);
            const busy = busyKey === g.key;
            return (
              <div className="g-card" key={g.key} style={{ padding: "10px 14px" }}>
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 10 }}
                  onClick={() => toggleExpanded(g.key)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div className="g-history-date" style={{ width: 46 }}>{formatDate(g.date)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="g-session-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {g.dayName} · {g.ownerName}
                      </div>
                      <div className="g-reg-count">{g.entries.length} esercizi</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button className="g-icon-btn" style={{ fontSize: 11.5, gap: 4 }} disabled={busy} onClick={() => restore(g)} title="Ripristina">
                      <RotateCcw size={13} /> Ripristina
                    </button>
                    <button className="g-del-btn" disabled={busy} onClick={() => purge(g)} aria-label="Elimina per sempre" title="Elimina per sempre">
                      <Trash2 size={16} />
                    </button>
                    {isOpen ? (
                      <ChevronLeft size={16} style={{ transform: "rotate(-90deg)", color: "var(--ink-dim)" }} onClick={() => toggleExpanded(g.key)} />
                    ) : (
                      <ChevronRight size={16} style={{ transform: "rotate(90deg)", color: "var(--ink-dim)" }} onClick={() => toggleExpanded(g.key)} />
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                    {g.entries.map((l, i) => (
                      <div className="g-history-row" key={l.id || i}>
                        <div className="g-history-main">
                          <div className="g-history-ex">
                            {l.exercise}
                            {l.backoff && <span style={{ color: "var(--steel)", fontSize: 11 }}> · back-off</span>}
                          </div>
                          <div className="g-history-sets">{logSummary(l)}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 6 }}>
                      Cancellato il {new Date(g.deletedAt).toLocaleString("it-IT")}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
