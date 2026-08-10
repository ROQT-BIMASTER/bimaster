# Corrigir a aplicação de clientes (timeout) e o registro de log

A carga do conector funcionou (42.276 clientes na área de staging), mas a etapa final falhou por dois motivos confirmados na base:

- A rotina que aplica os clientes na base mestre resolve o município com duas consultas por linha; com 42 mil linhas ela estoura o tempo limite.
- A rotina de recepção grava o log de sincronização com campos que não existem na tabela de log (`completed_at`, `sync_type`, etc.).

Um ponto do pedido precisa ser ajustado: a tabela de municípios **não tem** coluna `codigo_ibge` — o código IBGE está na própria coluna `id` (correção feita anteriormente). Portanto o join será por `id` e o índice sugerido em `codigo_ibge` não se aplica (a chave primária já cobre esse lookup).

## 1. Banco de dados

Reescrever `public.aplicar_clientes_rp_no_master()` mantendo assinatura, retorno e o bloco de gravação atual inalterados. Muda apenas a resolução de município:

- Join direto pelo código IBGE (`ibge_municipios.id = erp_clientes_raw.ibge_codigo`) para todas as linhas que têm código (42.263 de 42.276).
- Fallback por nome/UF apenas para as 13 linhas sem código, via `LATERAL` condicionado.
- Criar índice de expressão em municípios para o fallback por nome sem acento (`unaccent` é imutável, então o índice é válido): `LOWER(TRIM(unaccent(nome)))` + `uf_sigla`.
- Manter `REVOKE ALL ... FROM PUBLIC` e `GRANT EXECUTE ... TO service_role`.

## 2. Rotina de recepção do conector

Em `receber-clientes-rubysp`, trocar o registro de log para o formato real da tabela: `entity_type`, `entity_id` (uuid gerado), `action`, `direction`, `success`, `error_message`, `duration_ms`, `response_payload` com origem, quantidade de registros e resultado da aplicação. O log continua dentro de try/catch e passa a ser best-effort — falha de log não entra mais na lista de erros da resposta.

## 3. Validação

- Executar a aplicação na base mestre e confirmar retorno em poucos segundos com inseridos/atualizados/total com município.
- Conferir total de clientes e quantos ficaram com município resolvido.
- Conferir a visão de status usada pelo selo da tela Inteligência Municipal.

## Detalhes técnicos

- Migration: `CREATE OR REPLACE FUNCTION public.aplicar_clientes_rp_no_master()` com CTE `src` usando `LEFT JOIN public.ibge_municipios im_cod ON im_cod.id = r.ibge_codigo` e `LEFT JOIN LATERAL (... WHERE r.ibge_codigo IS NULL ... LIMIT 1) im_nome ON true`; CTE `ups` copiada literalmente da função atual (mesmas colunas, mesmos COALESCE, `RETURNING (xmax = 0) AS inserted`).
- `CREATE INDEX IF NOT EXISTS idx_ibge_municipios_nome_unaccent ON public.ibge_municipios (uf_sigla, LOWER(TRIM(public.unaccent(nome))));`
- Edge: `supabase/functions/receber-clientes-rubysp/index.ts` linhas do insert em `erp_sync_log`; redeploy da função.
