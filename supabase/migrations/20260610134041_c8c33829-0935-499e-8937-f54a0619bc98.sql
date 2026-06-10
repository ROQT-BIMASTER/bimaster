create or replace function public.admin_copilot_v2_stats(p_days int default 7)
returns table (
  copilot_id text,
  is_v2 boolean,
  runs bigint,
  avg_latency_ms numeric,
  avg_unverifiable numeric,
  total_breaches bigint,
  last_run timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    regexp_replace(coalesce(cr.copilot_id,''), '@v2$', '') as copilot_id,
    (cr.copilot_id like '%@v2') as is_v2,
    count(*)::bigint as runs,
    round(avg(coalesce(cr.latency_ms,0))::numeric, 1) as avg_latency_ms,
    round(avg(coalesce(cr.unverifiable_numbers,0))::numeric, 2) as avg_unverifiable,
    sum(coalesce(cr.rag_breach_blocked,0))::bigint as total_breaches,
    max(cr.created_at) as last_run
  from public.copilot_runs cr
  where cr.created_at >= now() - make_interval(days => greatest(p_days,1))
    and public.has_role(auth.uid(), 'admin'::app_role)
  group by 1, 2
  order by 1, 2;
$$;

revoke all on function public.admin_copilot_v2_stats(int) from public, anon;
grant execute on function public.admin_copilot_v2_stats(int) to authenticated;

create or replace function public.admin_set_copilot_v2_flag(p_codigo text, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_codigo !~ '^ff_copilot_v2_[a-z_]+$' then
    raise exception 'invalid_flag_code' using errcode = '22023';
  end if;
  update public.feature_flags
     set ativo = p_ativo,
         updated_at = now()
   where codigo = p_codigo;
  if not found then
    raise exception 'flag_not_found' using errcode = '02000';
  end if;
end;
$$;

revoke all on function public.admin_set_copilot_v2_flag(text, boolean) from public, anon;
grant execute on function public.admin_set_copilot_v2_flag(text, boolean) to authenticated;