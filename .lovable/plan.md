
Objetivo: fazer o banco mostrar a tabela como **Union** sem quebrar app, ingestão n8n e dashboards já em produção.

Plano de implementação

1) Diagnóstico rápido de dependências (pré-migração)
- Confirmar que hoje existe `public.vendas_union` (tabela) e que ela é usada por:
  - RLS (4 policies),
  - views analíticas (`vw_dashboard_kpis`, `vw_receita_empresa`, `vw_ranking_supervisores`, `vw_ranking_vendedores`),
  - edge function de ingestão,
  - hooks/páginas frontend.
- Isso evita renomear e derrubar queries ativas.

2) Migração segura de nome no banco (schema change)
- Executar migração SQL transacional para:
  - `ALTER TABLE public.vendas_union RENAME TO "Union";`
- Resultado: no banco a tabela passa a aparecer com nome **Union** (exatamente como você pediu).

3) Camada de compatibilidade imediata (sem quebrar frontend/n8n)
- Na mesma migração, criar uma view de compatibilidade com o nome antigo:
  - `CREATE VIEW public.vendas_union WITH (security_invoker=true) AS SELECT * FROM public."Union";`
- Conceder grants de leitura na view para os papéis usados pelo app.
- Motivo: todo código atual que consulta `vendas_union` continua funcionando enquanto o nome físico no banco vira `Union`.

4) Garantir que as views analíticas continuem corretas
- Recriar/ajustar as 4 views para apontar explicitamente para `public."Union"` (não para `vl_outros_custos`).
- Manter fórmula de receita inalterada:
  - `COALESCE(venda, preco_venda * quantidade, 0)`

5) Validação pós-migração
- Validar existência dos dois objetos:
  - tabela: `public."Union"`
  - view compatível: `public.vendas_union`
- Conferir contagem de linhas e amostra de colunas (`venda`, `preco_venda`, `quantidade`) idênticas.
- Testar ingestão da edge function (`/vendas-union-api/sync`) para garantir insert OK.
- Testar consultas dos dashboards para confirmar que nada quebrou.

Detalhes técnicos importantes
- `Union` é palavra reservada SQL; por isso o nome físico será sempre com aspas: `public."Union"`.
- A view de compatibilidade evita retrabalho imediato em dezenas de referências no código.
- Não haverá alteração na lógica de receita nem em dados existentes; apenas nome físico + compatibilidade.
