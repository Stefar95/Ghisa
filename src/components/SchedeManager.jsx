import { useState, useEffect, useRef } from "react";
import {
  Trash2, Plus, Pencil, X, FileSpreadsheet, FileDown, Copy, Send, Inbox,
  CalendarDays, ChevronLeft, ChevronRight, ChevronDown, MoreVertical, Star, CheckCircle2, UserCheck, Undo2,
} from "lucide-react";
import { uid, confirmThen, getDays, makeDay, blockTitle } from "../lib/utils";
import { exportSchedaXLSX, exportSchedaPDF } from "../lib/exporters";
import AssignSchedaModal from "./AssignSchedaModal";
import DayEditor from "./DayEditor";
import DuplicateSchedaModal from "./DuplicateSchedaModal";

export default function SchedeManager({
  exercises, exerciseMeta, schede, onAddExercise, onSaveScheda, onDeleteScheda,
  canAssign, authUser, assignments = [], onAcceptAssignment, onRejectAssignment, onPushUpdate,
  activeSchedaId, onSetActive,
}) {
  const [menuFor, setMenuFor] = useState(null);
  const menuRef = useRef(null);

  // Chiude il menu a tre puntini cliccando altrove
  useEffect(() => {
    if (!menuFor) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuFor]);

  const [assigning, setAssigning] = useState(null);
  const [duplicating, setDuplicating] = useState(null);
  const [viewingSchedaId, setViewingSchedaId] = useState(null);

  // scheda in modifica (con i suoi giorni)
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [openDayIdx, setOpenDayIdx] = useState(null);

  const mie = schede.filter((s) => !(s.assignedTo || []).length);
  const assegnate = schede.filter((s) => (s.assignedTo || []).length > 0);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDays([]);
    setFormOpen(false);
    setOpenDayIdx(null);
  };

  const startNew = () => {
    setEditingId(null);
    setName("");
    // Si parte dal nome della scheda: i giorni si aggiungono dopo
    setDays([]);
    setFormOpen(true);
    setOpenDayIdx(null);
  };

  const startEdit = (scheda) => {
    setEditingId(scheda.id);
    setName(scheda.name);
    // copia profonda: le modifiche si applicano solo al salvataggio
    setDays(JSON.parse(JSON.stringify(getDays(scheda))));
    setFormOpen(true);
    setOpenDayIdx(null);
  };

  // --- giorni ---
  const updateDay = (idx, day) => setDays((prev) => prev.map((d, i) => (i === idx ? day : d)));

  const addDay = () => {
    setDays((prev) => [...prev, makeDay(`Giorno ${prev.length + 1}`)]);
  };

  const duplicateDay = (idx) => {
    setDays((prev) => {
      const copy = JSON.parse(JSON.stringify(prev[idx]));
      copy.id = uid();
      copy.name = `${copy.name} (copia)`;
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const removeDay = (idx) => {
    confirmThen(`Eliminare "${days[idx].name}"?`, () => {
      setDays((prev) => prev.filter((_, i) => i !== idx));
      setOpenDayIdx(null);
    });
  };

  const moveDay = (idx, dir) => {
    setDays((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // --- schede ---
  const duplicate = (scheda) => setDuplicating(scheda);

  const submit = () => {
    if (!name.trim() || days.length === 0) return;
    const totalEx = days.reduce((n, d) => n + (d.items?.length || 0), 0);
    // Parto dall'originale (se esiste) per non perdere campi come
    // assignedTo/sourceSchedaId: qui si aggiornano solo nome e giorni.
    const original = editingId ? schede.find((s) => s.id === editingId) : null;
    const assignedTargets = original?.assignedTo || [];
    const pushOnSave = assignedTargets.length > 0 && !!onPushUpdate;
    const nomiAssegnati = assignedTargets.map((t) => t.name).join(", ");
    const message = pushOnSave
      ? `Salvare "${name.trim()}"? La versione aggiornata verrà inviata anche a ${nomiAssegnati}, sovrascrivendo la loro copia (la cronologia resta collegata).`
      : `Salvare la scheda "${name.trim()}" con ${days.length} ${days.length === 1 ? "giorno" : "giorni"} e ${totalEx} esercizi?`;
    confirmThen(message, () => {
      const updated = { ...original, id: editingId || uid(), name: name.trim(), days };
      onSaveScheda(updated);
      if (pushOnSave) onPushUpdate(updated);
      resetForm();
    });
  };

  // Creare/modificare una scheda occupa tutto lo schermo, senza l'elenco
  // sotto: su telefono è molto più chiaro cosa si sta facendo.
  if (formOpen) {
    return (
      <div>
        <div className="g-card">
          {openDayIdx === null ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <button className="g-icon-btn" onClick={resetForm} title="Torna alle schede">
                  <ChevronLeft size={16} />
                </button>
                <input
                  className="g-input"
                  placeholder="Nome scheda"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="g-field-label" style={{ marginTop: 16 }}>
                Giorni ({days.length})
              </div>

              {days.length === 0 && (
                <div className="g-free-day-hint" style={{ marginBottom: 8 }}>
                  Dai un nome alla scheda, poi aggiungi i giorni di allenamento.
                </div>
              )}

              {days.map((d, idx) => (
                <div className="g-day-row" key={d.id}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 6 }}>
                    <button className="g-order-btn" onClick={() => moveDay(idx, -1)} disabled={idx === 0}>▲</button>
                    <button className="g-order-btn" onClick={() => moveDay(idx, 1)} disabled={idx === days.length - 1}>▼</button>
                  </div>
                  <div style={{ flex: 1, cursor: "pointer", minWidth: 0 }} onClick={() => setOpenDayIdx(idx)}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                    <div className="g-reg-count">
                      {(d.items?.length || 0)} {(d.items?.length || 0) === 1 ? "esercizio" : "esercizi"}
                    </div>
                  </div>
                  <button className="g-icon-btn" style={{ padding: 6 }} onClick={() => duplicateDay(idx)} title="Duplica giorno">
                    <Copy size={13} />
                  </button>
                  <button className="g-icon-btn" style={{ padding: 6 }} onClick={() => setOpenDayIdx(idx)} title="Apri">
                    <Pencil size={13} />
                  </button>
                  <button className="g-del-btn" onClick={() => removeDay(idx)}><X size={14} /></button>
                </div>
              ))}

              <button className="g-add-btn" onClick={addDay}>
                <Plus size={14} /> Aggiungi giorno
              </button>

              <button className="g-submit" disabled={!name.trim() || days.length === 0} onClick={submit}>
                Salva scheda
              </button>
            </>
          ) : (
            <DayEditor
              exercises={exercises}
              exerciseMeta={exerciseMeta}
              day={days[openDayIdx]}
              onChange={(d) => updateDay(openDayIdx, d)}
              onClose={() => setOpenDayIdx(null)}
              onAddExercise={onAddExercise}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {assignments.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {assignments.map((a) => (
            <div className="g-assign-banner" key={a.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Inbox size={16} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.scheda?.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-dim)" }}>
                    Assegnata da {a.fromName}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="g-del-btn" onClick={() => onRejectAssignment(a)}>Rifiuta</button>
                <button className="g-empty-cta" style={{ marginTop: 0, padding: "7px 14px" }}
                  onClick={() => onAcceptAssignment(a)}>
                  Aggiungi
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="g-empty-cta" style={{ width: "100%", marginBottom: 16 }} onClick={startNew}>
        + Nuova scheda
      </button>

      <div className="g-field-label">Le tue schede ({mie.length})</div>
      {mie.length === 0 ? (
        <div className="g-card g-empty" style={{ padding: 24 }}>Nessuna scheda creata</div>
      ) : (
        <div className="g-card" style={{ padding: "4px 14px" }}>
          {mie.map((s) => {
            const sDays = getDays(s);
            const open = viewingSchedaId === s.id;
            const isActive = activeSchedaId === s.id;
            return (
              <div key={s.id}>
                <div className={`g-scheda-row ${isActive ? "g-scheda-active" : ""}`}>
                  <div style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
                    onClick={() => setViewingSchedaId(open ? null : s.id)}>
                    {open ? <ChevronDown size={15} color="var(--ink-dim)" /> : <ChevronRight size={15} color="var(--ink-dim)" />}
                    <div style={{ minWidth: 0 }}>
                      <div className="g-scheda-name">
                        {s.name}
                        {isActive && (
                          <span className="g-active-badge">
                            <CheckCircle2 size={11} /> Attiva
                          </span>
                        )}
                      </div>
                      <div className="g-scheda-meta">
                        {sDays.length} {sDays.length === 1 ? "giorno" : "giorni"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button className="g-icon-btn" title="Modifica" onClick={() => startEdit(s)}>
                      <Pencil size={14} />
                    </button>
                    <div style={{ position: "relative" }} ref={menuFor === s.id ? menuRef : null}>
                      <button
                        className="g-icon-btn"
                        title="Altre azioni"
                        onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                      >
                        <MoreVertical size={15} />
                      </button>
                      {menuFor === s.id && (
                        <div className="g-menu">
                          {!isActive && (
                            <button className="g-menu-item" onClick={() => { onSetActive(s.id); setMenuFor(null); }}>
                              <Star size={14} /> Rendi attiva
                            </button>
                          )}
                          {isActive && (
                            <button className="g-menu-item" onClick={() => { onSetActive(null); setMenuFor(null); }}>
                              <Star size={14} /> Togli da attiva
                            </button>
                          )}
                          {canAssign && (
                            <button className="g-menu-item" onClick={() => { setAssigning(s); setMenuFor(null); }}>
                              <Send size={14} /> Assegna
                            </button>
                          )}
                          <div className="g-menu-divider" />
                          <button className="g-menu-item" onClick={() => { exportSchedaXLSX(s, exerciseMeta); setMenuFor(null); }}>
                            <FileSpreadsheet size={14} color="var(--success)" /> Scarica Excel
                          </button>
                          <button className="g-menu-item" onClick={() => { exportSchedaPDF(s, exerciseMeta); setMenuFor(null); }}>
                            <FileDown size={14} color="var(--accent)" /> Scarica PDF
                          </button>
                          <button className="g-menu-item" onClick={() => { duplicate(s); setMenuFor(null); }}>
                            <Copy size={14} /> Duplica
                          </button>
                          <div className="g-menu-divider" />
                          <button
                            className="g-menu-item g-menu-danger"
                            onClick={() => { setMenuFor(null); confirmThen(`Eliminare la scheda "${s.name}"?`, () => onDeleteScheda(s.id)); }}
                          >
                            <Trash2 size={14} /> Elimina
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {open && (
                  <div style={{ padding: "0 0 12px 0" }}>
                    {sDays.map((d) => (
                      <div key={d.id} className="g-scheda-item-view">
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                          <CalendarDays size={13} color="var(--accent)" /> {d.name}
                        </div>
                        {(d.items || []).length === 0 ? (
                          <div style={{ color: "var(--ink-dim)", fontSize: 12, marginTop: 3 }}>Nessun esercizio</div>
                        ) : (
                          <ul className="g-day-ex-list">
                            {d.items.map((it, i) => (
                              <li key={i}>{blockTitle(it)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assegnate.length > 0 && (
        <>
          <div className="g-field-label" style={{ marginTop: 18 }}>
            Schede assegnate ({assegnate.length})
          </div>
          <div className="g-card" style={{ padding: "4px 14px" }}>
            {assegnate.map((s) => (
              <div className="g-scheda-row" key={s.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="g-scheda-name">{s.name}</div>
                  <div className="g-scheda-meta">
                    {getDays(s).length} {getDays(s).length === 1 ? "giorno" : "giorni"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {(s.assignedTo || []).map((t) => (
                      <span key={t.uid} className="g-part-badge">
                        <UserCheck size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <button className="g-icon-btn" title="Modifica" onClick={() => startEdit(s)}>
                    <Pencil size={14} />
                  </button>
                  <div style={{ position: "relative" }} ref={menuFor === s.id ? menuRef : null}>
                    <button className="g-icon-btn" title="Altre azioni"
                      onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}>
                      <MoreVertical size={15} />
                    </button>
                    {menuFor === s.id && (
                      <div className="g-menu">
                        <button className="g-menu-item" onClick={() => { setMenuFor(null); confirmThen(`Riportare "${s.name}" tra le tue schede?`, () => onSaveScheda({ ...s, assignedTo: [] })); }}>
                          <Undo2 size={14} /> Riprendi tra le tue
                        </button>
                        {canAssign && (
                          <button className="g-menu-item" onClick={() => { setAssigning(s); setMenuFor(null); }}>
                            <Send size={14} /> Assegna anche a...
                          </button>
                        )}
                        <div className="g-menu-divider" />
                        <button className="g-menu-item" onClick={() => { exportSchedaXLSX(s, exerciseMeta); setMenuFor(null); }}>
                          <FileSpreadsheet size={14} color="var(--success)" /> Scarica Excel
                        </button>
                        <button className="g-menu-item" onClick={() => { exportSchedaPDF(s, exerciseMeta); setMenuFor(null); }}>
                          <FileDown size={14} color="var(--accent)" /> Scarica PDF
                        </button>
                        <button className="g-menu-item" onClick={() => { duplicate(s); setMenuFor(null); }}>
                          <Copy size={14} /> Duplica
                        </button>
                        <div className="g-menu-divider" />
                        <button className="g-menu-item g-menu-danger"
                          onClick={() => { setMenuFor(null); confirmThen(`Eliminare la scheda "${s.name}"?`, () => onDeleteScheda(s.id)); }}>
                          <Trash2 size={14} /> Elimina
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {duplicating && (
        <DuplicateSchedaModal
          scheda={duplicating}
          fromUser={authUser}
          canAssign={canAssign}
          onClose={() => setDuplicating(null)}
          onDuplicate={(nuova) => onSaveScheda(nuova)}
        />
      )}

      {assigning && (
        <AssignSchedaModal
          scheda={assigning}
          fromUser={authUser}
          onClose={() => setAssigning(null)}
          onAssigned={(sch, target) => {
            // La scheda passa alla persona: resta visibile fra le "assegnate",
            // ma non è più selezionabile nei miei allenamenti.
            const prevList = sch.assignedTo || [];
            if (prevList.some((t) => t.uid === target.uid)) return;
            onSaveScheda({ ...sch, assignedTo: [...prevList, target] });
          }}
        />
      )}
    </div>
  );
}
