import { useState, useEffect, useMemo } from "react";
import { X, BookOpen, ChevronLeft, Search, Link2, Unlink } from "lucide-react";
import { confirmThen } from "../lib/utils";
import { nameIt, equipmentIt, muscleIt, typeIt } from "../lib/exerciseGuideIt";

// Guida esterna agli esercizi (immagini + info) fornita dal pacchetto
// @bryllim/workout-guide, tradotta in italiano (vedi lib/exerciseGuideIt).
// È un'anagrafica indipendente dalla nostra, in inglese alla fonte: si cerca
// a mano finché un PT/admin non sceglie la guida giusta per un esercizio di
// Ghisa — da lì in poi si apre già su quella, senza dover ricercare ogni volta.
//
// savedSlug: slug già collegato a questo esercizio (o null/undefined)
// canManage: true per PT/admin — possono collegare/scollegare la guida
// onSelect(slug): salva il collegamento
// onClear(): rimuove il collegamento
export default function ExerciseGuideModal({ exerciseName, savedSlug, canManage, onSelect, onClear, onClose }) {
  const [lib, setLib] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState(exerciseName || "");
  // Se c'è già una guida collegata, si parte dal dettaglio; "null" = ricerca libera
  const [viewSlug, setViewSlug] = useState(savedSlug || null);

  useEffect(() => {
    let cancelled = false;
    // Caricata solo quando serve davvero: contiene i dati di 300+ esercizi,
    // non ha senso portarsela dietro nel bundle principale dell'app.
    import("@bryllim/workout-guide")
      .then((mod) => { if (!cancelled) setLib(mod); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  const results = useMemo(() => {
    if (!lib) return [];
    return lib.searchExercises(query).slice(0, 40);
  }, [lib, query]);

  const selected = useMemo(() => {
    if (!lib || !viewSlug) return null;
    return lib.getExercise(viewSlug);
  }, [lib, viewSlug]);

  const isSavedOne = !!selected && selected.slug === savedSlug;

  const chooseAsGuide = (slug, name) => {
    confirmThen(`Usare "${nameIt({ slug, name })}" come guida di "${exerciseName}"?`, () => {
      onSelect(slug);
    });
  };

  const removeGuide = () => {
    confirmThen(`Rimuovere la guida collegata a "${exerciseName}"?`, () => {
      onClear();
      setViewSlug(null);
    });
  };

  return (
    <div className="g-modal-overlay" onClick={onClose}>
      <div className="g-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="g-title ghisa-display" style={{ fontSize: 18 }}>
            <BookOpen size={18} color="var(--accent)" /> Guida esercizio
          </div>
          <button className="g-icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={16} />
          </button>
        </div>

        {loadError ? (
          <div className="g-card g-empty" style={{ padding: 20, marginTop: 16 }}>
            Non sono riuscito a caricare la guida. Controlla la connessione e riprova.
          </div>
        ) : !lib ? (
          <div className="g-card g-empty" style={{ padding: 20, marginTop: 16 }}>
            Caricamento guida...
          </div>
        ) : selected ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 8 }}>
              <button className="g-icon-btn" style={{ gap: 5 }} onClick={() => setViewSlug(null)}>
                <ChevronLeft size={15} /> {canManage ? "Cerca un'altra" : "Altri risultati"}
              </button>
              {isSavedOne && (
                <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  ✓ Guida collegata
                </span>
              )}
            </div>

            <div className="g-ex-name" style={{ marginTop: 12 }}>{nameIt(selected)}</div>
            <div className="g-ex-tags" style={{ marginTop: 6 }}>
              <span className="g-tag g-tag-target">{typeIt(selected.exerciseType)}</span>
              <span className="g-tag">{equipmentIt(selected.equipment)}</span>
              <span className="g-tag">{muscleIt(selected.primaryMuscle)}</span>
              {selected.secondaryMuscles.map((m) => (
                <span className="g-tag" key={m}>{muscleIt(m)}</span>
              ))}
              {selected.isStretch && <span className="g-tag g-tag-warm">Stretching</span>}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {selected.frames.map((f) => (
                <img
                  key={f.index}
                  src={lib.getAssetUrl(selected.slug, f.index)}
                  alt={`${nameIt(selected)} — fase ${f.index}`}
                  loading="lazy"
                  style={{
                    flex: 1, width: "33%", borderRadius: 10, background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                  }}
                />
              ))}
            </div>

            {canManage && (
              isSavedOne ? (
                <button className="g-icon-btn" style={{ width: "100%", justifyContent: "center", marginTop: 14, gap: 6 }} onClick={removeGuide}>
                  <Unlink size={14} /> Scollega guida da "{exerciseName}"
                </button>
              ) : (
                <button className="g-submit g-submit-secondary" style={{ marginTop: 14 }} onClick={() => chooseAsGuide(selected.slug, selected.name)}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Link2 size={14} /> Usa come guida di "{exerciseName}"
                  </span>
                </button>
              )
            )}

            <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 12, lineHeight: 1.5 }}>
              Immagini di{" "}
              <a href={selected.attribution.creatorUrl} target="_blank" rel="noopener noreferrer">
                {selected.attribution.creator}
              </a>
              , licenza{" "}
              <a href={selected.attribution.licenseUrl} target="_blank" rel="noopener noreferrer">
                {selected.attribution.license}
              </a>
              {selected.attribution.source && (
                <> · rielaborate da <a href={selected.attribution.source.url} target="_blank" rel="noopener noreferrer">{selected.attribution.source.name}</a></>
              )}
              .
            </div>
          </>
        ) : (
          <>
            {!canManage && (
              <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 14, lineHeight: 1.5 }}>
                Nessuna guida ancora collegata a "{exerciseName}" da un admin/PT: qui sotto puoi
                comunque cercare e guardare tutti gli esercizi simili.
              </div>
            )}
            <div className="g-search-field" style={{ marginTop: 14 }}>
              <Search size={15} />
              <input
                className="g-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca in inglese: es. bench press, squat..."
                autoFocus
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 6 }}>
              Anagrafica esterna in inglese, non collegata ai nomi usati in Ghisa: prova un
              termine come "press", "curl", "row", "squat"...
            </div>

            {results.length === 0 ? (
              <div className="g-card g-empty" style={{ padding: 20, marginTop: 12 }}>
                Nessun esercizio trovato.
              </div>
            ) : (
              <div className="g-card" style={{ padding: "4px 14px", marginTop: 12, maxHeight: "45vh", overflowY: "auto" }}>
                {results.map((ex) => (
                  <div className="g-reg-row" key={ex.id} style={{ cursor: "pointer" }} onClick={() => setViewSlug(ex.slug)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="g-reg-name">{nameIt(ex)}</div>
                      <div className="g-reg-count">{equipmentIt(ex.equipment)} · {muscleIt(ex.primaryMuscle)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
