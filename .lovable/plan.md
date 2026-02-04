

# Otimização do sync_control - Eliminar Gastos Desnecessários

## Diagnóstico Definitivo

### Problema Identificado
O N8N está funcionando corretamente, enviando ~3000 registros por chamada. O problema está em **dois lugares**:

| Problema | Evidência | Impacto |
|----------|-----------|---------|
| **Frequência excessiva** | 2.830 chamadas/hora = 47 chamadas/minuto | Processamento constante |
| **Dados repetidos** | 280.900 registros/hora = mesmos ~3000 registros enviados 100x | 99% desperdício |
| **Logs excessivos** | Cada chamada insere em sync_control | 519k linhas, 593MB |

### Cálculo do Desperdício

```text
Por hora:
- Chamadas: 2.830
- Registros enviados: 280.900
- Registros ÚNICOS por empresa: ~3.000
- Fator de repetição: 280.900 / 3.000 = ~93x (!)

Por dia:
- Chamadas: 67.920
- Registros processados: 6.7 milhões
- Registros que DEVERIAM ser: ~18.000 (6 empresas x 3000)
- Desperdício: 99.7%
```

---

## Causa Raiz

O N8N está configurado com **Schedule Trigger a cada ~30 segundos** ou está em **loop contínuo** sem verificar se os dados já foram sincronizados.

A Edge Function faz o que deveria: processa e registra. Mas está sendo chamada **excessivamente**.

---

## Solução em 3 Frentes

### Frente 1: Agregar Logs (Impacto Imediato)

**Remover insert de sync_control do endpoint `/sync`** (endpoint legado) e usar apenas `/sync-complete` para consolidar:

```typescript
// ANTES: Cada chamada insere no sync_control
await supabase.from('sync_control').insert({...}); // ❌

// DEPOIS: Apenas /sync-complete insere (1x por sync_id)
if (path.endsWith('/sync-complete')) {
  // Agregar chunks e inserir UMA vez
}
```

### Frente 2: Implementar "Skip if No Changes" na Edge Function

Adicionar lógica para retornar IMEDIATAMENTE se não há alterações reais:

```typescript
// No início do processamento
const result = await processRecordsWithRetry(...);

// Se 100% foi skipped, NÃO registrar no sync_control
if (result.inserted === 0 && result.updated === 0) {
  return new Response(JSON.stringify({
    success: true,
    skipped: true,
    message: 'Nenhuma alteração detectada - log ignorado'
  }));
  // NÃO inserir em sync_control!
}
```

### Frente 3: Limpeza e Manutenção Agressiva

```sql
-- 1. Limpar sync_control (manter 24h apenas)
DELETE FROM sync_control WHERE created_at < NOW() - INTERVAL '24 hours';

-- 2. Alterar cron de limpeza para 4x/dia (a cada 6h)
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-sync-control-daily'),
  schedule := '0 */6 * * *'
);

-- 3. Limpar tabelas relacionadas
TRUNCATE sync_chunks_tracking;
```

---

## Alterações Técnicas

### Arquivo: `supabase/functions/contas-pagar-api/index.ts`

**Mudança 1:** No endpoint `/sync` (legado) - linhas ~928-943:
- Adicionar condição para só inserir em sync_control se houve alterações

**Mudança 2:** No endpoint `/sync-incremental` - linhas ~743-754:
- Mesmo tratamento: só logar se houve inserção/atualização

**Mudança 3:** No endpoint `/bulk-sync` - já usa sync_chunks_tracking:
- Manter como está (chunks separados são OK pois consolida em /sync-complete)

### Arquivo: `supabase/functions/contas-receber-api/index.ts`
- Aplicar mesmas alterações para consistência

### Migração SQL:
- Reduzir retenção de sync_control de 7 dias para 1 dia
- Aumentar frequência de limpeza para 4x/dia
- Limpar dados antigos imediatamente

---

## Impacto Esperado

| Métrica | Antes | Depois | Redução |
|---------|-------|--------|---------|
| Inserções sync_control/hora | 2.830 | ~6 (1 por empresa) | 99.8% |
| Tamanho sync_control | 593 MB | ~5 MB | 99% |
| Linhas sync_control | 519.000 | ~1.000 | 99.8% |
| Custo estimado | Alto | Mínimo | 95%+ |

---

## Recomendação Adicional (N8N)

Embora o problema não seja do N8N em si, sugiro verificar:

1. **Schedule Trigger**: Confirmar que está configurado para intervalos maiores (a cada 1-6 horas)
2. **Query SQL do ERP**: Filtrar apenas `WHERE data_modificacao > :ultima_sync`
3. **Workflow duplicado**: Verificar se não há múltiplas cópias do workflow rodando

---

## Resumo de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/contas-pagar-api/index.ts` | Skip sync_control se 0 alterações |
| `supabase/functions/contas-receber-api/index.ts` | Mesma lógica |
| **Migração SQL** | Retenção 1 dia + limpeza 4x/dia + truncate |

