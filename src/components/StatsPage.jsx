import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Flame } from "lucide-react";
import { formatDate } from "../lib/utils";

export default function StatsPage({ exercises, logs, goToLog }) {
  const exWithLogs = useMemo(
    () => exercises.filter((e) => logs.some((l) => l.exercise === e)),
    [exercises, logs]
  );
  const [selected, setSelected] = useState(exWithLogs[0] || "");

  useEffect(() => {
    if (!selected && exWithLogs.length) setSelected(exWithLogs[0]);
    if (selected && !exWithLogs.includes(selected) && exWithLogs.length) {
      setSelected(exWithLogs[0]);
    }
  }, [exWithLogs, selected]);

  if (exWithLogs.length === 0) {
    return (
      <div className="g-card g-empty">
        <TrendingUp size={30} color="var(--ink-dim)" style={{ margin: "0 auto 10px" }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
          Ancora nessun dato registrato
        </div>
        <div style={{ marginTop: 4, fontSize: 13 }}>
          Vai su Scheda e registra il tuo primo allenamento per vedere i progressi qui.
        </div>
        <button className="g-empty-cta" onClick={goToLog}>Vai ad Allenamento</button>
      </div>
    );
  }

  const exLogs = logs
    .filter((l) => l.exercise === selected && !l.backoff)
    .slice()
    .sort((a, b) => (a.date + a.id > b.date + b.id ? 1 : -1));

  const backoffLogs = logs
    .filter((l) => l.exercise === selected && l.backoff)
    .slice()
    .sort((a, b) => (a.date + a.id > b.date + b.id ? 1 : -1));

  const hasBackoff = backoffLogs.length > 0;

  const topByDate = {};
  exLogs.forEach((l) => { topByDate[l.date] = l.weight; });
  const backoffByDate = {};
  backoffLogs.forEach((l) => { backoffByDate[l.date] = l.weight; });

  const allDates = Array.from(new Set([...exLogs.map((l) => l.date), ...backoffLogs.map((l) => l.date)])).sort();

  const chartData = allDates.map((date) => ({
    date,
    label: formatDate(date),
    peso: topByDate[date] ?? null,
    pesoBackoff: backoffByDate[date] ?? null,
  }));

  const current = exLogs[exLogs.length - 1]?.weight ?? 0;
  const record = Math.max(...exLogs.map((l) => l.weight));
  const first = exLogs[0]?.weight ?? 0;
  const delta = current - first;
  const isPR = current === record;

  const recentHistory = logs
    .filter((l) => l.exercise === selected)
    .slice()
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .slice(0, 5);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {exWithLogs.map((e) => (
          <button
            key={e}
            className={`g-chip ${selected === e ? "active" : ""}`}
            onClick={() => setSelected(e)}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="g-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="g-field-label" style={{ marginBottom: 2 }}>{selected}</div>
            <div className="ghisa-mono" style={{ fontSize: 34, fontWeight: 700 }}>
              {current}
              <span style={{ fontSize: 14, color: "var(--ink-dim)", marginLeft: 4 }}>kg</span>
            </div>
          </div>
          {isPR && (
            <span className="g-pr-badge">
              <Flame size={12} /> Record personale
            </span>
          )}
        </div>

        {hasBackoff && (
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
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

        <div style={{ width: "100%", height: 180, marginTop: 14 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#33383f" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#9ba1ab"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#33383f" }}
              />
              <YAxis
                stroke="#9ba1ab"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 5", "dataMax + 5"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e2126",
                  border: "1px solid #33383f",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#9ba1ab" }}
                formatter={(v, name) => [`${v} kg`, name === "pesoBackoff" ? "Back-off" : "Top set"]}
              />
              <Line
                type="monotone"
                dataKey="peso"
                stroke="#c1502e"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#c1502e", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
              {hasBackoff && (
                <Line
                  type="monotone"
                  dataKey="pesoBackoff"
                  stroke="#7c8b99"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 3, fill: "#7c8b99", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="g-stat-grid">
          <div className="g-stat-box">
            <div className="g-stat-num ghisa-mono">{record}</div>
            <div className="g-stat-label">Record kg</div>
          </div>
          <div className="g-stat-box">
            <div className="g-stat-num ghisa-mono" style={{ color: delta >= 0 ? "var(--success)" : "var(--accent)" }}>
              {delta >= 0 ? "+" : ""}{delta}
            </div>
            <div className="g-stat-label">Da inizio</div>
          </div>
          <div className="g-stat-box">
            <div className="g-stat-num ghisa-mono">{exLogs.length}</div>
            <div className="g-stat-label">Sessioni</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="g-field-label">Ultimi allenamenti — {selected}</div>
        <div className="g-card" style={{ padding: "4px 14px" }}>
          {recentHistory.map((l) => (
            <div className="g-history-row" key={l.id}>
              <div className="g-history-date">{formatDate(l.date)}</div>
              <div className="g-history-main">
                <div className="g-history-sets">
                  {l.sets} x {l.reps} @ {l.weight} kg
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

