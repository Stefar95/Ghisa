import { useState, useRef } from "react";
import { Lock } from "lucide-react";
import { SEARCH_MIN_CHARS } from "../lib/utils";

export default function ExercisePicker({ exercises, value, onChange, placeholder, locked }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const query = value || "";
  const searching = query.trim().length >= SEARCH_MIN_CHARS;
  const matches = searching
    ? exercises.filter((e) => e.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];
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
          {!searching ? (
            <div className="g-autocomplete-item" style={{ color: "var(--ink-dim)", cursor: "default" }}>
              Scrivi almeno {SEARCH_MIN_CHARS} lettere per cercare o aggiungere un esercizio
            </div>
          ) : (
            <>
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
              {!exactMatch && (
                <div
                  className="g-autocomplete-item g-autocomplete-new"
                  onMouseDown={() => setOpen(false)}
                >
                  Non lo trovi? Inserisci: "{query.trim()}"
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

