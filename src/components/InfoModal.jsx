import { Dumbbell, X, Heart } from "lucide-react";
import * as appConfig from "../config";

// Accetta sia SATISPAY_LINK sia i vecchi nomi, così config.js non va per forza toccato
const cfg = appConfig;
const DONATION_LINK =
  cfg["SATISPAY_LINK"] || cfg["DONATION_LINK"] || cfg["PAYPAL_LINK"] || "";
const isValidLink = /^https?:\/\//i.test(DONATION_LINK.trim());

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

        {(
          <div className="g-donate-box">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Heart size={15} color="var(--accent)" />
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Sostieni il progetto</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-dim)", margin: "0 0 12px 0", lineHeight: 1.5 }}>
              GHISA è gratuita e senza pubblicità. Se ti è utile, puoi offrire un caffè
              a chi la sviluppa.
            </p>
            {isValidLink ? (
              <a
                href={DONATION_LINK.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="g-empty-cta"
                style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 0 }}
              >
                Dona con Satispay
              </a>
            ) : (
              <div style={{ fontSize: 11.5, color: "var(--ink-dim)", fontStyle: "italic" }}>
                {DONATION_LINK.trim()
                  ? <>Il valore in <code>src/config.js</code> non è un link valido: deve iniziare con https://</>
                  : <>Link Satispay non ancora configurato: impostalo in <code>src/config.js</code>.</>}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

