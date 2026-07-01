
alter table public.mkt_posts
  add column if not exists midia_origem_url text,
  add column if not exists midia_cache_path text,
  add column if not exists midia_status text,
  add column if not exists midia_content_type text,
  add column if not exists midia_cached_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mkt_posts_midia_status_check'
  ) then
    alter table public.mkt_posts
      add constraint mkt_posts_midia_status_check
      check (midia_status is null or midia_status in ('pendente','ok','sem_midia','erro'));
  end if;
end $$;

create index if not exists idx_mkt_posts_midia_pendente
  on public.mkt_posts(id) where midia_status = 'pendente';
