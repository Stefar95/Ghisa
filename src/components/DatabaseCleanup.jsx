import { useState } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { AlertTriangle, Trash2 } from "lucide-react";
import { db } from "../firebase";

const TARGETS = [
  {
    id: "esercizi",
    label: "Esercizi",
    hint: "Svuota l'anagrafica condivisa (nomi e parti del corpo).",
  },
  {
    id: "allenamenti",
    label: "Allenamenti",
    hint: "Cancella lo storico allenamenti e le sessioni in sospeso di TUTTI gli utenti.",
  },
  {
    id: "schede",
    label: "Schede",
    hint: "Cancella le schede di TUTTI gli utenti.",
  },
  {
    id: "utenti",
    label: "Utenti",
    hint: "Svuota l'elenco utenti e i ruoli Personal Trainer. Chi rientra viene registrato di nuovo.",
  },
];

export default function DatabaseCleanup({ onLocalWipe }) {
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const run = async () => {
    if (selected.length === 0) return;
    const labels = TARGETS.filter((t) => selected.includes(t.id)).map((t) => t.label).join(", ");
    const typed = window.prompt(
      `Stai per eliminare DEFINITIVAMENTE questi dati per tutti gli utenti:\n\n${labels}\n\nL'operazione non si può annullare.\nScrivi ELIMINA per confermare.`
    );
    if (typed !== "ELIMINA") return;

    setBusy(true);
    setError(null);
    setResult(null);
    const done = [];

    try {
      if (selected.includes("esercizi")) {
        await setDoc(doc(db, "shared", "registry"), { exercises: [], exerciseMeta: {} }, { merge: true });
        done.push("esercizi");
      }

      if (selected.includes("allenamenti") || selected.includes("schede")) {
        const snap = await getDocs(collection(db, "users"));
        const patch = {};
        if (selected.includes("allenamenti")) {
          patch.logs = [];
          patch.draftSession = null;
        }
        if (selected.includes("schede")) patch.schede = [];
        await Promise.all(snap.docs.map((d) => setDoc(d.ref, patch, { merge: true })));
        if (selected.includes("allenamenti")) done.push("allenamenti");
        if (selected.includes("schede")) done.push("schede");
      }

      if (selected.includes("utenti")) {
        const snap = await getDocs(collection(db, "directory"));
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        done.push("utenti");
      }

      // Ripulisce anche la copia locale, altrimenti su questo dispositivo
      // continueresti a vedere i vecchi dati in cache.
      if (onLocalWipe) onLocalWipe(selected);

      setSelected([]);
      setResult(`Eliminati: ${done.join(", ")}.`);
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="g-danger-banner">
        <AlertTriangle size={15} />
        <span>
          Queste operazioni cancellano i dati <strong>per tutti gli utenti</strong> e non sono
          reversibili.
        </span>
      </div>

      <div className="g-card" style={{ padding: "4px 14px" }}>
        {TARGETS.map((t) => (
          <label className="g-reg-row" key={t.id} style={{ cursor: "pointer", alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={selected.includes(t.id)}
              onChange={() => toggle(t.id)}
              style={{ width: 16, height: 16, accentColor: "var(--accent)", flexShrink: 0, marginTop: 3 }}
            />
            <div style={{ flex: 1, marginLeft: 10 }}>
              <div className="g-reg-name">{t.label}</div>
              <div className="g-reg-count">{t.hint}</div>
            </div>
          </label>
        ))}
      </div>

      <button
        className="g-submit"
        style={{ marginTop: 14 }}
        disabled={selected.length === 0 || busy}
        onClick={run}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Trash2 size={15} />
          {busy ? "Eliminazione in corso..." : `Elimina selezionati (${selected.length})`}
        </span>
      </button>

      {result && (
        <div className="g-card g-empty" style={{ padding: 16, marginTop: 12, color: "var(--success)" }}>
          {result}
        </div>
      )}
      {error && (
        <div className="g-card g-empty" style={{ padding: 16, marginTop: 12, color: "var(--accent)" }}>
          Errore: {error}
          <div style={{ color: "var(--ink-dim)", fontSize: 12, marginTop: 6 }}>
            Se parla di permessi, controlla che le regole Firestore diano all'admin accesso in
            lettura e scrittura sulle raccolte users e directory.
          </div>
        </div>
      )}
    </div>
  );
}
