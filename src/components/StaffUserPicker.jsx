import { useState, useMemo } from "react";
import { Search, X, Users } from "lucide-react";
import { SEARCH_MIN_CHARS } from "../lib/utils";

// Solo per admin/PT: due pulsanti in alto — "i tuoi" oppure "altro utente".
// Sul secondo si apre la ricerca per nome/email e la scelta resta valida
// finché non si torna sul primo pulsante. Usato sia da Statistiche sia da
// Allenamento — è lo stesso utente scelto in entrambe le tab (lo stato vive
// in App.jsx).
export default function StaffUserPicker({
  users, viewingUid, viewingUser, viewingLoading, onViewUser,
  viewingOther, onSetViewingOther,
  ownLabel = "Le tue statistiche",
  label = "Statistiche di", pickTitle = "Statistiche di un altro utente",
}) {
  const [q, setQ] = useState("");
  const searching = q.trim().length >= SEARCH_MIN_CHARS;
  const matches = useMemo(() => {
    if (!searching) return [];
    const s = q.trim().toLowerCase();
    return users
      .filter((u) => (u.displayName || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s))
      .slice(0, 20);
  }, [users, q, searching]);

  const showOther = viewingOther || !!viewingUid;

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="g-admin-subtabs">
        <button
          className={`g-admin-subtab ${!showOther ? "active" : ""}`}
          onClick={() => { onSetViewingOther(false); setQ(""); onViewUser(null); }}
        >
          {ownLabel}
        </button>
        <button
          className={`g-admin-subtab ${showOther ? "active" : ""}`}
          onClick={() => onSetViewingOther(true)}
        >
          Altro utente
        </button>
      </div>

      {showOther && (
        viewingUid ? (
          <div className="g-card" style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Users size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div className="g-field-label" style={{ marginBottom: 1 }}>{label}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {viewingLoading ? "Caricamento..." : viewingUser?.displayName || viewingUser?.email || "Utente"}
                  </div>
                </div>
              </div>
              <button className="g-icon-btn" style={{ flexShrink: 0, fontSize: 12, gap: 5 }} onClick={() => onViewUser(null)}>
                <X size={13} /> Cambia
              </button>
            </div>
          </div>
        ) : (
          <div className="g-card">
            <div className="g-field-label">{pickTitle}</div>
            <div className="g-search-field" style={{ marginTop: 4 }}>
              <Search size={15} />
              <input
                className="g-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cerca per nome o email..."
              />
            </div>
            {users.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 8 }}>
                Nessun altro utente ha ancora fatto accesso all'app.
              </div>
            ) : !searching ? (
              <div style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 8 }}>
                Scrivi almeno {SEARCH_MIN_CHARS} lettere (nome, cognome o email) per cercare.
              </div>
            ) : (
              <div className="g-user-pick-list">
                {matches.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--ink-dim)", padding: "10px 12px" }}>
                    Nessun utente corrisponde alla ricerca.
                  </div>
                ) : (
                  matches.map((u) => (
                    <div key={u.uid} className="g-user-pick-item" onClick={() => onViewUser(u.uid)}>
                      <div className="g-reg-name">{u.displayName || u.email}</div>
                      {u.displayName && <div className="g-reg-count">{u.email}</div>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
