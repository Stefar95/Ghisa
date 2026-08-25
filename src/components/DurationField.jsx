import { useState, useEffect } from "react";
import { formatMMSS, parseMMSS } from "../lib/utils";

// Campo durata mm:ss: gli step +/- stanno dentro la textbox (non a fianco),
// e il valore resta comunque scrivibile a mano, come il recupero.
export default function DurationField({ value, onChange, step = 15, min = 0 }) {
  const [text, setText] = useState(formatMMSS(value || 0));

  useEffect(() => {
    setText(formatMMSS(value || 0));
  }, [value]);

  const commit = (secs) => {
    const v = Math.max(min, secs);
    onChange(v);
    setText(formatMMSS(v));
  };

  return (
    <div className="g-duration-field">
      <button
        type="button"
        className="g-duration-btn g-duration-btn-left"
        onClick={() => commit((value || 0) - step)}
        aria-label={`Meno ${step} secondi`}
      >
        −
      </button>
      <input
        className="g-duration-input ghisa-mono"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => commit(parseMMSS(text))}
        inputMode="numeric"
      />
      <button
        type="button"
        className="g-duration-btn g-duration-btn-right"
        onClick={() => commit((value || 0) + step)}
        aria-label={`Più ${step} secondi`}
      >
        +
      </button>
    </div>
  );
}
