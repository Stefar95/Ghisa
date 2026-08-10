// Corpo umano (fronte/retro) con le parti allenate evidenziate

export default function BodyDiagram({ selected = [], size = 90 }) {
  const c = (part) => (selected.includes(part) ? "var(--accent)" : "var(--surface-2)");
  const stroke = "var(--line)";
  const h = Math.round(size * 1.75);

  return (
    <div style={{ display: "flex", gap: 18, justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ textAlign: "center" }}>
        <svg width={size} height={h} viewBox="0 0 100 175" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="16" r="13" fill="var(--line)" />
          <rect x="44" y="27" width="12" height="10" fill="var(--line)" />
          <ellipse cx="24" cy="46" rx="11" ry="9" fill={c("Spalle")} stroke={stroke} strokeWidth="1" />
          <ellipse cx="76" cy="46" rx="11" ry="9" fill={c("Spalle")} stroke={stroke} strokeWidth="1" />
          <rect x="34" y="40" width="32" height="26" rx="6" fill={c("Petto")} stroke={stroke} strokeWidth="1" />
          <rect x="36" y="68" width="28" height="30" rx="6" fill={c("Core")} stroke={stroke} strokeWidth="1" />
          <rect x="12" y="50" width="12" height="34" rx="6" fill={c("Bicipiti")} stroke={stroke} strokeWidth="1" />
          <rect x="76" y="50" width="12" height="34" rx="6" fill={c("Bicipiti")} stroke={stroke} strokeWidth="1" />
          <rect x="10" y="84" width="11" height="34" rx="5" fill={c("Avambracci")} stroke={stroke} strokeWidth="1" />
          <rect x="79" y="84" width="11" height="34" rx="5" fill={c("Avambracci")} stroke={stroke} strokeWidth="1" />
          <rect x="34" y="100" width="14" height="60" rx="6" fill={c("Gambe")} stroke={stroke} strokeWidth="1" />
          <rect x="52" y="100" width="14" height="60" rx="6" fill={c("Gambe")} stroke={stroke} strokeWidth="1" />
          <rect x="33" y="160" width="16" height="10" rx="4" fill="var(--line)" />
          <rect x="51" y="160" width="16" height="10" rx="4" fill="var(--line)" />
        </svg>
        <div className="g-diagram-label">Fronte</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <svg width={size} height={h} viewBox="0 0 100 175" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="16" r="13" fill="var(--line)" />
          <rect x="44" y="27" width="12" height="10" fill="var(--line)" />
          <ellipse cx="24" cy="46" rx="11" ry="9" fill={c("Spalle")} stroke={stroke} strokeWidth="1" />
          <ellipse cx="76" cy="46" rx="11" ry="9" fill={c("Spalle")} stroke={stroke} strokeWidth="1" />
          <rect x="32" y="40" width="36" height="34" rx="8" fill={c("Schiena")} stroke={stroke} strokeWidth="1" />
          <rect x="12" y="50" width="12" height="34" rx="6" fill={c("Tricipiti")} stroke={stroke} strokeWidth="1" />
          <rect x="76" y="50" width="12" height="34" rx="6" fill={c("Tricipiti")} stroke={stroke} strokeWidth="1" />
          <rect x="10" y="84" width="11" height="34" rx="5" fill="var(--line)" />
          <rect x="79" y="84" width="11" height="34" rx="5" fill="var(--line)" />
          <rect x="34" y="76" width="32" height="24" rx="10" fill={c("Glutei")} stroke={stroke} strokeWidth="1" />
          <rect x="34" y="100" width="14" height="30" rx="6" fill="var(--line)" />
          <rect x="52" y="100" width="14" height="30" rx="6" fill="var(--line)" />
          <rect x="34" y="130" width="14" height="30" rx="6" fill={c("Polpacci")} stroke={stroke} strokeWidth="1" />
          <rect x="52" y="130" width="14" height="30" rx="6" fill={c("Polpacci")} stroke={stroke} strokeWidth="1" />
          <rect x="33" y="160" width="16" height="10" rx="4" fill="var(--line)" />
          <rect x="51" y="160" width="16" height="10" rx="4" fill="var(--line)" />
        </svg>
        <div className="g-diagram-label">Retro</div>
      </div>
    </div>
  );
}

