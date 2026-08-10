import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { X, Copy } from "lucide-react";
import { db } from "../firebase";
import { uid, getDays } from "../lib/utils";

export default function DuplicateSchedaModal({ scheda, fromUser, canAssign, onClose, onDuplicate }) {
  const already = scheda.assignedTo || [];
  const [name, setName] = useState(`${scheda.name} (copia)`);
  const [dest, setDest] = useState(already.length ? "same" : "me");
  const [targetUid, setTargetUid] = useState("");
  const [users, setUsers] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canAssign) return;
    const unsub = onSnapshot(
      collection(db, "directory"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u) => u.uid !== fromUser?.uid)
          .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
        setUsers(list);
      },
      (e) => {
        console.error(e);
        setUsers([]);
      }
    );
    return unsub;
  }, [canAssign, fromUser]);

  // Invia una copia nella casella di consegna del destinatario
  const sendTo = async (target, days) => {
    const id = uid();
    await setDoc(doc(db, "assignments", id), {
      id,
      toUid: target.uid,
      fromName: fromUser?.displayName || fromUser?.email || "",
      scheda: { name: name.trim(), days },
      createdAt: Date.now(),
    });
  };

  const confirm = async () => {
    const finalName = name.trim() || `${scheda.name} (copia)`;
    const days = JSON.parse(JSON.stringify(getDays(scheda))).map((d) => ({ ...d, id: uid() }));

    setBusy(true);
    setError(null);
    try {
      let assignedTo = [];
      if (dest === "same") {
        assignedTo = already;
        await Promise.all(already.map((t) => sendTo(t, days)));
      } else if (dest === "other") {
        const target = (users || []).find((u) => u.uid === targetUid);
        if (!target) {
          setError("Scegli una persona.");
          setBusy(false);
          return;
        }
        const info = { uid: target.uid, name: target.displayName || target.email || "Utente" };
        assignedTo = [info];
        await sendTo(info, days);
      }
      onDuplicate({ id: uid(), name: finalName, days, assignedTo });
      onClose();
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="g-modal-overlay" onClick={onClose}>
      <div className="g-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <Copy size={17} color="var(--accent)" /> Duplica scheda
          </div>
          <button className="g-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <label className="g-field-label" style={{ marginTop: 16 }}>Nome della copia</label>
        <input className="g-input" value={name} onChange={(e) => setName(e.target.value)} />

        {canAssign && (
          <>
            <label className="g-field-label" style={{ marginTop: 16 }}>Assegna la copia a</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="g-checkbox-row" style={{ marginTop: 0 }}>
                <input type="radio" name="dest" checked={dest === "me"} onChange={() => setDest("me")} />
                A me stesso
              </label>
              {already.length > 0 && (
                <label className="g-checkbox-row" style={{ marginTop: 0 }}>
                  <input type="radio" name="dest" checked={dest === "same"} onChange={() => setDest("same")} />
                  Alle stesse persone ({already.map((t) => t.name).join(", ")})
                </label>
              )}
              <label className="g-checkbox-row" style={{ marginTop: 0 }}>
                <input type="radio" name="dest" checked={dest === "other"} onChange={() => setDest("other")} />
                A un'altra persona
              </label>
            </div>

            {dest === "other" && (
              <select
                className="g-input g-select"
                style={{ marginTop: 8 }}
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
              >
                <option value="" disabled>Scegli una persona...</option>
                {(users || []).map((u) => (
                  <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                ))}
              </select>
            )}
          </>
        )}

        {error && (
          <div style={{ color: "var(--accent)", fontSize: 12.5, marginTop: 10 }}>{error}</div>
        )}

        <button className="g-submit" disabled={busy} onClick={confirm}>
          {busy ? "Creazione..." : "Duplica"}
        </button>
      </div>
    </div>
  );
}
