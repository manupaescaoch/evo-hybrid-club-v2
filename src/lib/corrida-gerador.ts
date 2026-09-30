// Gerador puro de planos de corrida.
// Recebe parâmetros do wizard e devolve estrutura de microciclos/sessões.
// Não toca em Supabase — quem chama persiste depois.

import {
  calcularPaceZona,
  calcularFcZona,
  type PerfilCorrida,
  type Zona,
  toISODate,
  addDays,
  numeroSemanaIso,
} from "./corrida-zonas";
import type { SessaoTipo } from "./corrida-tipos";

export type EscopoGeracao = "semana" | "mesociclo" | "macrociclo";
export type ModeloPeriodizacao = "linear" | "polarizado" | "piramidal" | "reverso";

export type DistribuicaoDia = {
  dow: number; // 1=SEG ... 7=DOM
  ativo: boolean;
  tipo: SessaoTipo;
  zona: Zona;
};

export type ParamsGeracao = {
  escopo: EscopoGeracao;
  semanaInicio: string; // ISO da segunda
  semanasTotal: number; // 1, 4 ou N
  volumeBaseKm: number;
  volumePicoKm: number;
  modelo: ModeloPeriodizacao;
  distribuicao: DistribuicaoDia[]; // 7 entradas
  diaLongao: number | null; // 1..7
  provaNome?: string;
  provaData?: string;
  provaDistanciaKm?: number;
};

export type SessaoGerada = {
  data: string;
  ordem_no_dia: number;
  tipo: SessaoTipo;
  nome: string;
  duracao_min: number | null;
  distancia_km: number | null;
  pace_alvo: string | null;
  zona_fc: string | null;
  objetivo: string | null;
};

export type SemanaGerada = {
  data_inicio: string;
  numero_semana: number;
  tipo_semana: string;
  volume_alvo_km: number;
  ordem_no_macro: number;
  objetivo: string;
  sessoes: SessaoGerada[];
};

const NOMES_TIPO: Record<SessaoTipo, string> = {
  longao: "Longão",
  regenerativo: "Regenerativo",
  intervalado: "Intervalado",
  tempo: "Tempo run",
  fartlek: "Fartlek",
  strides: "Strides",
  forca: "Força",
  mobilidade: "Mobilidade",
  cross: "Cross training",
  descanso: "Descanso",
};

// Volume relativo por tipo de sessão (para distribuir o total da semana).
// Longão pesa muito mais; regenerativo pesa pouco.
const PESO_VOLUME: Record<SessaoTipo, number> = {
  longao: 4,
  tempo: 2,
  intervalado: 1.5,
  fartlek: 1.5,
  regenerativo: 1,
  strides: 0.5,
  forca: 0,
  mobilidade: 0,
  cross: 0.8,
  descanso: 0,
};

// Pace médio do range da zona
function paceMedioDaZona(perfil: PerfilCorrida, zona: Zona): string | null {
  const p = calcularPaceZona(perfil, zona);
  if (!p) return null;
  return `${p.min}–${p.max}`;
}

function fcDaZona(perfil: PerfilCorrida, zona: Zona): string | null {
  const f = calcularFcZona(perfil, zona);
  if (!f) return null;
  return `${f.min}–${f.max}bpm`;
}

// Distribui um volume total nas sessões "rodantes" da semana, respeitando pesos.
function distribuirVolume(diasAtivos: DistribuicaoDia[], volumeTotal: number): Map<number, number> {
  const out = new Map<number, number>();
  const pesos = diasAtivos.map((d) => PESO_VOLUME[d.tipo] ?? 0);
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (soma <= 0) return out;
  diasAtivos.forEach((d, i) => {
    const km = (pesos[i] / soma) * volumeTotal;
    out.set(d.dow, Math.round(km * 10) / 10);
  });
  return out;
}

// Curva de volume entre base e pico, conforme modelo e número de semanas.
// Retorna array com volume de cada semana (já considerando regenerativas 3:1).
export function curvaVolume(
  volumeBase: number,
  volumePico: number,
  semanas: number,
  modelo: ModeloPeriodizacao,
): number[] {
  if (semanas <= 0) return [];
  if (semanas === 1) return [volumeBase];

  const out: number[] = [];
  for (let i = 0; i < semanas; i++) {
    const t = i / Math.max(1, semanas - 1);
    let v: number;
    switch (modelo) {
      case "linear":
        v = volumeBase + (volumePico - volumeBase) * t;
        break;
      case "polarizado":
        // sobe mais devagar no começo, acelera no meio
        v = volumeBase + (volumePico - volumeBase) * Math.pow(t, 1.3);
        break;
      case "piramidal":
        // sobe e desce (taper natural)
        v = volumeBase + (volumePico - volumeBase) * Math.sin(t * Math.PI);
        break;
      case "reverso":
        // começa alto, vai baixando (foco em intensidade)
        v = volumePico - (volumePico - volumeBase) * t;
        break;
      default:
        v = volumeBase;
    }
    // Regra 3:1 — cada 4ª semana é regenerativa (60% do volume previsto)
    if ((i + 1) % 4 === 0) v = v * 0.6;
    out.push(Math.round(v * 10) / 10);
  }
  return out;
}

// Estima pace típico por tipo (para um valor único quando faz sentido).
// Para intervalado/tempo deixamos vazio — o coach define no detalhe.
function paceTipico(perfil: PerfilCorrida, tipo: SessaoTipo, zona: Zona): string | null {
  if (["forca", "mobilidade", "cross", "descanso"].includes(tipo)) return null;
  return paceMedioDaZona(perfil, zona);
}

function distanciaKmParaMin(km: number, perfil: PerfilCorrida, zona: Zona): number | null {
  const p = calcularPaceZona(perfil, zona);
  if (!p) return null;
  const [m, s] = p.max.split(":").map(Number);
  const seg = (m ?? 0) * 60 + (s ?? 0);
  if (!seg) return null;
  return Math.round((km * seg) / 60);
}

// Gera uma única semana a partir dos parâmetros + perfil.
export function gerarSemana(
  perfil: PerfilCorrida,
  params: ParamsGeracao,
  semanaIndice: number = 0,
  dataInicio?: string,
): SemanaGerada {
  const dataIni = dataInicio ?? params.semanaInicio;
  const dateObj = new Date(dataIni + "T00:00");
  const curva = curvaVolume(params.volumeBaseKm, params.volumePicoKm, params.semanasTotal, params.modelo);
  const volumeSemana = curva[semanaIndice] ?? params.volumeBaseKm;
  const ehRegen = (semanaIndice + 1) % 4 === 0;

  const diasAtivos = params.distribuicao.filter((d) => d.ativo && PESO_VOLUME[d.tipo] > 0);
  const volumes = distribuirVolume(diasAtivos, volumeSemana);

  const sessoes: SessaoGerada[] = [];
  for (const d of params.distribuicao) {
    if (!d.ativo) continue;
    const data = toISODate(addDays(dateObj, d.dow - 1));
    const km = volumes.get(d.dow) ?? null;
    const tipo = d.tipo;
    const isLongao = params.diaLongao === d.dow || tipo === "longao";

    sessoes.push({
      data,
      ordem_no_dia: 0,
      tipo,
      nome: isLongao ? "Longão" : NOMES_TIPO[tipo],
      duracao_min: km ? distanciaKmParaMin(km, perfil, d.zona) : null,
      distancia_km: km && PESO_VOLUME[tipo] > 0 ? km : null,
      pace_alvo: paceTipico(perfil, tipo, d.zona),
      zona_fc: fcDaZona(perfil, d.zona) ?? d.zona,
      objetivo: null,
    });
  }

  return {
    data_inicio: dataIni,
    numero_semana: numeroSemanaIso(dateObj),
    tipo_semana: ehRegen ? "regenerativa" : (semanaIndice === params.semanasTotal - 1 && params.escopo === "macrociclo" ? "polimento" : "normal"),
    volume_alvo_km: volumeSemana,
    ordem_no_macro: semanaIndice,
    objetivo: ehRegen ? "Semana regenerativa (3:1)" : "",
    sessoes,
  };
}

// Gera N semanas seguidas (mesociclo ou macrociclo).
export function gerarPlano(perfil: PerfilCorrida, params: ParamsGeracao): SemanaGerada[] {
  const out: SemanaGerada[] = [];
  const inicio = new Date(params.semanaInicio + "T00:00");
  for (let i = 0; i < params.semanasTotal; i++) {
    const dataIni = toISODate(addDays(inicio, i * 7));
    out.push(gerarSemana(perfil, params, i, dataIni));
  }
  return out;
}

// Distribuição default sensata pros 7 dias da semana
export const DISTRIBUICAO_DEFAULT: DistribuicaoDia[] = [
  { dow: 1, ativo: false, tipo: "descanso", zona: "Z1" }, // SEG
  { dow: 2, ativo: true, tipo: "intervalado", zona: "Z4" }, // TER
  { dow: 3, ativo: true, tipo: "regenerativo", zona: "Z2" }, // QUA
  { dow: 4, ativo: true, tipo: "tempo", zona: "Z3" }, // QUI
  { dow: 5, ativo: false, tipo: "descanso", zona: "Z1" }, // SEX
  { dow: 6, ativo: true, tipo: "regenerativo", zona: "Z2" }, // SÁB
  { dow: 7, ativo: true, tipo: "longao", zona: "Z2" }, // DOM
];

export const ZONA_DEFAULT_POR_TIPO: Record<SessaoTipo, Zona> = {
  longao: "Z2",
  regenerativo: "Z1",
  intervalado: "Z4",
  tempo: "Z3",
  fartlek: "Z4",
  strides: "Z4",
  forca: "Z1",
  mobilidade: "Z1",
  cross: "Z2",
  descanso: "Z1",
};
