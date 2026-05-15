UPDATE public.fabrica_ficha_custo_revisoes r
SET snapshot_totais = COALESCE(r.snapshot_totais, '{}'::jsonb)
  || jsonb_build_object(
       'ipi_percentual_saida', COALESCE(c.ipi_percentual_saida, 0)
     )
FROM public.fabrica_produto_custos_config c
WHERE r.config_id = c.id
  AND COALESCE(c.ipi_percentual_saida, 0) > 0
  AND COALESCE((r.snapshot_totais->>'ipi_incluido')::boolean, false) = false
  AND COALESCE(NULLIF(r.snapshot_totais->>'ipi_percentual_saida','')::numeric, 0) = 0
  AND COALESCE(NULLIF(r.snapshot_totais->>'totalIPI','')::numeric, 0) = 0;