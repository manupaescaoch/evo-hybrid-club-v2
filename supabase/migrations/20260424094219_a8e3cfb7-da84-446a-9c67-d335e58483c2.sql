-- 1. coluna origem em alunos
alter table public.alunos
  add column if not exists origem text not null default 'manual';

-- 2. unique no whatsapp normalizado
create unique index if not exists alunos_whatsapp_digits_uidx
  on public.alunos ((regexp_replace(whatsapp, '\D', '', 'g')));

-- 3. policy de insert pública para formularios
drop policy if exists "public insert formularios publicos" on public.formularios;
create policy "public insert formularios publicos"
  on public.formularios
  for insert
  to anon, authenticated
  with check (origem = 'publico' and respondido = false);

-- 4. policy de insert pública para alunos (apenas via anamnese)
drop policy if exists "public insert aluno via anamnese" on public.alunos;
create policy "public insert aluno via anamnese"
  on public.alunos
  for insert
  to anon
  with check (origem = 'anamnese');

-- 5. RPC para buscar aluno por telefone normalizado
create or replace function public.buscar_aluno_por_telefone(_telefone text)
returns table(id uuid, nome text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.nome
  from public.alunos a
  where regexp_replace(a.whatsapp, '\D', '', 'g') = regexp_replace(_telefone, '\D', '', 'g')
    and length(regexp_replace(_telefone, '\D', '', 'g')) >= 8
  limit 1;
$$;

grant execute on function public.buscar_aluno_por_telefone(text) to anon, authenticated;