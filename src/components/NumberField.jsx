import { useState, useEffect } from "react";

// Campo numero intero con gli step +/- incorporati nella textbox (stesso
// aspetto di DurationField, ma senza formato mm:ss): usato per Serie e
// Ripetizioni min/max. Il valore resta comunque scrivibile a mano.
export default function NumberField({ value, onChange, step = 1, min = 1, max }) {
  const [text, setText] = useState(String(value ?? ""));

  useEffect(() => {
    setText(String(value ?? ""));
  }, [value]);

  const clamp = (n) => {
    let v = Number.isFinite(n) ? n : min ?? 0;
    if (typeof min === "number") v = Math.max(min, v);
    if (typeof max === "number") v = Math.min(max, v);
    return v;
  };

  const commit = (n) => {
    const v = clamp(n);
    onChange(v);
    setText(String(v));
  };

  return (
    <div className="g-duration-field">
      <button
        type="button"
        className="g-duration-btn g-duration-btn-left"
        onClick={() => commit((value || 0) - step)}
        aria-label={`Meno ${step}`}
      >
        −
      </button>
      <input
        className="g-duration-input ghisa-mono"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => commit(parseInt(text) || 0)}
        inputMode="numeric"
      />
      <button
        type="button"
        className="g-duration-btn g-duration-btn-right"
        onClick={() => commit((value || 0) + step)}
        aria-label={`Più ${step}`}
      >
        +
      </button>
    </div>
  );
}
