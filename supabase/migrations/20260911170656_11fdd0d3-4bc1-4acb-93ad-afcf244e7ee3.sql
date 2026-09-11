insert into public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo, screen_code)
values ('fornecedor','forn_pedidos_result','Pedidos em andamento','ClipboardList','/dashboard/fornecedor/pedidos-result',0,true,'fornecedor_vendas')
on conflict do nothing;

insert into public.sidebar_category_modules (category_id, module_code, ordem, ativo)
select c.id, 'fornecedor', 5, true from public.sidebar_categories c
where c.key = 'comercial_vendas'
and not exists (select 1 from public.sidebar_category_modules m where m.category_id = c.id and m.module_code = 'fornecedor');