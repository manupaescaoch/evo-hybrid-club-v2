import { FileText, FileSpreadsheet } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { sanitizeFilenamePdf } from "@/lib/pdf-filename";

interface ExportButtonsProps {
  filename: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

/** Sanitiza nome de planilha (regras Excel: <=31 chars, sem : \ / ? * [ ]). */
function sanitizeSheetName(name: string): string {
  const s = (name || "Planilha").replace(/[:\\/?*[\]]/g, "").trim();
  return (s || "Planilha").slice(0, 31);
}

/** Sanitiza filename para XLSX (mesmas regras do PDF, com extensão .xlsx). */
function sanitizeFilenameXlsx(name: string, fallback = "planilha.xlsx"): string {
  let s = (name ?? "").toString();
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(/[\\/]+/g, "-").replace(/\.{2,}/g, "-");
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u001F\u007F"'`<>|?*:]/g, "");
  s = s.trim().replace(/\s+/g, "-");
  s = s.replace(/[^\w.\-\u00C0-\u017F]/g, "");
  s = s.replace(/^\.+|\.+$/g, "");
  if (s.length > 120) s = s.slice(0, 120);
  if (!s) return fallback;
  if (!s.toLowerCase().endsWith(".xlsx")) s = `${s}.xlsx`;
  return s;
}

export function ExportButtons({ filename, title, columns, rows }: ExportButtonsProps) {
  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    autoTable(doc, {
      head: [columns],
      body: rows.map((r) => r.map((c) => String(c))),
      startY: 22,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [17, 17, 17] },
    });
    doc.save(sanitizeFilenamePdf(`${filename}.pdf`));
  }

  async function exportXLSX() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sanitizeSheetName(title));
    ws.addRow(columns);
    for (const r of rows) {
      // Força strings para evitar interpretação de fórmulas/datas
      ws.addRow(r.map((c) => (c == null ? "" : String(c))));
    }
    // Negrito no header
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeFilenameXlsx(`${filename}.xlsx`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={exportPDF}
        className="fin-btn-ghost inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium"
      >
        <FileText className="h-3.5 w-3.5" /> PDF
      </button>
      <button
        onClick={exportXLSX}
        className="fin-btn-ghost inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </button>
    </div>
  );
}
