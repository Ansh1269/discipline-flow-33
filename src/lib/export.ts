export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    const blob = new Blob([""], { type: "text/csv" });
    return triggerDownload(filename, blob);
  }
  const headers = Array.from(
    rows.reduce((set, r) => { Object.keys(r).forEach((k) => set.add(k)); return set; }, new Set<string>())
  );
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  triggerDownload(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

export function downloadJson(filename: string, data: unknown) {
  triggerDownload(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}

export async function downloadXlsx(filename: string, sheets: Record<string, Record<string, unknown>[]>) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  triggerDownload(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

export async function downloadPdfReport(
  filename: string,
  title: string,
  subtitle: string,
  sections: { heading: string; rows: (string | number)[][]; columns: string[] }[],
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(20); doc.text(title, 40, 50);
  doc.setFontSize(11); doc.setTextColor(120); doc.text(subtitle, 40, 70);
  let y = 100;
  for (const s of sections) {
    doc.setTextColor(20); doc.setFontSize(13); doc.text(s.heading, 40, y);
    autoTable(doc, {
      head: [s.columns], body: s.rows, startY: y + 8,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [16, 122, 87], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 40, right: 40 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 30;
    if (y > 760) { doc.addPage(); y = 60; }
  }
  doc.save(filename);
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
