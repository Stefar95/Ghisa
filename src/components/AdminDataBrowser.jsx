import { useState, useCallback, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { RefreshCw, Search, X, Database, Users, Dumbbell, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { formatDate, logSummary } from "../lib/utils";

// Admin → Dati: fotografia grezza di tutto quello che c'è nel database
// (tutti gli utenti, tutti gli allenamenti, cancellati inclusi se si vuole),
// per capire al volo cosa è successo davvero — es. per verificare se un
// allenamento è stato salvato, su quale account, con quale data.
// È una "query" fatta leggendo tutti i documenti utente e filtrando in JS:
// i log non sono una collection interrogabile su Firestore (sono un array
// dentro users/{uid}), quindi questa pagina è il modo più diretto per farlo.
export default function AdminDataBrowser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState(null); // null = non ancora caricato
  const [loadedAt, setLoadedAt] = useState(null);
  const [q, setQ] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
        names[d.id] = { name: data.displayName || data.email || d.id, email: data.email || "" };
      });
      const flat = [];
      usersSnap.forEach((d) => {
        const userLogs = d.data()?.logs;
        if (!Array.isArray(userLogs)) return;
        const owner = names[d.id] || { name: d.id, email: "" };
        userLogs.forEach((l) => {
          if (!l) return;
          flat.push({ ...l, uid: d.id, ownerName: owner.name, ownerEmail: owner.email });
        });
      });
      setRows(flat);
      setLoadedAt(Date.now());
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

  // Riepilogo per utente: numero di allenamenti attivi/cancellati e ultima
  // data, così si vede subito chi ha registrato cosa senza dover scorrere
  // riga per riga. Cliccando una riga si filtra la tabella sotto su quell'utente.
  const perUser = useMemo(() => {
    if (!rows) return [];
    const map = new Map();
    rows.forEach((l) => {
      if (!map.has(l.uid)) {
        map.set(l.uid, {
          uid: l.uid,
          ownerName: l.ownerName,
          ownerEmail: l.ownerEmail,
          active: 0,
          deleted: 0,
          lastDate: null,
        });
      }
      const u = map.get(l.uid);
      if (l.deletedAt) u.deleted += 1;
      else u.active += 1;
      if (l.date && (!u.lastDate || l.date > u.lastDate)) u.lastDate = l.date;
    });
    return Array.from(map.values()).sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    return rows
      .filter((l) => (showDeleted ? true : !l.deletedAt))
      .filter((l) => (ownerFilter ? l.uid === ownerFilter : true))
      .filter((l) => (dateFrom ? (l.date || "") >= dateFrom : true))
      .filter((l) => (dateTo ? (l.date || "") <= dateTo : true))
      .filter((l) => {
        if (!s) return true;
        return (
          (l.exercise || "").toLowerCase().includes(s) ||
          (l.dayName || "").toLowerCase().includes(s) ||
          (l.note || "").toLowerCase().includes(s) ||
          (l.ownerName || "").toLowerCase().includes(s) ||
          (l.ownerEmail || "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1));
  }, [rows, q, ownerFilter, showDeleted, dateFrom, dateTo]);

  const totals = useMemo(() => {
    if (!rows) return { users: 0, active: 0, deleted: 0 };
    const uids = new Set(rows.map((l) => l.uid));
    return {
      users: uids.size,
      active: rows.filter((l) => !l.deletedAt).length,
      deleted: rows.filter((l) => l.deletedAt).length,
    };
  }, [rows]);

  const selectedOwnerName = ownerFilter ? perUser.find((u) => u.uid === ownerFilter)?.ownerName : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="g-field-label" style={{ marginBottom: 0 }}>
          Dati grezzi — tutti gli utenti
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

      <div className="g-stat-grid" style={{ marginTop: 0, marginBottom: 14 }}>
        <div className="g-stat-box">
          <div className="g-stat-num ghisa-mono">{totals.users}</div>
          <div className="g-stat-label">Utenti con dati</div>
        </div>
        <div className="g-stat-box">
          <div className="g-stat-num ghisa-mono">{totals.active}</div>
          <div className="g-stat-label">Voci attive</div>
        </div>
        <div className="g-stat-box">
          <div className="g-stat-num ghisa-mono" style={{ color: totals.deleted ? "var(--accent)" : undefined }}>
            {totals.deleted}
          </div>
          <div className="g-stat-label">Cancellate</div>
        </div>
      </div>

      {loadedAt && (
        <div style={{ fontSize: 11, color: "var(--ink-dim)", marginBottom: 10 }}>
          Ultimo aggiornamento: {new Date(loadedAt).toLocaleTimeString("it-IT")}
        </div>
      )}

      {/* Riepilogo per utente: cliccabile per filtrare la tabella sotto */}
      <div className="g-field-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Users size={12} /> Per utente
      </div>
      <div className="g-card" style={{ padding: "4px 14px", marginBottom: 14 }}>
        {perUser.length === 0 ? (
          <div style={{ padding: "14px 4px", fontSize: 12.5, color: "var(--ink-dim)" }}>Nessun dato.</div>
        ) : (
          perUser.map((u) => (
            <div
              className="g-reg-row"
              key={u.uid}
              style={{ cursor: "pointer", background: ownerFilter === u.uid ? "var(--accent-dim)" : undefined, borderRadius: 8 }}
              onClick={() => setOwnerFilter((prev) => (prev === u.uid ? "" : u.uid))}
            >
              <div style={{ minWidth: 0 }}>
                <div className="g-reg-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.ownerName}
                </div>
                <div className="g-reg-count">
                  {u.ownerEmail} · ultimo {u.lastDate ? formatDate(u.lastDate) : "—"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                <span className="g-tag" style={{ margin: 0 }}>
                  <Dumbbell size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
                  {u.active}
                </span>
                {u.deleted > 0 && (
                  <span className="g-tag" style={{ margin: 0, color: "var(--accent)", borderColor: "var(--accent)" }}>
                    <Trash2 size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
                    {u.deleted}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filtri sulla tabella di dettaglio */}
      <div className="g-card" style={{ marginBottom: 14, padding: "12px 14px" }}>
        <div className="g-search-field">
          <Search size={15} />
          <input
            className="g-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca per esercizio, giorno, nota, utente..."
          />
          {q && (
            <button className="g-search-clear" onClick={() => setQ("")} aria-label="Cancella ricerca">
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="g-field-label">Da data</label>
            <input className="g-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="g-field-label">A data</label>
            <input className="g-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
          <label className="g-checkbox-row" style={{ marginTop: 0 }}>
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
            Includi anche le voci cancellate
          </label>
          {(ownerFilter || q || dateFrom || dateTo || showDeleted) && (
            <button
              className="g-icon-btn"
              style={{ fontSize: 11.5, gap: 5 }}
              onClick={() => {
                setOwnerFilter("");
                setQ("");
                setDateFrom("");
                setDateTo("");
                setShowDeleted(false);
              }}
            >
              <X size={12} /> Pulisci filtri
            </button>
          )}
        </div>
      </div>

      <div className="g-field-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Database size={12} />
        {selectedOwnerName ? `Dettaglio — ${selectedOwnerName}` : "Dettaglio"} ({filtered.length})
      </div>

      {rows === null && loading ? (
        <div className="g-card g-empty">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="g-card g-empty">Nessuna voce corrisponde ai filtri.</div>
      ) : (
        <div className="g-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-dim)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <th style={{ padding: "9px 10px" }}>Data</th>
                  <th style={{ padding: "9px 10px" }}>Utente</th>
                  <th style={{ padding: "9px 10px" }}>Giorno</th>
                  <th style={{ padding: "9px 10px" }}>Esercizio</th>
                  <th style={{ padding: "9px 10px" }}>Dettaglio</th>
                  <th style={{ padding: "9px 10px" }}>Stato</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={`${l.uid}-${l.id || i}`} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{formatDate(l.date)}</td>
                    <td style={{ padding: "8px 10px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.ownerEmail}>
                      {l.ownerName}
                    </td>
                    <td style={{ padding: "8px 10px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.dayName || "Giorno libero"}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                      {l.exercise}
                      {l.backoff && <span style={{ color: "var(--steel)", fontWeight: 400 }}> · b.o.</span>}
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
                      {logSummary(l)}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {l.deletedAt ? (
                        <span className="g-tag" style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>Cancellata</span>
                      ) : (
                        <span className="g-tag" style={{ color: "var(--success)", borderColor: "var(--success)" }}>Attiva</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
