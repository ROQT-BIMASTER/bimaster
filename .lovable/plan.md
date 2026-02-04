
# Plano: Restringir Visualização de Dados no Trade Marketing por Usuário

## Status: ✅ IMPLEMENTADO

## Contexto
Atualmente, algumas telas do Trade Marketing mostram dados de todos os usuários, quando deveriam restringir para que **vendedores** e outros usuários não-administradores vejam **apenas os dados que eles mesmos inseriram**.

A regra é:
- **Admins e Supervisores**: Visualizam todos os dados
- **Outros usuários (vendedores, promotores)**: Visualizam apenas dados onde são o criador (`created_by`) ou vendedor responsável (`vendedor_id`)

---

## Implementação Concluída

### Arquivos Modificados

| Arquivo | Status | Filtro Aplicado |
|---------|--------|-----------------|
| `src/pages/TradeVisits.tsx` | ✅ | `user_id` OU `vendedor_id` |
| `src/pages/TradeShelfMeasurements.tsx` | ✅ | `created_by` OU `vendedor_id` |
| `src/pages/TradeSellOut.tsx` | ✅ | `created_by` OU `vendedor_id` |
| `src/pages/TradeFinanceiro.tsx` | ✅ | `created_by` OU `vendedor_id` (investimentos) |
| `src/pages/TradeLancamentos.tsx` | ✅ | `created_by` |
| `src/components/trade/campaigns/CampaignResultsPanel.tsx` | ✅ | `created_by` |

### Padrão de Implementação Utilizado

```typescript
// 1. Importar o hook de role
import { useUserRole } from "@/hooks/useUserRole";

// 2. Obter flags e ID do usuário
const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
const [currentUserId, setCurrentUserId] = useState<string | null>(null);

// Na inicialização:
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setCurrentUserId(data.user?.id || null);
  });
}, []);

// Aguardar role e userId antes de buscar dados
useEffect(() => {
  if (currentUserId !== null && !roleLoading) {
    fetchData();
  }
}, [currentUserId, roleLoading, isAdminOrSupervisor]);

// 3. Modificar a query de busca
const fetchData = async () => {
  let query = supabase.from("tabela").select("*");
  
  // Filtrar para não-admins/supervisores
  if (!isAdminOrSupervisor && currentUserId) {
    query = query.or(`created_by.eq.${currentUserId},vendedor_id.eq.${currentUserId}`);
  }
  
  const { data, error } = await query;
  // ...
};
```

---

## Notas

- A tela `TradePhotos.tsx` já implementa filtro por impersonação e hierarquia
- A tela `CampaignLancamentosList.tsx` já implementa filtro por clientes do vendedor
- Tabelas de referência como `competitors` permanecem globais (dados de mercado)
- Performance e Gamificação foram restritos completamente para vendedores (não aparecem no menu)
