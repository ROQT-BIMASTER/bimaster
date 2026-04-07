

# Corrigir Classificação IA + Gatilho Automático Diário

## Problema

A classificação IA processa 15 grupos mas exibe 0 Sucesso e 0 Erros. Ao testar a edge function diretamente, ela funciona — mas retorna `success: "uuid-string"` em vez de `success: true` (bug no tipo booleano). Além disso, os lotes paralelos podem estar retornando erros silenciosos que o dialog ignora (auth 401 ou rate limit), fazendo com que os contadores nunca incrementem.

## Correções

### 1. Edge Function `classificar-contas-batch`

- **Fix boolean**: Linha 226 — `const hasValidClassification = dept?.id && conta?.id` retorna UUID string. Corrigir para `Boolean(dept?.id && conta?.id)`
- **Usar tool_calling**: Substituir o parsing de JSON free-text por tool calling estruturado, eliminando falhas de parse quando a IA retorna JSON malformado

### 2. Dialog `ClassificarContasPagarDialog.tsx`

- **Tratar erros de batch como contagem**: Quando `error` retorna do `supabase.functions.invoke`, contar os grupos daquele batch como erro em vez de silenciosamente pular com `continue`
- **Tratar `!data?.results`**: Idem — contar como erro
- **Melhorar logs**: Mostrar toast com detalhes quando um lote inteiro falha

### 3. Edge Function de classificação automática diária

- Criar nova edge function `auto-classificar-contas` que:
  - Busca grupos não classificados (mesma lógica do dialog)
  - Chama `classificar-contas-batch` internamente em lotes
  - Registra log do resultado na tabela `classification_auto_logs`
- Agendar via `pg_cron` para rodar 1x/dia (ex: 06:00 UTC)

### 4. Tabela de log automático

- Criar tabela `classification_auto_logs` com campos: `id`, `executed_at`, `total_groups`, `success_count`, `error_count`, `details`

## Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/classificar-contas-batch/index.ts` | Fix boolean + tool_calling |
| `src/components/configuracoes/ClassificarContasPagarDialog.tsx` | Tratar erros silenciosos de batch |
| `supabase/functions/auto-classificar-contas/index.ts` | Nova edge function para cron |
| Migração SQL | Tabela `classification_auto_logs` + job pg_cron |

