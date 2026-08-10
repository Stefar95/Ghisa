import { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Flame, FileDown } from "lucide-react";
import { formatDate, logSummary } from "../lib/utils";
import { exportStatsPDF, logRowsForPDF } from "../lib/exporters";

// Grafico singolo esercizio: linea top set + linea back-off se presente
// Per gli esercizi a corpo libero il carico è sempre 0: ha senso seguire
// le ripetizioni (o i secondi) invece del peso.
function chartMetric(logs) {
  const bodyweight = logs.length > 0 && logs.every((l) => l.noWeight || !l.weight);
  if (!bodyweight) return { key: "weight", unit: "kg", label: "Carico" };
  const timeBased = logs.some((l) => l.type === "time");
  return timeBased
    ? { key: "reps", unit: "s", label: "Durata" }
    : { key: "reps", unit: "rip", label: "Ripetizioni" };
}

function ExerciseChart({ logs, chartId, metric }) {
  const tops = logs.filter((l) => !l.backoff).sort((a, b) => (a.date + a.id > b.date + b.id ? 1 : -1));
  const bos = logs.filter((l) => l.backoff).sort((a, b) => (a.date + a.id > b.date + b.id ? 1 : -1));
  const hasBackoff = bos.length > 0;

  const topByDate = {};
  tops.forEach((l) => { topByDate[l.date] = l[metric.key]; });
  const boByDate = {};
  bos.forEach((l) => { boByDate[l.date] = l[metric.key]; });

  const allDates = Array.from(new Set([...tops.map((l) => l.date), ...bos.map((l) => l.date)])).sort();
  const data = allDates.map((date) => ({
    date,
    label: formatDate(date),
    peso: topByDate[date] ?? null,
    pesoBackoff: boByDate[date] ?? null,
  }));

  return (
    <>
      {hasBackoff && (
        <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-dim)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            Top set
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-dim)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--steel)", display: "inline-block" }} />
            Back-off
          </div>
        </div>
      )}
      <div style={{ width: "100%", height: 180, marginTop: 12 }} data-chart={chartId}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#8b8f96" strokeOpacity={0.3} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="#9ba1ab" fontSize={11} tickLine={false} axisLine={{ stroke: "#8b8f96" }} />
            <YAxis stroke="#9ba1ab" fontSize={11} tickLine={false} axisLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip
              contentStyle={{ background: "#1e2126", border: "1px solid #33383f", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#9ba1ab" }}
              formatter={(v, name) => [`${v} ${metric.unit}`, name === "pesoBackoff" ? "Back-off" : "Top set"]}
            />
            <Line type="monotone" dataKey="peso" stroke="#c1502e" strokeWidth={2.5}
              dot={{ r: 3, fill: "#c1502e", strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
            {hasBackoff && (
              <Line type="monotone" dataKey="pesoBackoff" stroke="#7c8b99" strokeWidth={2} strokeDasharray="4 3"
                dot={{ r: 3, fill: "#7c8b99", strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function StatBoxes({ logs, metric }) {
  const tops = logs.filter((l) => !l.backoff).sort((a, b) => (a.date + a.id > b.date + b.id ? 1 : -1));
  const val = (l) => l[metric.key] ?? 0;
  const current = tops.length ? val(tops[tops.length - 1]) : 0;
  const record = tops.length ? Math.max(...tops.map(val)) : 0;
  const first = tops.length ? val(tops[0]) : 0;
  const delta = current - first;

  return (
    <div className="g-stat-grid">
      <div className="g-stat-box">
        <div className="g-stat-num ghisa-mono">{record}</div>
        <div className="g-stat-label">Record {metric.unit}</div>
      </div>
      <div className="g-stat-box">
        <div className="g-stat-num ghisa-mono" style={{ color: delta >= 0 ? "var(--success)" : "var(--accent)" }}>
          {delta >= 0 ? "+" : ""}{delta}
        </div>
        <div className="g-stat-label">Da inizio</div>
      </div>
      <div className="g-stat-box">
        <div className="g-stat-num ghisa-mono">{tops.length}</div>
        <div className="g-stat-label">Sessioni</div>
      </div>
    </div>
  );
}

export default function StatsPage({ logs, goToLog }) {
  const [mode, setMode] = useState("esercizio"); // 'esercizio' | 'giorno'
  const [selectedEx, setSelectedEx] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef(null);

  // Solo gli esercizi che ho effettivamente svolto
  const doneExercises = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.exercise))).sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );
  }, [logs]);

  const days = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.dayName || "Giorno libero"))).sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );
  }, [logs]);

  useEffect(() => {
    if (doneExercises.length && !doneExercises.includes(selectedEx)) setSelectedEx(doneExercises[0]);
  }, [doneExercises, selectedEx]);

  useEffect(() => {
    if (days.length && !days.includes(selectedDay)) setSelectedDay(days[0]);
  }, [days, selectedDay]);

  const exLogs = useMemo(
    () => logs.filter((l) => l.exercise === selectedEx),
    [logs, selectedEx]
  );

  // Per la vista "giorno": elenco esercizi svolti in quel giorno, ciascuno coi propri log
  const dayGroups = useMemo(() => {
    const inDay = logs.filter((l) => (l.dayName || "Giorno libero") === selectedDay);
    const map = new Map();
    inDay.forEach((l) => {
      if (!map.has(l.exercise)) map.set(l.exercise, []);
      map.get(l.exercise).push(l);
    });
    return Array.from(map.entries()).map(([exercise, entries]) => ({ exercise, entries }));
  }, [logs, selectedDay]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const svgFor = (id) => {
        const box = containerRef.current?.querySelector(`[data-chart="${id}"]`);
        return box ? box.querySelector("svg") : null;
      };
      const today = new Date().toLocaleDateString("it-IT");

      if (mode === "esercizio") {
        await exportStatsPDF({
          title: selectedEx,
          subtitle: `Andamento carichi · generato il ${today}`,
          sections: [{ title: selectedEx, chartEl: svgFor("main"), rows: logRowsForPDF(exLogs) }],
        });
      } else {
        await exportStatsPDF({
          title: selectedDay,
          subtitle: `${dayGroups.length} esercizi · generato il ${today}`,
          sections: dayGroups.map((g) => ({
            title: g.exercise,
            chartEl: svgFor(g.exercise),
            rows: logRowsForPDF(g.entries),
          })),
        });
      }
    } catch (e) {
      console.error(e);
      alert("Non sono riuscito a generare il PDF. Riprova.");
    } finally {
      setExporting(false);
    }
  };

  if (logs.length === 0) {
    return (
      <div className="g-card g-empty">
        <TrendingUp size={30} color="var(--ink-dim)" style={{ margin: "0 auto 10px" }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
          Ancora nessun dato registrato
        </div>
        <div style={{ marginTop: 4, fontSize: 13 }}>
          Vai su Allenamento e registra il tuo primo allenamento per vedere i progressi qui.
        </div>
        <button className="g-empty-cta" onClick={goToLog}>Vai ad Allenamento</button>
      </div>
    );
  }

  const exMetric = chartMetric(exLogs);
  const currentTop = exLogs.filter((l) => !l.backoff).sort((a, b) => (a.date + a.id > b.date + b.id ? 1 : -1));
  const currentValue = currentTop.length ? currentTop[currentTop.length - 1][exMetric.key] ?? 0 : 0;
  const recordValue = currentTop.length ? Math.max(...currentTop.map((l) => l[exMetric.key] ?? 0)) : 0;
  const isPR = currentTop.length > 0 && currentValue === recordValue;

  return (
    <div ref={containerRef}>
      <div className="g-admin-subtabs">
        <div
          className={`g-admin-subtab ${mode === "esercizio" ? "active" : ""}`}
          onClick={() => setMode("esercizio")}
        >
          Per esercizio
        </div>
        <div
          className={`g-admin-subtab ${mode === "giorno" ? "active" : ""}`}
          onClick={() => setMode("giorno")}
        >
          Per giorno
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {mode === "esercizio" ? (
          <select
            className="g-input g-select"
            value={selectedEx}
            onChange={(e) => setSelectedEx(e.target.value)}
          >
            {doneExercises.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        ) : (
          <select
            className="g-input g-select"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            {days.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
        <button
          className="g-icon-btn"
          style={{ flexShrink: 0, padding: "0 14px", gap: 6, fontSize: 12.5 }}
          onClick={handleExport}
          disabled={exporting}
          title="Scarica PDF"
        >
          <FileDown size={15} /> {exporting ? "..." : "PDF"}
        </button>
      </div>

      {mode === "esercizio" ? (
        <>
          <div className="g-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="g-field-label" style={{ marginBottom: 2 }}>{selectedEx}</div>
                <div className="ghisa-mono" style={{ fontSize: 34, fontWeight: 700 }}>
                  {currentValue}
                  <span style={{ fontSize: 14, color: "var(--ink-dim)", marginLeft: 4 }}>{exMetric.unit}</span>
                </div>
              </div>
              {isPR && (
                <span className="g-pr-badge">
                  <Flame size={12} /> Record personale
                </span>
              )}
            </div>
            <ExerciseChart logs={exLogs} chartId="main" metric={exMetric} />
            <StatBoxes logs={exLogs} metric={exMetric} />
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="g-field-label">Ultimi allenamenti — {selectedEx}</div>
            <div className="g-card" style={{ padding: "4px 14px" }}>
              {exLogs
                .slice()
                .sort((a, b) => (a.id < b.id ? 1 : -1))
                .slice(0, 5)
                .map((l) => (
                  <div className="g-history-row" key={l.id}>
                    <div className="g-history-date">{formatDate(l.date)}</div>
                    <div className="g-history-main">
                      <div className="g-history-sets">
                        {logSummary(l)}
                        {l.backoff && <span style={{ color: "var(--steel)" }}> · back-off</span>}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {dayGroups.length === 0 ? (
            <div className="g-card g-empty" style={{ padding: 24 }}>
              Nessun esercizio registrato per questo giorno.
            </div>
          ) : (
            dayGroups.map((g) => (
              <div className="g-card" key={g.exercise}>
                <div className="g-field-label" style={{ marginBottom: 2 }}>{g.exercise}</div>
                <ExerciseChart logs={g.entries} chartId={g.exercise} metric={chartMetric(g.entries)} />
                <StatBoxes logs={g.entries} metric={chartMetric(g.entries)} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
