
# Plano: Restringir Visualização de Dados no Trade Marketing por Usuário

## Contexto
Atualmente, algumas telas do Trade Marketing mostram dados de todos os usuários, quando deveriam restringir para que **vendedores** e outros usuários não-administradores vejam **apenas os dados que eles mesmos inseriram**.

A regra é:
- **Admins e Supervisores**: Visualizam todos os dados
- **Outros usuários (vendedores, promotores)**: Visualizam apenas dados onde são o criador (`created_by`) ou vendedor responsável (`vendedor_id`)

---

## Análise das Tabelas

| Tabela | Coluna de Filtro | Usada Em |
|--------|------------------|----------|
| `photos` | `vendedor_id` | TradePhotos.tsx |
| `visits` | `user_id`, `vendedor_id` | TradeVisits.tsx |
| `shelf_measurements` | `created_by`, `vendedor_id` | TradeShelfMeasurements.tsx |
| `store_sellouts` | `created_by`, `vendedor_id` | TradeSellOut.tsx |
| `trade_investments` | `created_by`, `vendedor_id` | TradeFinanceiro.tsx |
| `trade_financial_entries` | `created_by` | TradeLancamentos.tsx |
| `trade_campaign_lancamentos` | `created_by` | CampaignResultsPanel.tsx |
| `competitors` | Sem coluna de usuário | TradeCompetitors.tsx (tabela global) |

---

## Telas que Precisam de Ajuste

### 1. **TradeVisits.tsx** (Visitas de Campo)
- **Situação atual**: Mostra todas as visitas
- **Ajuste**: Filtrar por `user_id = currentUserId` OU `vendedor_id = currentUserId` para não-admins/supervisores

### 2. **TradeShelfMeasurements.tsx** (Medição de Prateleiras)
- **Situação atual**: Mostra todas as medições
- **Ajuste**: Filtrar por `created_by = currentUserId` OU `vendedor_id = currentUserId`

### 3. **TradeSellOut.tsx** (Sell Out)
- **Situação atual**: Mostra todos os registros
- **Ajuste**: Filtrar por `created_by = currentUserId` OU `vendedor_id = currentUserId`

### 4. **TradeFinanceiro.tsx** (Investimentos)
- **Situação atual**: Mostra todos os investimentos
- **Ajuste**: Filtrar por `created_by = currentUserId` OU `vendedor_id = currentUserId`

### 5. **TradeLancamentos.tsx** (Lançamentos Financeiros)
- **Situação atual**: Mostra todos os lançamentos
- **Ajuste**: Filtrar por `created_by = currentUserId`

### 6. **CampaignResultsPanel.tsx** (Painel de Resultados)
- **Situação atual**: Mostra todos os lançamentos de campanhas
- **Ajuste**: Já implementado em `CampaignLancamentosList.tsx` (filtra por clientes do vendedor)
- **Ação**: Aplicar mesma lógica ao `CampaignResultsPanel.tsx`

### 7. **TradeCompetitors.tsx** (Concorrentes)
- **Situação**: Tabela global sem `created_by`
- **Ação**: Manter como está (dados de referência do mercado)

---

## Implementação Técnica

Para cada tela, será implementado o seguinte padrão:

```typescript
// 1. Importar o hook de role
import { useUserRole } from "@/hooks/useUserRole";

// 2. Obter flags e ID do usuário
const { isAdminOrSupervisor } = useUserRole();
const [currentUserId, setCurrentUserId] = useState<string | null>(null);

// Na inicialização:
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setCurrentUserId(data.user?.id || null);
  });
}, []);

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

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/TradeVisits.tsx` | Adicionar filtro por `user_id` ou `vendedor_id` |
| `src/pages/TradeShelfMeasurements.tsx` | Adicionar filtro por `created_by` ou `vendedor_id` |
| `src/pages/TradeSellOut.tsx` | Adicionar filtro por `created_by` ou `vendedor_id` |
| `src/pages/TradeFinanceiro.tsx` | Adicionar filtro por `created_by` ou `vendedor_id` nos investimentos |
| `src/pages/TradeLancamentos.tsx` | Adicionar filtro por `created_by` |
| `src/components/trade/campaigns/CampaignResultsPanel.tsx` | Adicionar filtro por clientes do vendedor |

---

## Considerações de Segurança

1. **Defesa em profundidade**: Embora o RLS no banco de dados seja a camada primária de segurança, adicionar filtros no frontend melhora a experiência do usuário e reduz dados desnecessários
2. **Consistência**: Usar o mesmo padrão (`isAdminOrSupervisor`) já estabelecido em `CampaignLancamentosList.tsx`
3. **Performance**: Filtrar no lado do servidor (query Supabase) em vez de filtrar todos os dados no cliente

---

## Notas

- A tela `TradePhotos.tsx` já implementa filtro por impersonação e hierarquia
- A tela `CampaignLancamentosList.tsx` já implementa filtro por clientes do vendedor
- Tabelas de referência como `competitors` permanecem globais
