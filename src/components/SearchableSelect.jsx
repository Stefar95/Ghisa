import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";

// Sostituisce una <select> quando le opzioni sono tante (es. tutti gli
// esercizi svolti): al posto del menu nativo apre un elenco con un campo di
// ricerca in cima, così non serve scorrere tutto a mano.
export default function SearchableSelect({ options, value, onChange, placeholder = "Cerca..." }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const matches = q.trim()
    ? options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()))
    : options;

  return (
    <div className="g-autocomplete-wrap" ref={wrapRef} style={{ flex: 1, minWidth: 0 }}>
      <button
        type="button"
        className="g-input g-select g-searchable-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={15} style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <div className="g-autocomplete-list">
          <div className="g-search-field" style={{ margin: 8 }}>
            <Search size={14} />
            <input
              className="g-input"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
            />
          </div>
          {matches.length === 0 ? (
            <div className="g-autocomplete-item" style={{ color: "var(--ink-dim)", cursor: "default" }}>
              Nessun risultato.
            </div>
          ) : (
            matches.map((o) => (
              <div
                key={o}
                className="g-autocomplete-item"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
              >
                {o}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
