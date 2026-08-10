import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  repsLabel, formatDate, logSummary,
  getParts, getCombo, comboLabel, blockTitle, blockTarget, partAmountLabel, getDays,
} from "./utils";

const ACCENT = [193, 80, 46];

function safeName(s) {
  return (s || "ghisa").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "ghisa";
}

// ---------------------------------------------------------------- Schede ----

function dayRows(day, exerciseMeta = {}) {
  return (day.items || []).map((it, i) => {
    const parts = getParts(it);
    const c = getCombo(it);
    const backoff = parts
      .filter((p) => p.backoffSets > 0)
      .map((p) => `${p.backoffSets}x${repsLabel(p.backoffRepsMin, p.backoffRepsMax)} (-${p.backoffPercent}%)`)
      .join(" | ");
    const flags = [
      c !== "none" ? comboLabel(c) : null,
      it.warmup ? "Riscaldamento" : null,
      parts.some((p) => p.noWeight) ? "Corpo libero" : null,
    ]
      .filter(Boolean)
      .join(", ");
    const bodyParts = Array.from(
      new Set(parts.flatMap((p) => exerciseMeta[p.exercise] || []))
    ).join(", ");
    return {
      "#": i + 1,
      Esercizio: blockTitle(it),
      Serie: it.sets,
      Reps: parts.map(partAmountLabel).join(" + "),
      "Rec.": it.restSeconds ? `${Math.round((it.restSeconds / 60) * 10) / 10}'` : "",
      Tipo: flags,
      "Back-off": backoff,
      Note: it.note || "",
      "Parti del corpo": bodyParts,
    };
  });
}

export function exportSchedaXLSX(scheda, exerciseMeta = {}) {
  const wb = XLSX.utils.book_new();
  const cols = [
    { wch: 4 }, { wch: 34 }, { wch: 6 }, { wch: 14 }, { wch: 8 },
    { wch: 24 }, { wch: 20 }, { wch: 34 }, { wch: 22 },
  ];
  const used = new Set();
  getDays(scheda).forEach((day, i) => {
    const ws = XLSX.utils.json_to_sheet(dayRows(day, exerciseMeta));
    ws["!cols"] = cols;
    // I nomi dei fogli Excel hanno limiti di lunghezza e devono essere unici
    let sheetName = (day.name || `Giorno ${i + 1}`).replace(/[\\\/\?\*\[\]:]/g, "").slice(0, 28) || `Giorno ${i + 1}`;
    let n = 2;
    while (used.has(sheetName)) sheetName = `${sheetName.slice(0, 26)} ${n++}`;
    used.add(sheetName);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  XLSX.writeFile(wb, `scheda-${safeName(scheda.name)}.xlsx`);
}

export function exportSchedaPDF(scheda, exerciseMeta = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const days = getDays(scheda);

  doc.setFontSize(20);
  doc.setTextColor(...ACCENT);
  doc.text("GHISA", 40, 48);
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text(scheda.name, 40, 70);
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(
    `${days.length} ${days.length === 1 ? "giorno" : "giorni"} · generato il ${new Date().toLocaleDateString("it-IT")}`,
    40,
    86
  );

  const head = [["#", "Esercizio | Carico", "Serie", "Reps", "Rec.", "Tipo", "Back-off", "Note", "Parti del corpo"]];
  let y = 108;

  days.forEach((day, i) => {
    if (y > pageH - 140) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(12);
    doc.setTextColor(...ACCENT);
    doc.text((day.name || `Giorno ${i + 1}`).toUpperCase(), 40, y);
    y += 8;

    autoTable(doc, {
      head,
      body: dayRows(day, exerciseMeta).map((r) => Object.values(r)),
      startY: y,
      styles: { fontSize: 7.5, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: ACCENT, textColor: 255 },
      alternateRowStyles: { fillColor: [246, 244, 240] },
      columnStyles: { 1: { cellWidth: 120 }, 7: { cellWidth: 105 } },
      margin: { left: 40, right: 40 },
    });
    y = doc.lastAutoTable.finalY + 28;
  });

  doc.save(`scheda-${safeName(scheda.name)}.pdf`);
}

// ----------------------------------------------------------- Statistiche ----

// Converte un grafico SVG già renderizzato in un'immagine PNG utilizzabile nel PDF
async function svgToPngDataUrl(svgEl, scale = 2) {
  const rect = svgEl.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  // I testi degli assi ereditano il colore dal CSS della pagina: lo fissiamo
  // perché nel PDF il fondo è bianco.
  clone.querySelectorAll("text").forEach((t) => t.setAttribute("fill", "#444444"));

  const svgStr = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * sections: [{ title, subtitle, chartEl (SVG|null), rows: [[data, serie, peso, tipo]] }]
 */
export async function exportStatsPDF({ title, subtitle, sections }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxW = pageW - margin * 2;

  doc.setFontSize(20);
  doc.setTextColor(...ACCENT);
  doc.text("GHISA", margin, 48);
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text(title, margin, 70);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(130);
    doc.text(subtitle, margin, 86);
  }

  let y = 104;

  for (const s of sections) {
    if (y > pageH - 180) {
      doc.addPage();
      y = 50;
    }

    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(s.title, margin, y);
    y += 6;

    if (s.subtitle) {
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.text(s.subtitle, margin, y + 10);
      y += 14;
    }

    if (s.chartEl) {
      try {
        const { dataUrl, width, height } = await svgToPngDataUrl(s.chartEl);
        const w = Math.min(maxW, width);
        const h = (height / width) * w;
        if (y + h > pageH - 60) {
          doc.addPage();
          y = 50;
        }
        doc.addImage(dataUrl, "PNG", margin, y + 8, w, h);
        y += h + 20;
      } catch (e) {
        console.error("Grafico non esportabile", e);
        y += 12;
      }
    } else {
      y += 12;
    }

    if (s.rows && s.rows.length) {
      autoTable(doc, {
        head: [["Data", "Serie svolte", "Tipo"]],
        body: s.rows,
        startY: y,
        styles: { fontSize: 8.5, cellPadding: 4 },
        headStyles: { fillColor: ACCENT, textColor: 255 },
        alternateRowStyles: { fillColor: [246, 244, 240] },
        margin: { left: margin, right: margin },
      });
      y = doc.lastAutoTable.finalY + 26;
    }
  }

  doc.save(`statistiche-${safeName(title)}.pdf`);
}

export function logRowsForPDF(logs) {
  return logs
    .slice()
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((l) => [
      formatDate(l.date),
      logSummary(l),
      l.backoff ? "Back-off" : l.warmup ? "Riscaldamento" : "Top set",
    ]);
}
