import { useState } from "react";
import { Lock, Unlock } from "lucide-react";
import ExerciseRegistry from "./ExerciseRegistry";
import UserManagement from "./UserManagement";
import DatabaseCleanup from "./DatabaseCleanup";

export default function AdminPage({
  exercises,
  exerciseMeta,
  logs,
  totalLogCounts,
  totalsLoading,
  onRefreshTotals,
  authUser,
  isAdmin,
  isPT,
  authLoading,
  onSignIn,
  onSignOut,
  onAddExercise,
  onRemoveExercise,
  onMergeExercises,
  onRenameExercise,
  onSetBodyParts,
  onLocalWipe,
}) {
  const [section, setSection] = useState("esercizi"); // 'esercizi' | 'utenti'

  if (authLoading) {
    return <div className="g-card g-empty">Verifica accesso...</div>;
  }

  if (!authUser) {
    return (
      <div className="g-card" style={{ textAlign: "center", padding: "34px 20px" }}>
        <Lock size={26} color="var(--ink-dim)" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 600, fontSize: 15 }}>Accesso riservato</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 4, marginBottom: 16 }}>
          Accedi con Google per continuare.
        </div>
        <button className="g-empty-cta" onClick={onSignIn}>Accedi con Google</button>
      </div>
    );
  }

  if (!isAdmin && !isPT) {
    return (
      <div className="g-card" style={{ textAlign: "center", padding: "34px 20px" }}>
        <Lock size={26} color="var(--accent)" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 600, fontSize: 15 }}>Non sei autorizzato</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 4, marginBottom: 16 }}>
          Hai fatto accesso come {authUser.email}, ma il tuo account non ha i permessi per questa sezione.
        </div>
        <button className="g-icon-btn" onClick={onSignOut}>Esci e cambia account</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="g-field-label" style={{ marginBottom: 0 }}>
          {isAdmin ? "Amministrazione" : "Personal Trainer"}
        </div>
        <button className="g-icon-btn" onClick={onSignOut} style={{ fontSize: 12, gap: 5 }}>
          <Unlock size={13} /> Esci
        </button>
      </div>

      {isAdmin && (
        <div className="g-admin-subtabs">
          <div
            className={`g-admin-subtab ${section === "esercizi" ? "active" : ""}`}
            onClick={() => setSection("esercizi")}
          >
            Esercizi
          </div>
          <div
            className={`g-admin-subtab ${section === "utenti" ? "active" : ""}`}
            onClick={() => setSection("utenti")}
          >
            Utenti
          </div>
          <div
            className={`g-admin-subtab ${section === "pulizia" ? "active" : ""}`}
            onClick={() => setSection("pulizia")}
          >
            Pulizia
          </div>
        </div>
      )}

      {(!isAdmin || section === "esercizi") && (
        <ExerciseRegistry
          exercises={exercises}
          exerciseMeta={exerciseMeta}
          logs={logs}
          totalLogCounts={totalLogCounts}
          totalsLoading={totalsLoading}
          onRefreshTotals={onRefreshTotals}
          onAdd={onAddExercise}
          onRemove={onRemoveExercise}
          onMerge={onMergeExercises}
          onRename={onRenameExercise}
          onSetBodyParts={onSetBodyParts}
        />
      )}

      {isAdmin && section === "utenti" && <UserManagement currentUid={authUser.uid} />}

      {isAdmin && section === "pulizia" && <DatabaseCleanup onLocalWipe={onLocalWipe} />}
    </div>
  );
}
