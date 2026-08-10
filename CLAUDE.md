# GHISA — contesto progetto

App per tracciare allenamenti in palestra (schede, carichi, progressi).
Pensata soprattutto per l'uso da telefono, in palestra. Ideata da Stefano.

L'interfaccia e i commenti nel codice sono **in italiano**: mantieni questa lingua
per testi UI, commenti e messaggi.

---

## ⚠️ Regole da rispettare sempre

1. **Non modificare mai `src/config.js` e `src/firebase.js`.** Contengono l'email
   admin, il link PayPal e le chiavi Firebase reali. Se serve un nuovo valore di
   configurazione, chiedi conferma prima di toccarli.
2. **Non committare chiavi o segreti.**
3. Dopo ogni modifica sostanziale, verifica che il progetto compili
   (`npm run build`) prima di dichiarare finito.
4. Testi UI, label e messaggi di conferma: **in italiano**.

---

## Stack e comandi

- React 18 + Vite, Firebase (Auth Google + Firestore), Recharts per i grafici,
  lucide-react per le icone, xlsx / jspdf / jspdf-autotable per gli export.
- Sviluppo: `npm run dev`
- Build: `npm run build`
- Deploy: `firebase deploy --only hosting` (Firebase Hosting)
- Richiede Node 18+ (con Node 16 Vite 5 va in errore su `crypto.getRandomValues`).

---

## Struttura

```
src/
├── App.jsx                 guscio: stato globale, sync Firestore, tema, navigazione, TUTTO il CSS
├── config.js               ⚠️ NON TOCCARE — ADMIN_EMAIL, PAYPAL_LINK
├── firebase.js             ⚠️ NON TOCCARE — init Firebase/Auth/Firestore
├── lib/
│   ├── utils.js            uid, confirmThen, formatDate, formatMMSS, BODY_PARTS, STEPS,
│   │                       getReps/getBackoffReps/getBackoffPercent/repsLabel
│   └── exporters.js        export scheda in xlsx/PDF, export statistiche in PDF
└── components/
    ├── StatsPage.jsx       tab Statistiche (per esercizio / per giorno) + export PDF
    ├── LogPage.jsx         tab Allenamento (il file più grande e delicato)
    ├── SchedeManager.jsx   tab Schede: elenco schede e gestione giorni
    ├── DayEditor.jsx       editor di un singolo giorno (blocchi ed esercizi)
    ├── AdminPage.jsx       tab Admin: sotto-sezioni Esercizi / Utenti / Pulizia
    ├── ExerciseRegistry.jsx anagrafica esercizi (rinomina, unisci, parti del corpo)
    ├── UserManagement.jsx  elenco utenti + assegnazione ruolo Personal Trainer
    ├── DatabaseCleanup.jsx pulizia selettiva del database (solo admin)
    ├── ExercisePicker.jsx  campo ricerca esercizio con "Non lo trovi? Inserisci..."
    ├── BodyDiagram.jsx     corpo umano fronte/retro con parti evidenziate
    ├── AccountModal.jsx    dati utente + logout
    └── InfoModal.jsx       presentazione app + link PayPal (solo admin)
```

**Tutto il CSS sta in un unico blocco `<style>` dentro `App.jsx`.** Le classi
usano il prefisso `g-` e i colori passano da variabili CSS (`--accent`, `--ink`,
`--surface`, ecc.) che cambiano col tema chiaro/scuro. Se aggiungi stili, mettili
lì e usa le variabili, non colori fissi.

---

## Modello dati

### Firestore

| Percorso | Contenuto | Chi può |
|---|---|---|
| `shared/registry` | `exercises: string[]`, `exerciseMeta: { [esercizio]: string[] }` (parti del corpo) | lettura pubblica, scrittura a chiunque sia autenticato — **è l'anagrafica unica per tutti** |
| `users/{uid}` | `logs`, `schede`, `draftSession` | solo il proprietario (+ admin) — dati **privati per utente** |
| `directory/{uid}` | `email`, `displayName`, `lastSeen`, `isPT` | il proprietario + admin |

Ogni dato è anche in `localStorage` (chiavi `ghisa-*`) così l'app funziona offline
e senza login; Firestore sincronizza in tempo reale via `onSnapshot`.

### Ruoli

- **Admin**: chi ha l'email in `ADMIN_EMAIL` (confronto case-insensitive).
  Vede tutto: anagrafica, utenti, pulizia database.
- **Personal Trainer**: `isPT: true` nella sua voce di `directory`. Vede solo
  l'anagrafica esercizi.
- **Utente normale**: niente tab Admin.

### Struttura di una scheda

Una **scheda** è un programma che contiene più **giorni**; ogni giorno contiene
una lista di **blocchi**; ogni blocco contiene uno o più **esercizi**
(superset/jumpset).

```js
{ id, name: "Massa autunno", days: [ { id, name: "Push", items: [ /* blocchi */ ] } ] }
```

⚠️ Le schede vecchie hanno `items` al posto di `days`: usa sempre `getDays()` di
`lib/utils.js`, che le converte in un giorno unico mantenendo id e nome (così
storico e statistiche continuano a combaciare). `dayOptions(schede)` produce
l'elenco piatto usato dal menu in Allenamento.

### Struttura di un blocco (una riga del giorno)

```js
{
  combo: "none" | "superset" | "jumpset",
  parts: [ /* uno o più esercizi, vedi sotto */ ],
  sets: 4,
  restSeconds: 90,      // vale a fine blocco; dentro il blocco: 0 superset, 60 jumpset
  warmup: false,
  note: "ultima serie iso in chiusura 2\" ad ogni rep"
}
```

### Struttura di un esercizio dentro una scheda

```js
{
  exercise: "Panca piana",
  sets: 3,
  repsMin: 5, repsMax: 7,        // range; se min === max si mostra un numero solo
  restSeconds: 120,
  backoffSets: 2,                 // 0 = nessun back-off
  backoffRepsMin: 8, backoffRepsMax: 10,
  backoffPercent: 30              // riduzione carico del back-off
}
```

⚠️ Le schede vecchie hanno `reps` / `backoffReps` come numero singolo: **leggi
sempre tramite `getReps()`, `getBackoffReps()`, `getBackoffPercent()`** di
`lib/utils.js`, che gestiscono la retrocompatibilità.

### Struttura di un log

```js
{ id, sessionId, exercise, weight, sets, reps, backoff, dayId, dayName, date, note }
```

`sessionId` raggruppa gli esercizi di uno stesso allenamento (lo storico è
raggruppato per sessione, non per esercizio).

---

## Comportamenti importanti di LogPage

- Si sceglie il **Giorno** da una dropdown (una scheda oppure "Giorno libero").
  Parte sempre **non selezionato**: finché non scegli, il form resta nascosto.
- Con una scheda selezionata gli esercizi si susseguono **a step**: aggiungi →
  passa al successivo. Se l'esercizio ha un back-off, prima propone il back-off
  (spunta già attiva, reps dal range back-off, peso ridotto della percentuale
  configurata, arrotondato per eccesso), poi avanza.
- All'ultimo esercizio compare "Ben fatto! 💪 Allenamento completato".
- Il peso proposto è l'ultimo **top set** registrato per quell'esercizio; se non
  c'è storico torna a 20 kg (non deve restare il peso ridotto del back-off
  precedente).
- La sessione in corso si autosalva come bozza (`draftSession`): uscendo e
  rientrando la ritrovi dov'eri.
- Gli allenamenti salvati restano modificabili: data dell'intera sessione,
  singoli esercizi, aggiunta di esercizi a posteriori, eliminazione.

### ⚠️ Bug già risolti — non reintrodurli

- **Non mettere `selectedScheda` (o altri oggetti che arrivano da Firestore)
  nelle dipendenze di `useEffect`.** Ad ogni sync arriva un oggetto nuovo con lo
  stesso contenuto: faceva resettare il form e cancellava il back-off appena
  impostato. Usa `dayId` / `stepIdx`.
- Il `-30%` (o percentuale configurata) va applicato **solo** al set di back-off
  dello stesso esercizio, mai trascinato all'esercizio successivo.
- Su Safari iOS gli input sbordavano: serve `min-width: 0` globale e
  `max-width: 100%` sugli input (già in `App.jsx`, non rimuoverli).

---

## Convenzioni UI

- Ogni **salvataggio** ed **eliminazione** chiede conferma, tramite
  `confirmThen(messaggio, callback)` di `lib/utils.js`.
- Le operazioni distruttive dell'admin chiedono di digitare `ELIMINA`.
- Layout responsive: mobile a piena larghezza, card centrata da 520px su tablet,
  fino a 820px su desktop (≥1024px).
- L'app è installabile come PWA (`public/manifest.webmanifest`, icona manubrio,
  nome "Ghisa").

---

## Idee non ancora implementate

- Sezione community.
- Ottimizzazione del numero di chiamate a Firestore (il piano gratuito si
  consuma in fretta con la sincronizzazione in tempo reale su ogni modifica:
  valutare debounce sulle scritture o `onSnapshot` meno aggressivi).
