import { X, History } from "lucide-react";

// Cronologia delle modifiche di una scheda (sola lettura): chi l'ha
// modificata, quando e un riassunto di cosa è cambiato. Non è lo storico
// allenamenti (quello resta in Allenamento) — qui si traccia la SCHEDA stessa.
// Essendo un documento unico condiviso, questa cronologia raccoglie le
// modifiche di chiunque ci abbia accesso: chi l'ha creata e chi se la vede
// assegnata.
export default function SchedaHistoryModal({ scheda, onClose }) {
  const history = scheda.history || [];
  return (
    <div className="g-modal-overlay" onClick={onClose}>
      <div className="g-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="g-title ghisa-display" style={{ fontSize: 18 }}>
            <History size={18} color="var(--accent)" /> Cronologia modifiche
          </div>
          <button className="g-icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={16} />
          </button>
        </div>

        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 6, marginBottom: 4 }}>
          {scheda.name}
        </div>

        {history.length === 0 ? (
          <div className="g-card g-empty" style={{ padding: 20, marginTop: 10 }}>
            Nessuna modifica registrata ancora.
          </div>
        ) : (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column" }}>
            {history.map((h, i) => (
              <div className="g-history-row" key={i} style={{ alignItems: "flex-start" }}>
                <div className="g-history-main">
                  <div className="g-history-ex">{h.byName || "Qualcuno"}</div>
                  <div className="g-history-sets">{h.summary}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-dim)", whiteSpace: "nowrap", flexShrink: 0, marginLeft: 8 }}>
                  {h.at ? new Date(h.at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
