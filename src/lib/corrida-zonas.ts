// Cálculos de zonas de FC e pace para corrida.
// Funções puras, testáveis.

export type PerfilCorrida = {
  fc_max: number | null;
  fc_repouso: number | null;
  pace_limiar_seg: number | null; // pace de limiar em segundos por km
};

export type Zona = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

export const ZONAS: { z: Zona; nome: string; pctMin: number; pctMax: number; cor: string }[] = [
  { z: "Z1", nome: "Recuperação", pctMin: 50, pctMax: 60, cor: "#22C55E" },
  { z: "Z2", nome: "Aeróbico base", pctMin: 60, pctMax: 70, cor: "#0033FF" },
  { z: "Z3", nome: "Aeróbico forte", pctMin: 70, pctMax: 80, cor: "#FACC15" },
  { z: "Z4", nome: "Limiar", pctMin: 80, pctMax: 90, cor: "#F97316" },
  { z: "Z5", nome: "VO2max", pctMin: 90, pctMax: 100, cor: "#EF4444" },
];

// Karvonen: FC alvo = FCrep + (FCmax - FCrep) * pct
export function calcularFcZona(perfil: PerfilCorrida, zona: Zona): { min: number; max: number } | null {
  if (!perfil.fc_max || !perfil.fc_repouso) return null;
  const reserva = perfil.fc_max - perfil.fc_repouso;
  if (reserva <= 0) return null;
  const z = ZONAS.find((x) => x.z === zona)!;
  return {
    min: Math.round(perfil.fc_repouso + reserva * (z.pctMin / 100)),
    max: Math.round(perfil.fc_repouso + reserva * (z.pctMax / 100)),
  };
}

// Offsets em segundos por km a partir do pace de limiar
// Baseado em Jack Daniels e literatura clássica de treinamento
const PACE_OFFSET: Record<Zona, { min: number; max: number }> = {
  Z1: { min: 90, max: 120 }, // recuperação: muito mais lento
  Z2: { min: 60, max: 90 }, // easy/longão
  Z3: { min: 20, max: 40 }, // maratona/aeróbico forte
  Z4: { min: -5, max: 5 }, // limiar
  Z5: { min: -25, max: -15 }, // VO2max
};

export function calcularPaceZona(perfil: PerfilCorrida, zona: Zona): { min: string; max: string } | null {
  if (!perfil.pace_limiar_seg) return null;
  const off = PACE_OFFSET[zona];
  // Lembrando: pace maior = mais lento. min do range = ritmo mais rápido (segundos menor).
  const segMax = perfil.pace_limiar_seg + off.max; // mais lento
  const segMin = perfil.pace_limiar_seg + off.min; // mais rápido
  return { min: formatPace(segMin), max: formatPace(segMax) };
}

export function formatPace(totalSec: number): string {
  if (totalSec <= 0 || !isFinite(totalSec)) return "—";
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parsePace(str: string): number | null {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ===== Conversão pace ↔ esteira =====
// 5:30/km → 10,9 km/h. Aceita "5:30", "5:30/km" ou range "5:30-5:50".
export function paceToKmh(paceStr: string | null | undefined): number | null {
  if (!paceStr) return null;
  const clean = paceStr.split("/")[0].split("-")[0].trim();
  const seg = parsePace(clean);
  if (!seg || seg <= 0) return null;
  return 3600 / seg;
}

export function formatKmh(kmh: number | null): string {
  if (kmh == null || !isFinite(kmh) || kmh <= 0) return "—";
  return `${kmh.toFixed(1).replace(".", ",")} km/h`;
}

export function paceRangeToKmhRange(min: string, max: string): { lento: number; rapido: number } | null {
  const rapido = paceToKmh(min);
  const lento = paceToKmh(max);
  if (rapido == null || lento == null) return null;
  return { lento, rapido };
}

export function descreverZona(perfil: PerfilCorrida, zona: Zona): string {
  const partes: string[] = [zona];
  const pace = calcularPaceZona(perfil, zona);
  if (pace) partes.push(`${pace.min}–${pace.max}/km`);
  const fc = calcularFcZona(perfil, zona);
  if (fc) partes.push(`${fc.min}–${fc.max}bpm`);
  return partes.join(" · ");
}

export function descreverZonaComEsteira(perfil: PerfilCorrida, zona: Zona): string {
  const partes: string[] = [zona];
  const pace = calcularPaceZona(perfil, zona);
  if (pace) {
    partes.push(`${pace.min}–${pace.max}/km`);
    const r = paceRangeToKmhRange(pace.min, pace.max);
    if (r) partes.push(`${r.lento.toFixed(1).replace(".", ",")}–${r.rapido.toFixed(1).replace(".", ",")} km/h`);
  }
  const fc = calcularFcZona(perfil, zona);
  if (fc) partes.push(`${fc.min}–${fc.max}bpm`);
  return partes.join(" · ");
}

// Helpers de data
export function inicioDaSemana(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay(); // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow;
  r.setDate(r.getDate() + diff);
  return r;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function numeroSemanaIso(d: Date): number {
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}
