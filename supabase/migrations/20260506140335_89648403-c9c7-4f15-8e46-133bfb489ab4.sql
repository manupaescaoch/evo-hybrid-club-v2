CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_perfil public.app_role;
  v_tem_admin boolean;
begin
  select exists(
    select 1 from public.usuarios_crm
    where perfil = 'admin' and ativo = true
  ) into v_tem_admin;

  if not v_tem_admin then
    v_perfil := 'admin';
  else
    v_perfil := 'visualizador';
  end if;

  insert into public.usuarios_crm (id, nome, email, perfil, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    v_perfil,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;