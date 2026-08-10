export const STEPS = [0.5, 1.25, 2.5, 5, 10];

export const BODY_PARTS = [
  "Petto", "Schiena", "Spalle", "Bicipiti", "Tricipiti",
  "Avambracci", "Gambe", "Glutei", "Polpacci", "Core",
];

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function confirmThen(message, fn) {
  if (window.confirm(message)) fn();
}

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
