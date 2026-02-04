
# Plano: Bloquear Visualização de PDVs Sem Vendedor + Filtro Centralizado

## Problema Identificado

O componente `TradeFilters.tsx` busca **todas as lojas ativas** sem nenhum filtro por vendedor. Este componente é usado em **11 telas** do Trade Marketing:
- TradeStores, TradeVisits, TradePhotos, TradePromotions
- TradeCompetitors, TradeInsights, TradeShelfMeasurements
- TradeSellOut, TradeFinanceiro, TradeAuditorias, TradeCalendar

Além disso, outros componentes também buscam lojas sem filtro:
- TradeModule.tsx (dashboard)
- EditarInvestimentoDialog.tsx
- useTradeData.ts (hook)
- QuickEntryDialog.tsx

## Regra de Negócio

| Tipo de Usuário | Visualização |
|-----------------|--------------|
| Admin/Supervisor | Todas as lojas |
| Vendedor/Promotor | Apenas lojas onde é vendedor principal OU está vinculado via `store_sellers` |
| Lojas sem vendedor | **Visíveis apenas para Admins/Supervisores** |

## Solução Proposta

### Parte 1: Criar Hook Centralizado `useFilteredStores`

Criar um hook reutilizável que:
1. Verifica o role do usuário (e contexto de impersonação)
2. Para não-admins: busca lojas vinculadas via `store_sellers` + `vendedor_id`
3. Para admins: retorna todas as lojas
4. Retorna função de fetch e lista de lojas filtradas

**Arquivo novo:** `src/hooks/useFilteredStores.ts`

```text
useFilteredStores()
  ├── Detecta isAdminOrSupervisor (respeitando impersonação)
  ├── Obtém effectiveUserId
  ├── Se não-admin:
  │   ├── Busca store_sellers WHERE vendedor_id = userId
  │   └── Busca stores WHERE id IN (linkedIds) OR vendedor_id = userId
  └── Se admin: busca todas as stores
```

### Parte 2: Atualizar TradeFilters

Substituir a busca direta por utilização do hook `useFilteredStores`, passando a lista filtrada para o dropdown.

### Parte 3: Atualizar Outros Componentes

| Componente | Modificação |
|------------|-------------|
| `TradeModule.tsx` | Usar hook para contar apenas lojas visíveis |
| `EditarInvestimentoDialog.tsx` | Usar hook para popular dropdown |
| `useTradeData.ts` | Incorporar lógica de filtro |
| `QuickEntryDialog.tsx` | Usar hook para seleção de lojas |

---

## Detalhes Técnicos

### Hook `useFilteredStores`

```text
interface UseFilteredStoresResult {
  stores: Store[];
  loading: boolean;
  refetch: () => Promise<void>;
}

function useFilteredStores(options?: { 
  activeOnly?: boolean;
  includeFields?: string[];
}): UseFilteredStoresResult
```

**Lógica interna:**
1. Usar `useUserRole()` para obter `isAdminOrSupervisor`
2. Usar `useImpersonation()` para detectar visualização personificada
3. Calcular `effectiveUserId` e `effectiveIsAdminOrSupervisor`
4. Se não-admin:
   - Buscar `store_sellers.store_id` para o usuário
   - Combinar com lojas onde `vendedor_id = userId`
   - Retornar apenas essas lojas
5. Se admin: retornar todas as lojas

### Integração com TradeFilters

O `TradeFilters` receberá opcionalmente uma lista de lojas já filtradas via props OU usará o hook internamente se não receber.

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useFilteredStores.ts` | **Criar** | Hook centralizado de lojas filtradas |
| `src/components/trade/TradeFilters.tsx` | Modificar | Usar hook para filtrar lojas |
| `src/pages/modules/TradeModule.tsx` | Modificar | Usar hook para contagem |
| `src/components/trade/EditarInvestimentoDialog.tsx` | Modificar | Usar hook para dropdown |
| `src/hooks/useTradeData.ts` | Modificar | Incorporar filtro de lojas |
| `src/components/trade/QuickEntryDialog.tsx` | Modificar | Usar hook para seleção |

---

## Benefícios

1. **Segurança**: PDVs sem vendedor não serão expostos a usuários não autorizados
2. **Centralização**: Lógica de filtro em um único lugar (DRY)
3. **Consistência**: Todas as telas usarão a mesma regra
4. **Impersonação**: Respeita o contexto de "Visualizar como"
5. **Manutenibilidade**: Alterações futuras em um só lugar

## Considerações de Segurança

O filtro no frontend é uma camada de usabilidade. A proteção real deve estar nas políticas RLS do banco. Esta implementação complementa (não substitui) as políticas de segurança do backend.
