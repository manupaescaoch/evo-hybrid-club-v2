import { useEffect, useState } from "react";
import { Loader2, Save, Heart, Activity, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { parsePace, formatPace, descreverZonaComEsteira, type PerfilCorrida } from "@/lib/corrida-zonas";

export function PerfilCorridaTab({ alunoId, onChange }: { alunoId: string; onChange?: (p: PerfilCorrida) => void }) {
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fcMax, setFcMax] = useState("");
  const [fcRep, setFcRep] = useState("");
  const [paceLimiar, setPaceLimiar] = useState(""); // formato mm:ss
  const [vdot, setVdot] = useState("");
  const [nivel, setNivel] = useState("intermediario");
  const [volume, setVolume] = useState("");
  const [exp, setExp] = useState("");
  const [lesoes, setLesoes] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("corrida_perfil")
        .select("*")
        .eq("aluno_id", alunoId)
        .maybeSingle();
      if (cancel) return;
      if (data) {
        setFcMax(data.fc_max ? String(data.fc_max) : "");
        setFcRep(data.fc_repouso ? String(data.fc_repouso) : "");
        setPaceLimiar(data.pace_limiar_seg ? formatPace(data.pace_limiar_seg) : "");
        setVdot(data.vdot ? String(data.vdot) : "");
        setNivel(data.nivel ?? "intermediario");
        setVolume(data.volume_semanal_km ? String(data.volume_semanal_km) : "");
        setExp(data.experiencia_anos ? String(data.experiencia_anos) : "");
        setLesoes(data.historico_lesoes ?? "");
        onChange?.({
          fc_max: data.fc_max,
          fc_repouso: data.fc_repouso,
          pace_limiar_seg: data.pace_limiar_seg,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [alunoId, onChange]);

  const perfilParcial: PerfilCorrida = {
    fc_max: fcMax ? Number(fcMax) : null,
    fc_repouso: fcRep ? Number(fcRep) : null,
    pace_limiar_seg: parsePace(paceLimiar),
  };

  async function salvar() {
    setSaving(true);
    try {
      const paceSeg = parsePace(paceLimiar);
      const payload = {
        aluno_id: alunoId,
        fc_max: fcMax ? Number(fcMax) : null,
        fc_repouso: fcRep ? Number(fcRep) : null,
        pace_limiar_seg: paceSeg,
        vdot: vdot ? Number(vdot) : null,
        nivel,
        volume_semanal_km: volume ? Number(volume) : null,
        experiencia_anos: exp ? Number(exp) : null,
        historico_lesoes: lesoes.trim() || null,
      };
      const { error } = await supabase
        .from("corrida_perfil")
        .upsert(payload, { onConflict: "aluno_id" });
      if (error) throw error;
      toast.success("Perfil de corrida salvo!");
      onChange?.({
        fc_max: payload.fc_max,
        fc_repouso: payload.fc_repouso,
        pace_limiar_seg: payload.pace_limiar_seg,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando perfil...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Frequência cardíaca</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="FC máxima (bpm)">
            <Inp value={fcMax} onChange={setFcMax} type="number" placeholder="190" />
          </Field>
          <Field label="FC repouso (bpm)">
            <Inp value={fcRep} onChange={setFcRep} type="number" placeholder="55" />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Referências de pace</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pace de limiar (min/km)">
            <Inp value={paceLimiar} onChange={setPaceLimiar} placeholder="5:00" />
          </Field>
          <Field label="VDOT (Jack Daniels)">
            <Inp value={vdot} onChange={setVdot} type="number" placeholder="45" />
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Pace de limiar = ritmo que o aluno sustenta por ~1h em prova. Base para todas as outras zonas.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Perfil geral</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Nível">
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              className="w-full rounded-lg bg-muted/40 focus:bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </Field>
          <Field label="Volume atual (km/sem)">
            <Inp value={volume} onChange={setVolume} type="number" placeholder="40" />
          </Field>
          <Field label="Experiência (anos)">
            <Inp value={exp} onChange={setExp} type="number" placeholder="2" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Histórico de lesões / restrições">
            <textarea
              value={lesoes}
              onChange={(e) => setLesoes(e.target.value)}
              rows={3}
              placeholder="Ex: condromalácia em joelho direito, tendinite de aquiles em 2023..."
              className="w-full rounded-lg bg-muted/40 focus:bg-background border border-input px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Zonas calculadas</h3>
        {!perfilParcial.fc_max && !perfilParcial.fc_repouso && !perfilParcial.pace_limiar_seg ? (
          <p className="text-xs text-muted-foreground">
            Preencha FC e/ou pace de limiar para visualizar as zonas.
          </p>
        ) : (
          <ul className="space-y-2">
            {(["Z1", "Z2", "Z3", "Z4", "Z5"] as const).map((z) => (
              <li key={z} className="flex items-center justify-between text-sm rounded-md bg-muted/30 px-3 py-2">
                <span className="font-semibold">{z}</span>
                <span className="text-muted-foreground text-xs">{descreverZonaComEsteira(perfilParcial, z)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={salvar}
          disabled={saving || !canEdit}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar perfil
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Inp({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg bg-muted/40 focus:bg-background border border-input px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}
