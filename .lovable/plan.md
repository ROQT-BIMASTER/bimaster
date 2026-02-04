
# Plano: Bloquear Visualização de PDVs Sem Vendedor + Filtro Centralizado

## ✅ STATUS: IMPLEMENTADO

## Resumo da Implementação

### Hook Centralizado Criado
- **`src/hooks/useFilteredStores.ts`**: Hook que filtra lojas por permissão do usuário
  - Admin/Supervisor: vê todas as lojas
  - Vendedor/Promotor: vê apenas lojas vinculadas via `vendedor_id` ou `store_sellers`
  - Lojas sem vendedor: **visíveis apenas para Admins/Supervisores**
  - Respeita contexto de impersonação (Visualizar como Usuário)

### Componentes Atualizados
| Componente | Status |
|------------|--------|
| `TradeFilters.tsx` | ✅ Usa `useFilteredStores` |
| `TradeModule.tsx` | ✅ Contagem usa lojas filtradas |
| `EditarInvestimentoDialog.tsx` | ✅ Dropdown usa lojas filtradas |
| `QuickEntryDialog.tsx` | ✅ Seleção usa lojas filtradas |
| `useTradeData.ts` | ✅ Comentário deprecating useActiveStores |

## Benefícios Alcançados

1. **Segurança**: PDVs sem vendedor não expostos a usuários não autorizados
2. **Centralização**: Lógica de filtro em um único lugar (DRY)
3. **Consistência**: Todas as 11+ telas do Trade usam a mesma regra
4. **Impersonação**: Respeita "Visualizar como" corretamente
5. **Manutenibilidade**: Alterações futuras em um só lugar

