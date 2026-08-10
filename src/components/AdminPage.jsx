import { Lock, Unlock } from "lucide-react";
import ExerciseRegistry from "./ExerciseRegistry";

export default function AdminPage({
  exercises,
  exerciseMeta,
  logs,
  authUser,
  isAdmin,
  authLoading,
  onSignIn,
  onSignOut,
  onAddExercise,
  onRemoveExercise,
  onMergeExercises,
  onRenameExercise,
  onSetBodyParts,
}) {
  if (authLoading) {
    return <div className="g-card g-empty">Verifica accesso...</div>;
  }

  if (!authUser) {
    return (
      <div className="g-card" style={{ textAlign: "center", padding: "34px 20px" }}>
        <Lock size={26} color="var(--ink-dim)" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 600, fontSize: 15 }}>Accesso riservato</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 4, marginBottom: 16 }}>
          Accedi con Google per gestire l'anagrafica esercizi.
        </div>
        <button className="g-empty-cta" onClick={onSignIn}>Accedi con Google</button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="g-card" style={{ textAlign: "center", padding: "34px 20px" }}>
        <Lock size={26} color="var(--accent)" style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 600, fontSize: 15 }}>Non sei autorizzato</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 4, marginBottom: 16 }}>
          Hai fatto accesso come {authUser.email}, ma questo non è l'account admin.
        </div>
        <button className="g-icon-btn" onClick={onSignOut}>Esci e cambia account</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="g-field-label" style={{ marginBottom: 0 }}>Anagrafica esercizi</div>
        <button className="g-icon-btn" onClick={onSignOut} style={{ fontSize: 12, gap: 5 }}>
          <Unlock size={13} /> Esci
        </button>
      </div>
      <ExerciseRegistry
        exercises={exercises}
        exerciseMeta={exerciseMeta}
        logs={logs}
        onAdd={onAddExercise}
        onRemove={onRemoveExercise}
        onMerge={onMergeExercises}
        onRename={onRenameExercise}
        onSetBodyParts={onSetBodyParts}
      />
    </div>
  );
}

