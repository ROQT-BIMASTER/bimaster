

# Contas a Receber — Resync, Validação e Painel de Monitoramento

## Diagnóstico Completo

### Problema 1: Status incorretos no `erp-sync-engine`
A function `deriveStatus()` no sync direto usa `"pago"` e `"aberto"`, enquanto todo o frontend e as RPCs esperam `"recebido"`, `"pendente"`, `"vencido"` e `"parcial"`. Se rodarmos o sync direto agora, **todos os status serão sobrescritos com valores errados**.

Além disso, falta a lógica de `vencido` (data_vencimento < hoje) que existe na `contas-receber-api` (N8N).

**Correção**: Alinhar `deriveStatus()` no `erp-sync-engine/index.ts`:
```typescript
function deriveStatus(valorAberto: number, valorPago: number, dataVencimento: string | null): string {
  if (valorAberto === 0 && valorPago > 0) return "recebido";
  if (valorPago > 0 && valorAberto > 0) return "parcial";
  if (valorAberto > 0 && dataVencimento) {
    const venc = new Date(dataVencimento + 'T00:00:00');
    if (venc < new Date(new Date().toISOString().split('T')[0] + 'T00:00:00')) return "vencido";
  }
  return "pendente";
}
```

### Problema 2: Lógica de `valor_recebido` incompleta
A `contas-receber-api` tem lógica extra para derivar `valor_recebido` quando o campo vem zerado (ex: título quitado via ajustes). O `erp-sync-engine` pega `Valor Pago` direto, sem fallback. Isso pode causar títulos marcados como "pendente" quando deveriam ser "recebido".

**Correção**: Copiar a lógica de derivação da `contas-receber-api` para o `erp-sync-engine`.

### Problema 3: Calendário — campo de ano não abre
O filtro de data usa `<Input type="date">`, que depende do navegador nativo. Não tem um seletor de ano dedicado. Precisa ser trocado por um DatePicker customizado com `Popover + Calendar` do shadcn.

### Problema 4: Limite de 1000 linhas no PostgREST
Já resolvido na implementação atual — a tabela usa paginação backend (`range(from, to)`) e os totais vêm via RPCs agregadoras.

### Problema 5: Painel de Monitoramento de Sync para Admin
Não existe tela mostrando histórico de sincronizações. A tabela `sync_control` já armazena os dados necessários.

---

## Plano de Execução

### Fase 1 — Corrigir `erp-sync-engine`

**Arquivo**: `supabase/functions/erp-sync-engine/index.ts`

1. Corrigir `deriveStatus()` para `recebido/pendente/vencido/parcial` + lógica de data de vencimento
2. Adicionar fallback de `valor_recebido` (quando valorPago=0 mas título quitado)
3. Aumentar `SQL_PAGE_SIZE` de 500 para 2000

### Fase 2 — Executar resync completa

Após deploy, chamar `POST /erp-sync-engine` com `path: "sync-contas-receber"` para resincronizar os ~343k registros com status corretos.

### Fase 3 — Corrigir DatePicker do calendário

**Arquivo**: `src/pages/ContasAReceber.tsx`

Substituir os 3 `<Input type="date">` por `Popover + Calendar` do shadcn/ui com navegação de ano via `captionLayout="dropdown-buttons"`.

### Fase 4 — Painel de Monitoramento Admin

**Arquivo novo**: `src/components/financeiro/SyncMonitorPanel.tsx`

Componente que consulta `sync_control` e exibe:
- Card com última sync (horário, status, registros)
- Tabela com histórico das últimas 20 syncs
- Badge de status (sucesso/erro/parcial)
- Botão para forçar sync manual

**Arquivo**: `src/pages/ContasAReceber.tsx` — Adicionar drawer para o painel (admin only).

### Fase 5 — Validação cruzada banco vs frontend

Comparar via SQL os totais por status no banco vs valores exibidos nos KPIs do dashboard.

---

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | Corrigir deriveStatus, fallback valor_recebido, aumentar page size |
| `src/pages/ContasAReceber.tsx` | Trocar Input date por Calendar/Popover com seleção de ano |
| `src/components/financeiro/SyncMonitorPanel.tsx` | **NOVO** — Painel admin de monitoramento de sync |
