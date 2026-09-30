alter table public.alunos add column if not exists foto_url text;

insert into storage.buckets (id, name, public)
values ('aluno-fotos', 'aluno-fotos', true)
on conflict (id) do nothing;

drop policy if exists "public read aluno-fotos" on storage.objects;
create policy "public read aluno-fotos" on storage.objects
  for select to public using (bucket_id = 'aluno-fotos');

drop policy if exists "equipe upload aluno-fotos" on storage.objects;
create policy "equipe upload aluno-fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'aluno-fotos' and public.is_equipe_or_admin(auth.uid()));

drop policy if exists "equipe update aluno-fotos" on storage.objects;
create policy "equipe update aluno-fotos" on storage.objects
  for update to authenticated
  using (bucket_id = 'aluno-fotos' and public.is_equipe_or_admin(auth.uid()))
  with check (bucket_id = 'aluno-fotos' and public.is_equipe_or_admin(auth.uid()));

drop policy if exists "equipe delete aluno-fotos" on storage.objects;
create policy "equipe delete aluno-fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'aluno-fotos' and public.is_equipe_or_admin(auth.uid()));