-- Tabela de check-ins diários do aluno
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  data_checkin date not null default current_date,
  sono_horas numeric,
  qualidade_sono integer,
  energia integer,
  humor integer,
  alimentacao_fim_semana text,
  exagero_fim_semana text,
  foco_semana text,
  score_gerado integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aluno_id, data_checkin)
);

create index if not exists idx_daily_checkins_aluno_data
  on public.daily_checkins(aluno_id, data_checkin desc);

drop trigger if exists tg_daily_checkins_updated on public.daily_checkins;
create trigger tg_daily_checkins_updated
  before update on public.daily_checkins
  for each row execute function public.tg_set_updated_at();

alter table public.daily_checkins enable row level security;

drop policy if exists "crm read daily_checkins" on public.daily_checkins;
create policy "crm read daily_checkins" on public.daily_checkins
  for select to authenticated using (public.is_crm_user(auth.uid()));

drop policy if exists "equipe write daily_checkins" on public.daily_checkins;
create policy "equipe write daily_checkins" on public.daily_checkins
  for all to authenticated
  using (public.is_equipe_or_admin(auth.uid()))
  with check (public.is_equipe_or_admin(auth.uid()));

drop policy if exists "admin delete daily_checkins" on public.daily_checkins;
create policy "admin delete daily_checkins" on public.daily_checkins
  for delete to authenticated using (public.is_admin(auth.uid()));

-- View de estatísticas semanais (últimos 7 dias)
create or replace view public.weekly_checkin_stats as
select
  aluno_id,
  avg(sono_horas)            as media_sono_7d,
  avg(energia)::numeric      as media_energia_7d,
  avg(humor)::numeric        as media_humor_7d,
  count(*)                   as total_checkins_7d
from public.daily_checkins
where data_checkin >= current_date - interval '6 days'
group by aluno_id;
