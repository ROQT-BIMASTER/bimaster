
# API Orçamento de Caixa (Previsto x Realizado) — Padronização Omie

## Status: ✅ Implementado

## Resumo

API de Orçamento de Caixa seguindo o padrão Omie `ListarOrcamentos`, retornando valores previstos e realizados por categoria para um dado mês/ano.

## Implementado

1. **Tabela `orcamentos_caixa`** — armazena orçamentos previstos por empresa/ano/mês/categoria com unique constraint e RLS
2. **Edge Function `orcamentos-caixa-api`** — rotas `/listar`, `/incluir`, `/incluir-lote`, `/status`
3. **Documentação** — `docs/API_ORCAMENTOS_CAIXA.md`
4. **UI** — Presets no ApiTester + seção no ApiDocumentation
