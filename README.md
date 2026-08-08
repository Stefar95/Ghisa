# GHISA — Scheda e progressi

App per tracciare la scheda palestra: registra esercizi, serie, ripetizioni e peso (con incrementi rapidi), e visualizza l'andamento nel tempo in una pagina statistiche con grafici.

I dati vengono salvati nel `localStorage` del browser: restano solo su questo dispositivo/browser finché non cancelli i dati di navigazione.

## Avvio in locale

```bash
npm install
npm run dev
```

Apri l'indirizzo mostrato in terminale (di norma http://localhost:5173).

## Build di produzione

```bash
npm run build
npm run preview
```

I file pronti per la pubblicazione finiscono nella cartella `dist/`.
