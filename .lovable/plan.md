# Vendedor real do ERP na tela + aplicação de clientes agendada

Duas entregas independentes.

Confirmado na base: a rotina da tela de Inteligência Municipal calcula o vendedor apenas pelo mapeamento manual de território (por microrregião); e a base mestre de clientes já tem nome de vendedor preenchido em 42.275 dos 42.952 clientes, com município resolvido em 42.370.

## Parte A — Coluna VENDEDOR com dado real do ERP

Recriar `fn_get_municipios_intelligence` mantendo assinatura, colunas de retorno, filtros, ordenação, SECURITY DEFINER e permissões idênticos. Única mudança: o cálculo do vendedor.

- Nova etapa interna que apura, por município, o vendedor com mais clientes (considerando apenas clientes com CNPJ válido e vendedor preenchido) e quantos vendedores distintos atuam ali.
- O mapeamento manual de território continua tendo prioridade; quando não existir, entra o vendedor dominante do ERP, com sufixo indicando os demais (ex.: "SP-IVANI DOMINGOS (+3)").
- O bloco atual de territórios permanece exatamente como está.

Sem mudança de frontend — a tabela já exibe esse campo.

Validação: consultar os 15 municípios com mais clientes e confirmar a coluna preenchida.

## Parte B — Aplicação staging→master agendada no banco

A aplicação dos clientes na base mestre chamada pela rotina de recepção continua estourando o teto de tempo do caminho HTTP (~8s). Mover a execução para dentro do banco, onde esse teto não existe.

- Agendar `aplicar_clientes_rp_no_master()` a cada 15 minutos (removendo o agendamento antes, caso já exista com o mesmo nome). Barato quando não há alteração, porque a rotina já grava apenas o delta.
- Na rotina de recepção `receber-clientes-rubysp`, a chamada direta continua (aplica na hora quando o volume é pequeno), mas deixa de ser bloqueante: se falhar, a resposta segue `ok: true`, com `aplicado: null` e `aplicacao: "agendada_pg_cron"`; o erro vai apenas para o registro de log, não para a lista de erros.

Validação: conferir o agendamento ativo e, após ~15 min, o histórico de execução com status de sucesso.

## Detalhes técnicos

- Migration 1: `CREATE OR REPLACE FUNCTION public.fn_get_municipios_intelligence(...)` com CTE `vendedor_erp` (`DISTINCT ON (ibge_municipio_id)` sobre agregação por município+vendedor, com `COUNT(*) OVER (PARTITION BY ibge_municipio_id)` para total de vendedores), `LEFT JOIN vendedor_erp ve ON ve.ibge_municipio_id = im.id` na CTE `base` e `COALESCE(va.vendedor_nome, ve.vendedor || CASE WHEN ve.total_vendedores > 1 THEN ' (+' || (ve.total_vendedores - 1) || ')' ELSE '' END)`. Restante do corpo copiado literalmente.
- Migration 2: `cron.unschedule('aplicar-clientes-rp-no-master')` condicional + `cron.schedule('aplicar-clientes-rp-no-master', '*/15 * * * *', $$SELECT public.aplicar_clientes_rp_no_master();$$)`.
- Edge: `supabase/functions/receber-clientes-rubysp/index.ts` — bloco `finalizar === true` com try/catch que não empurra a falha para `errors[]`; redeploy da função.
