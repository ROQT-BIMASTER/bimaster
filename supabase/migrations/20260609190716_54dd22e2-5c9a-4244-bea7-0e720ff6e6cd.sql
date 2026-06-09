UPDATE public.rr_produtos
SET wf = jsonb_build_object(
  'Briefing','NÃO INICIADO','Desenho Técnico','NÃO INICIADO','Primária','NÃO INICIADO',
  'Caixa Master','NÃO INICIADO','Display','NÃO INICIADO','Provador','NÃO INICIADO',
  'Etiqueta Bula','NÃO INICIADO','Etiqueta Display','NÃO INICIADO','Etiqueta Fundo','NÃO INICIADO',
  'Etiqueta Provador','NÃO INICIADO','QR Code','NÃO INICIADO','Aprovação Licenciador','NÃO INICIADO'
)
WHERE sku = 'SKUteste' AND source_system = 'huggs';