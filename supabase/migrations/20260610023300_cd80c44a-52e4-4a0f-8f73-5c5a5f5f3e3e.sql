alter table public.projeto_tarefa_responsaveis replica identity full;
alter table public.projeto_tarefa_colaboradores replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public' and tablename='projeto_tarefa_responsaveis'
  ) then
    execute 'alter publication supabase_realtime add table public.projeto_tarefa_responsaveis';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public' and tablename='projeto_tarefa_colaboradores'
  ) then
    execute 'alter publication supabase_realtime add table public.projeto_tarefa_colaboradores';
  end if;
end$$;