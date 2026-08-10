import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { ShieldCheck, Dumbbell, UserCheck } from "lucide-react";
import { db } from "../firebase";
import { confirmThen } from "../lib/utils";
import { ADMIN_EMAIL } from "../config";

export default function UserManagement({ currentUid }) {
  const [users, setUsers] = useState(null); // null = caricamento
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "directory"),
      (snap) => {
        const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
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
  }, []);

  const togglePT = (u) => {
    const makingPT = !u.isPT;
    confirmThen(
      makingPT
        ? `Rendere ${u.displayName || u.email} Personal Trainer? Potrà accedere e modificare l'anagrafica esercizi.`
        : `Togliere il ruolo Personal Trainer a ${u.displayName || u.email}?`,
      () => {
        setDoc(doc(db, "directory", u.uid), { isPT: makingPT }, { merge: true }).catch((e) => console.error(e));
      }
    );
  };

  if (users === null) {
    return <div className="g-card g-empty">Caricamento utenti...</div>;
  }

  if (error) {
    return (
      <div className="g-card g-empty" style={{ padding: 24, color: "var(--accent)" }}>
        Errore nel leggere gli utenti: {error}
        <div style={{ color: "var(--ink-dim)", fontSize: 12, marginTop: 8 }}>
          Controlla di aver pubblicato le regole Firestore aggiornate e che l'email nelle regole
          corrisponda esattamente (maiuscole/minuscole comprese) a quella in src/config.js.
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return <div className="g-card g-empty" style={{ padding: 24 }}>Nessun utente ha ancora fatto accesso.</div>;
  }

  return (
    <div>
      <div className="g-field-label">Utenti registrati ({users.length})</div>
      <div className="g-card" style={{ padding: "4px 14px" }}>
        {users.map((u) => {
          const isThisAdmin = u.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
          return (
            <div className="g-reg-row" key={u.uid}>
              <div>
                <div className="g-reg-name">
                  {u.displayName || u.email}
                  {u.uid === currentUid && <span style={{ color: "var(--ink-dim)", fontWeight: 400 }}> (tu)</span>}
                </div>
                <div className="g-reg-count">{u.email}</div>
              </div>
              <div>
                {isThisAdmin ? (
                  <span className="g-pr-badge">
                    <ShieldCheck size={12} /> Admin
                  </span>
                ) : u.isPT ? (
                  <button className="g-pr-badge" style={{ border: "none", cursor: "pointer" }} onClick={() => togglePT(u)}>
                    <Dumbbell size={12} /> Personal Trainer
                  </button>
                ) : (
                  <button className="g-icon-btn" style={{ fontSize: 11.5, gap: 5 }} onClick={() => togglePT(u)}>
                    <UserCheck size={13} /> Rendi PT
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
