// Constantes compartilhadas pelo planejador de corrida
import {
  Footprints,
  Activity,
  Zap,
  Timer,
  Flame,
  Dumbbell,
  Wind,
  Bike,
  Moon,
  Gauge,
  type LucideIcon,
} from "lucide-react";

export type SessaoTipo =
  | "longao"
  | "regenerativo"
  | "intervalado"
  | "tempo"
  | "fartlek"
  | "strides"
  | "forca"
  | "mobilidade"
  | "cross"
  | "descanso";

export const TIPOS_SESSAO: { value: SessaoTipo; label: string; curto: string; Icon: LucideIcon; cor: string }[] = [
  { value: "longao", label: "Longão", curto: "Long", Icon: Footprints, cor: "#0033FF" },
  { value: "regenerativo", label: "Regenerativo", curto: "Reg", Icon: Wind, cor: "#22C55E" },
  { value: "intervalado", label: "Intervalado", curto: "Inter", Icon: Activity, cor: "#EF4444" },
  { value: "tempo", label: "Tempo run", curto: "Tempo", Icon: Gauge, cor: "#F97316" },
  { value: "fartlek", label: "Fartlek", curto: "Fart", Icon: Zap, cor: "#A855F7" },
  { value: "strides", label: "Strides", curto: "Stride", Icon: Zap, cor: "#06B6D4" },
  { value: "forca", label: "Força", curto: "Força", Icon: Dumbbell, cor: "#0D0D0D" },
  { value: "mobilidade", label: "Mobilidade", curto: "Mob", Icon: Timer, cor: "#94A3B8" },
  { value: "cross", label: "Cross training", curto: "XT", Icon: Bike, cor: "#7C3AED" },
  { value: "descanso", label: "Descanso", curto: "Off", Icon: Moon, cor: "#9CA3AF" },
];

export function tipoSessaoMeta(tipo: string) {
  return TIPOS_SESSAO.find((t) => t.value === tipo) ?? { value: tipo, label: tipo, curto: tipo, Icon: Flame, cor: "#6B7280" };
}

export type BlocoTipo =
  | "aquecimento"
  | "rodagem"
  | "intervalado"
  | "strides"
  | "tempo"
  | "desaquecimento"
  | "forca";

export const TIPOS_BLOCO: { value: BlocoTipo; label: string }[] = [
  { value: "aquecimento", label: "Aquecimento" },
  { value: "rodagem", label: "Rodagem" },
  { value: "intervalado", label: "Intervalado" },
  { value: "tempo", label: "Tempo" },
  { value: "strides", label: "Strides" },
  { value: "forca", label: "Força" },
  { value: "desaquecimento", label: "Desaquecimento" },
];

export const TIPOS_SEMANA = [
  { value: "normal", label: "Normal" },
  { value: "forte", label: "Forte" },
  { value: "regenerativa", label: "Regenerativa" },
  { value: "choque", label: "Choque" },
  { value: "polimento", label: "Polimento" },
] as const;

export const DIAS_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
