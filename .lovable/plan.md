

# Fix: Loop Infinito no N8N - Contas a Pagar

## Problema Identificado

Dois problemas encadeados estão causando o loop infinito:

### 1. Erro na Função SQL: `relation "contas_pagar" does not exist`
Os logs mostram que a função `bulk_upsert_contas_pagar_v2` está falhando com erro `42P01` - a tabela `contas_pagar` não é encontrada. Isso aconteceu porque ao dropar a versão de 1 parâmetro da função (`DROP FUNCTION IF EXISTS public.bulk_upsert_contas_pagar_v2(jsonb)`), o PostgreSQL pode ter removido a versão errada ou a função de 2 parâmetros ficou com o `search_path` incorreto.

### 2. `sync_control` Nunca Atualiza
Como todos os registros falham e caem no fallback (skipped), a otimização na linha 934 do edge function diz "só registrar em sync_control se houve alterações reais". Como nunca há alterações (tudo é skipped por erro), o `/last-sync` retorna sempre a mesma data antiga, e o n8n busca os mesmos dados infinitamente.

## Plano de Correção

### Tarefa 1: Recriar a função `bulk_upsert_contas_pagar_v2` corretamente
- Criar migration SQL que recria a função de 2 parâmetros com `SET search_path = public` explícito
- Garantir que referencia `public.contas_pagar` com schema completo

### Tarefa 2: Sempre atualizar `sync_control` no endpoint `/sync`
- Modificar o edge function para SEMPRE registrar em `sync_control` após processar, mesmo quando todos os registros são skipped
- Isso garante que `/last-sync` retorna uma data atualizada e o n8n não reenvia os mesmos dados

### Tarefa 3: Redesenhar a Edge Function
- No endpoint `/sync` (linhas 933-951), remover a condicional `if (result.inserted > 0 || result.updated > 0)` e sempre inserir no `sync_control`
- Isso quebra o ciclo infinito mesmo em cenários de erro

## Detalhes Técnicos

**Migration SQL:**
```sql
CREATE OR REPLACE FUNCTION public.bulk_upsert_contas_pagar_v2(
  p_records jsonb, 
  p_force_update boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ ... $$;
```

**Edge Function - remover condicional:**
```typescript
// ANTES (linha 934):
if (result.inserted > 0 || result.updated > 0) {
  await supabase.from('sync_control').insert({...});
}

// DEPOIS:
await supabase.from('sync_control').insert({...});
```

