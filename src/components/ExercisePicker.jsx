import { useState, useRef } from "react";
import { Lock } from "lucide-react";

export default function ExercisePicker({ exercises, value, onChange, placeholder, locked }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const query = value || "";
  const matches = exercises
    .filter((e) => e.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);
  const exactMatch = exercises.some((e) => e.toLowerCase() === query.trim().toLowerCase());

  if (locked) {
    return (
      <div className="g-locked-field">
        <Lock size={13} color="var(--ink-dim)" />
        {value}
      </div>
    );
  }

  return (
    <div className="g-autocomplete-wrap" ref={wrapRef}>
      <input
        className="g-input"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && (
        <div className="g-autocomplete-list">
          {matches.map((m) => (
            <div
              key={m}
              className="g-autocomplete-item"
              onMouseDown={() => {
                onChange(m);
                setOpen(false);
              }}
            >
              {m}
            </div>
          ))}
          {query.trim() && !exactMatch && (
            <div
              className="g-autocomplete-item g-autocomplete-new"
              onMouseDown={() => setOpen(false)}
            >
              Non lo trovi? Inserisci: "{query.trim()}"
            </div>
          )}
          {matches.length === 0 && !query.trim() && (
            <div className="g-autocomplete-item" style={{ color: "var(--ink-dim)", cursor: "default" }}>
              Scrivi per cercare o aggiungere un esercizio
            </div>
          )}
        </div>
      )}
    </div>
  );
}

