/**
 * Sanitiza um nome de arquivo para PDFs gerados via jsPDF.
 * - Remove path traversal ("../", barras, backslashes)
 * - Remove caracteres de controle, aspas e HTML
 * - Mantém apenas letras (com acento), números, hífen, underscore e ponto
 * - Garante extensão .pdf e limite de 120 chars
 * - Faz fallback para "documento.pdf" se nada sobrar
 */
export function sanitizeFilenamePdf(name: string, fallback = "documento.pdf"): string {
  let s = (name ?? "").toString();
  // remove HTML tags inteiras
  s = s.replace(/<[^>]*>/g, "");
  // remove path separators e traversal
  s = s.replace(/[\\/]+/g, "-").replace(/\.{2,}/g, "-");
  // remove caracteres de controle e aspas
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u001F\u007F"'`<>|?*:]/g, "");
  // colapsa espaços e troca por hífen
  s = s.trim().replace(/\s+/g, "-");
  // mantém apenas safe chars (latino + acentos)
  s = s.replace(/[^\w.\-\u00C0-\u017F]/g, "");
  // remove pontos iniciais/finais
  s = s.replace(/^\.+|\.+$/g, "");
  // limita tamanho (antes de garantir extensão)
  if (s.length > 120) s = s.slice(0, 120);
  if (!s) return fallback;
  if (!s.toLowerCase().endsWith(".pdf")) s = `${s}.pdf`;
  return s;
}
