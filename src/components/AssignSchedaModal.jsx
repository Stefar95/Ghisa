import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { X, Send, User } from "lucide-react";
import { db } from "../firebase";

// Assegnare non invia più una copia: aggiunge il destinatario a chi legge e
// scrive lo STESSO documento scheda. Compare subito tra le sue, senza dover
// accettare nulla, e da lì in poi le modifiche di entrambi si vedono a vicenda.
export default function AssignSchedaModal({ scheda, fromUser, onClose, onAssign }) {
  const [users, setUsers] = useState(null);
  const [targetUid, setTargetUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "directory"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u) => u.uid !== fromUser.uid)
          .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
        setUsers(list);
        setError(null);
      },
      (e) => {
        console.error(e);
        setError(e.message || String(e));
        setUsers([]);
      }
    );
    return unsub;
  }, [fromUser.uid]);

  const send = () => {
    if (!targetUid) return;
    const target = (users || []).find((u) => u.uid === targetUid);
    if (!target) return;
    setBusy(true);
    setError(null);
    onAssign(scheda, { uid: target.uid, name: target.displayName || target.email || "Utente" });
    setBusy(false);
    setDone(true);
  };

  return (
    <div className="g-modal-overlay" onClick={onClose}>
      <div className="g-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="g-title ghisa-display" style={{ fontSize: 18 }}>
            <Send size={18} color="var(--accent)" /> Assegna scheda
          </div>
          <button className="g-icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={16} />
          </button>
        </div>

        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 10 }}>
          Condividi <strong style={{ color: "var(--ink)" }}>{scheda.name}</strong>: da quel momento è
          la stessa scheda per entrambi, le modifiche di uno si vedono subito anche all'altro.
        </div>

        {done ? (
          <div className="g-card g-empty" style={{ padding: 20, marginTop: 16, color: "var(--success)" }}>
            Fatto. La troverà subito nella sua sezione Schede.
          </div>
        ) : (
          <>
            <label className="g-field-label" style={{ marginTop: 16 }}>Destinatario</label>
            {users === null ? (
              <div className="g-card g-empty" style={{ padding: 16 }}>Caricamento utenti...</div>
            ) : users.length === 0 ? (
              <div className="g-card g-empty" style={{ padding: 16 }}>
                Nessun altro utente ha ancora fatto accesso all'app.
              </div>
            ) : (
              <select
                className="g-input g-select"
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
              >
                <option value="" disabled>Scegli una persona...</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName || u.email}
                  </option>
                ))}
              </select>
            )}

            <button className="g-submit" style={{ marginTop: 16 }} disabled={!targetUid || busy} onClick={send}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <User size={15} /> {busy ? "Invio..." : "Assegna"}
              </span>
            </button>
          </>
        )}

        {error && (
          <div style={{ color: "var(--accent)", fontSize: 12.5, marginTop: 12 }}>
            Errore: {error}
          </div>
        )}
      </div>
    </div>
  );
}
