
create policy "mkt_midia_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'mkt-midia');
