
-- Enums
create type public.app_role as enum ('admin','equipe','visualizador');
create type public.aluno_modalidade as enum ('mpteam','mp_elite','mp_presencial');
create type public.aluno_status as enum (
  'aguardando_anamnese','anamnese_recebida','em_producao','ativo',
  'aguardando_renovacao','renovado','cancelado'
);
create type public.job_tipo as enum (
  'boas_vindas','link_anamnese','d1','d7','d15_formulario','d21',
  'd27','d29','d30','d31','ia_feedback_quinzenal','ia_check_shape','resumo_diario'
);
create type public.formulario_tipo as enum ('anamnese','feedback_quinzenal','check_shape');
create type public.template_modalidade as enum ('mpteam','mp_elite','mp_presencial','todas');
create type public.prompt_tipo as enum ('feedback_quinzenal','check_shape');
create type public.envio_status as enum ('enviado','erro');

-- Generic updated_at trigger
create or replace function public.tg_set_atualizado_em()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em = now(); return new; end; $$;

-- usuarios_crm
create table public.usuarios_crm (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  perfil public.app_role not null default 'visualizador',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.usuarios_crm enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_crm
    where id = _user_id and perfil = _role and ativo = true)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin') $$;

create or replace function public.is_equipe_or_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin') or public.has_role(_user_id, 'equipe') $$;

create or replace function public.is_crm_user(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_crm where id = _user_id and ativo = true) $$;

-- Auto-create usuarios_crm row on signup; seed admin email becomes admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_perfil public.app_role;
begin
  if lower(new.email) = lower('emanuel.paes@gmail.com') then v_perfil := 'admin';
  else v_perfil := 'visualizador';
  end if;
  insert into public.usuarios_crm (id, nome, email, perfil, ativo)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email, v_perfil, true)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "crm users read crm users" on public.usuarios_crm
  for select to authenticated using (public.is_crm_user(auth.uid()));
create policy "admin manage crm users" on public.usuarios_crm
  for all to authenticated using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- alunos
create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  email text,
  modalidade public.aluno_modalidade,
  plano text,
  valor_plano numeric(10,2),
  prazo_dias integer not null default 30,
  status public.aluno_status not null default 'aguardando_anamnese',
  data_compra timestamptz,
  data_anamnese timestamptz,
  data_d0 timestamptz,
  data_expiracao timestamptz,
  renovado boolean not null default false,
  total_renovacoes integer not null default 0,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index alunos_status_idx on public.alunos(status);
create index alunos_modalidade_idx on public.alunos(modalidade);
create index alunos_data_expiracao_idx on public.alunos(data_expiracao);
create trigger alunos_set_atualizado_em before update on public.alunos
  for each row execute function public.tg_set_atualizado_em();
alter table public.alunos enable row level security;

create policy "crm users read alunos" on public.alunos
  for select to authenticated using (public.is_crm_user(auth.uid()));
create policy "equipe insert alunos" on public.alunos
  for insert to authenticated with check (public.is_equipe_or_admin(auth.uid()));
create policy "equipe update alunos" on public.alunos
  for update to authenticated using (public.is_equipe_or_admin(auth.uid()))
  with check (public.is_equipe_or_admin(auth.uid()));
create policy "admin delete alunos" on public.alunos
  for delete to authenticated using (public.is_admin(auth.uid()));

-- jobs_disparos
create table public.jobs_disparos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references public.alunos(id) on delete cascade,
  tipo public.job_tipo not null,
  agendado_para timestamptz not null,
  executado boolean not null default false,
  executado_em timestamptz,
  tentativas integer not null default 0,
  erro text,
  criado_em timestamptz not null default now()
);
create index jobs_executado_agendado_idx on public.jobs_disparos(executado, agendado_para);
create index jobs_aluno_idx on public.jobs_disparos(aluno_id);
alter table public.jobs_disparos enable row level security;

create policy "crm users read jobs" on public.jobs_disparos
  for select to authenticated using (public.is_crm_user(auth.uid()));
create policy "equipe write jobs" on public.jobs_disparos
  for all to authenticated using (public.is_equipe_or_admin(auth.uid()))
  with check (public.is_equipe_or_admin(auth.uid()));

-- formularios
create table public.formularios (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references public.alunos(id) on delete cascade,
  tipo public.formulario_tipo not null,
  token text not null unique default gen_random_uuid()::text,
  link_publico text,
  recebido_em timestamptz not null default now(),
  respondido boolean not null default false,
  respondido_em timestamptz,
  dados_resposta jsonb,
  criado_em timestamptz not null default now()
);
create index formularios_aluno_idx on public.formularios(aluno_id);
create index formularios_token_idx on public.formularios(token);
alter table public.formularios enable row level security;

-- Public can read/update by token (needed for the public form page; app filters by token in URL)
create policy "public read formularios" on public.formularios for select using (true);
create policy "public update formularios" on public.formularios for update using (true) with check (true);
create policy "equipe insert formularios" on public.formularios
  for insert to authenticated with check (public.is_equipe_or_admin(auth.uid()));
create policy "admin delete formularios" on public.formularios
  for delete to authenticated using (public.is_admin(auth.uid()));

-- mensagens_template
create table public.mensagens_template (
  id uuid primary key default gen_random_uuid(),
  modalidade public.template_modalidade not null,
  tipo_job public.job_tipo not null,
  texto text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
create unique index mensagens_template_uniq on public.mensagens_template(tipo_job, modalidade);
create trigger mensagens_template_set_atualizado_em before update on public.mensagens_template
  for each row execute function public.tg_set_atualizado_em();
alter table public.mensagens_template enable row level security;

create policy "crm users read templates" on public.mensagens_template
  for select to authenticated using (public.is_crm_user(auth.uid()));
create policy "admin write templates" on public.mensagens_template
  for all to authenticated using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- prompts_ia
create table public.prompts_ia (
  id uuid primary key default gen_random_uuid(),
  tipo public.prompt_tipo not null unique,
  prompt_sistema text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
create trigger prompts_ia_set_atualizado_em before update on public.prompts_ia
  for each row execute function public.tg_set_atualizado_em();
alter table public.prompts_ia enable row level security;

create policy "crm users read prompts" on public.prompts_ia
  for select to authenticated using (public.is_crm_user(auth.uid()));
create policy "admin write prompts" on public.prompts_ia
  for all to authenticated using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- historico_status
create table public.historico_status (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references public.alunos(id) on delete cascade,
  status_de text,
  status_para text,
  alterado_por text,
  criado_em timestamptz not null default now()
);
create index historico_status_aluno_idx on public.historico_status(aluno_id);
alter table public.historico_status enable row level security;

create policy "crm users read historico" on public.historico_status
  for select to authenticated using (public.is_crm_user(auth.uid()));
create policy "public insert historico" on public.historico_status for insert with check (true);
create policy "equipe insert historico" on public.historico_status
  for insert to authenticated with check (public.is_equipe_or_admin(auth.uid()));

-- mensagens_log
create table public.mensagens_log (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references public.alunos(id) on delete cascade,
  tipo_job text,
  whatsapp_destino text,
  mensagem_enviada text,
  status_envio public.envio_status,
  erro_detalhe text,
  enviado_em timestamptz not null default now()
);
create index mensagens_log_aluno_idx on public.mensagens_log(aluno_id);
alter table public.mensagens_log enable row level security;

create policy "crm users read mensagens_log" on public.mensagens_log
  for select to authenticated using (public.is_crm_user(auth.uid()));
create policy "equipe write mensagens_log" on public.mensagens_log
  for all to authenticated using (public.is_equipe_or_admin(auth.uid()))
  with check (public.is_equipe_or_admin(auth.uid()));
