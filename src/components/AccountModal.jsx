import { User, X, LogOut, ShieldCheck, Dumbbell } from "lucide-react";

export default function AccountModal({ authUser, isAdmin, isPT, onSignOut, onClose }) {
  if (!authUser) return null;

  const roleLabel = isAdmin ? "Admin" : isPT ? "Personal Trainer" : "Utente";

  return (
    <div className="g-modal-overlay" onClick={onClose}>
      <div className="g-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="g-title ghisa-display" style={{ fontSize: 20 }}>
            <User size={20} color="var(--accent)" /> Account
          </div>
          <button className="g-icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={16} />
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          {authUser.photoURL ? (
            <img
              src={authUser.photoURL}
              alt=""
              style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid var(--line)" }}
            />
          ) : (
            <div
              style={{
                width: 64, height: 64, borderRadius: "50%", background: "var(--surface-2)",
                border: "2px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto",
              }}
            >
              <User size={28} color="var(--ink-dim)" />
            </div>
          )}
          <div style={{ fontWeight: 600, fontSize: 15, marginTop: 10 }}>
            {authUser.displayName || authUser.email}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 2 }}>{authUser.email}</div>

          <div style={{ marginTop: 10 }}>
            {isAdmin || isPT ? (
              <span className="g-pr-badge">
                {isAdmin ? <ShieldCheck size={12} /> : <Dumbbell size={12} />} {roleLabel}
              </span>
            ) : (
              <span className="g-part-badge">{roleLabel}</span>
            )}
          </div>
        </div>

        <button
          className="g-submit"
          style={{ marginTop: 22, background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
          onClick={() => {
            onSignOut();
            onClose();
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <LogOut size={15} /> Esci
          </span>
        </button>
      </div>
    </div>
  );
}
