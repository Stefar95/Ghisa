import { Dumbbell, X } from "lucide-react";
import { PAYPAL_LINK } from "../config";

export default function InfoModal({ isAdmin, onClose }) {
  return (
    <div className="g-modal-overlay" onClick={onClose}>
      <div className="g-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="g-title ghisa-display" style={{ fontSize: 20 }}>
            <Dumbbell size={20} color="var(--accent)" /> GHISA
          </div>
          <button className="g-icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.6, marginTop: 12 }}>
          GHISA è la tua scheda di allenamento: crea le tue schede, registra gli allenamenti
          (con serie, ripetizioni, carico e back-off), e tieni traccia dei progressi nel tempo
          con statistiche dedicate. Pensata per essere usata comodamente dal telefono, in
          palestra.
        </p>

        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 14 }}>
          Ideata da <span style={{ color: "var(--ink)", fontWeight: 600 }}>Stefano</span>.
        </p>

        {isAdmin && PAYPAL_LINK && (
          <a
            href={PAYPAL_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="g-empty-cta"
            style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 16 }}
          >
            Offrimi un caffè su PayPal
          </a>
        )}
      </div>
    </div>
  );
}

