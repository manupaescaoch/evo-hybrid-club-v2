-- Hybrid / HYROX workout builder
-- Additive migration: preserves all existing running plans and sessions.

alter table public.corrida_sessoes
  add column if not exists categoria text,
  add column if not exists unidade text,
  add column if not exists treinador text,
  add column if not exists status text not null default 'rascunho',
  add column if not exists resultado_geral_habilitado boolean not null default false,
  add column if not exists resultado_geral_tipo text,
  add column if not exists resultado_geral_unidade text,
  add column if not exists resultado_geral_criterio text;

alter table public.corrida_sessao_blocos
  add column if not exists formato text,
  add column if not exists prescricao text,
  add column if not exists orientacoes text,
  add column if not exists resultado_habilitado boolean not null default false,
  add column if not exists tipo_resultado text,
  add column if not exists unidade_resultado text,
  add column if not exists ranking_habilitado boolean not null default false,
  add column if not exists criterio_ranking text,
  add column if not exists visibilidade_ranking jsonb not null default '{}'::jsonb,
  add column if not exists ativo boolean not null default true,
  add column if not exists atualizado_em timestamptz not null default now();

-- Keep old content visible in the new builder.
update public.corrida_sessao_blocos
set prescricao = descricao
where prescricao is null and descricao is not null;

create table if not exists public.corrida_resultados (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.corrida_sessoes(id) on delete cascade,
  bloco_id uuid references public.corrida_sessao_blocos(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  tipo_resultado text not null,
  valor_numero numeric,
  valor_texto text,
  unidade text,
  unidade_filtro text,
  turma_filtro text,
  categoria_filtro text,
  sexo_filtro text,
  faixa_etaria_filtro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists corrida_resultados_bloco_aluno_uidx
  on public.corrida_resultados(sessao_id, bloco_id, aluno_id)
  where bloco_id is not null;

create unique index if not exists corrida_resultados_geral_aluno_uidx
  on public.corrida_resultados(sessao_id, aluno_id)
  where bloco_id is null;

create index if not exists corrida_resultados_ranking_idx
  on public.corrida_resultados(sessao_id, bloco_id, valor_numero);

alter table public.corrida_resultados enable row level security;

drop policy if exists "corrida_resultados_auth_all" on public.corrida_resultados;
create policy "corrida_resultados_auth_all"
on public.corrida_resultados
for all
to authenticated
using (true)
with check (true);

drop policy if exists "corrida_resultados_anon_select" on public.corrida_resultados;
create policy "corrida_resultados_anon_select"
on public.corrida_resultados
for select
to anon
using (true);

comment on table public.corrida_resultados is
  'Resultados por bloco ou resultado geral de sessões Hybrid/HYROX. Nunca apagar automaticamente ao editar prescrição.';
