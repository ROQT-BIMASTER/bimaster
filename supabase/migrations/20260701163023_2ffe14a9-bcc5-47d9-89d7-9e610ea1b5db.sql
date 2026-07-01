
create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into public.mkt_marcas (nome, slug) values
  ('Ruby Rose', 'ruby-rose'),
  ('Melu', 'melu'),
  ('Não atribuído', 'nao-atribuido')
on conflict (slug) do nothing;
