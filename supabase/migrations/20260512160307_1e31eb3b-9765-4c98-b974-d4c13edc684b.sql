UPDATE public.china_produto_submissoes
SET status = 'enviado_brasil',
    data_envio = COALESCE(data_envio, updated_at, now())
WHERE status = 'enviado';