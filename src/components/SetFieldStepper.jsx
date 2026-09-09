// Campo numerico con i tasti −/+ incorporati nella stessa casella
export default function SetFieldStepper({ value, step, min = 0, onChange, mono }) {
  const bump = (delta) => {
    const next = Math.max(min, Math.round(((Number(value) || 0) + delta) / step) * step);
    // Arrotonda gli errori di virgola mobile (es. 0.1 + 0.2) a 2 decimali
    onChange(Math.round(next * 100) / 100);
  };
  return (
    <div className="g-inline-stepper">
      <button type="button" className="g-inline-stepper-btn" onClick={() => bump(-step)}>−</button>
      <input
        className={`g-inline-stepper-input${mono ? " ghisa-mono" : ""}`}
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="g-inline-stepper-btn" onClick={() => bump(step)}>+</button>
    </div>
  );
}
