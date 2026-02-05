

# Plano de Correção: Isolamento de Dados para Supervisores e Vendedores

## Problema Raiz Identificado

A pagina **TradeStores.tsx** (PDVs) -- que e exatamente onde a Michele esta -- **NAO usa o hook centralizado `useFilteredStores`**. Ela tem sua propria funcao `fetchStores` que trata supervisores como administradores, buscando TODOS os 73 PDVs sem filtrar pela hierarquia.

A mesma falha existe em **TradeFinanceiro.tsx**, que busca todas as lojas para seu dropdown.

### O que acontece quando Michele acessa a pagina de PDVs:

```text
TradeStores.tsx linha 82:
  if (!effectiveIsAdminOrSupervisor) { ... filtrar ... }
  else { buscar TODAS as lojas }

Michele e supervisor → effectiveIsAdminOrSupervisor = true → ve TUDO
```

### O hook centralizado `useFilteredStores` ja tem a logica correta:

```text
useFilteredStores.ts:
  if (effectiveIsAdmin) { buscar tudo }
  else if (effectiveIsSupervisor) { buscar subordinados, filtrar por hierarquia }
  else { buscar apenas lojas vinculadas }
```

## Dados Atuais no Banco

- **73 lojas** ativas no sistema
- **70 lojas** com supervisor_id = Jessika Marcondes
- **Michele** NAO tem lojas atribuidas via supervisor_id, vendedor_id ou store_sellers
- **Subordinados da Michele**: Nathalia, Douglas, Juliana, Monique -- tambem sem lojas vinculadas
- O hook `useFilteredStores` corretamente retornaria ZERO lojas para Michele (ate que lojas sejam atribuidas a ela)

## Plano de Acao

### Passo 1 -- Migrar TradeStores.tsx para usar useFilteredStores

Substituir a funcao `fetchStores` customizada pelo hook centralizado:

- Remover o estado local `allStores` e a funcao `fetchStores`
- Importar e usar `useFilteredStores` (que ja respeita hierarquia e impersonacao)
- Manter a busca com `select("*")` via uma segunda query filtrada pelos IDs retornados pelo hook, ou adaptar o hook para retornar todos os campos necessarios
- Remover a variavel `effectiveIsAdminOrSupervisor` do controle de dados (manter apenas para UI como botao de importar)

### Passo 2 -- Corrigir TradeFinanceiro.tsx

A linha 100 busca todas as lojas para o dropdown sem filtro:
```
supabase.from("stores").select("id, name, code, city").eq("status", "active")
```

Substituir por `useFilteredStores` para que o dropdown de lojas respeite a hierarquia.

### Passo 3 -- Auditar e corrigir outros componentes

Verificar e corrigir todos os locais que usam `isAdminOrSupervisor` como check combinado para buscar dados sem filtro:

- **CampaignResultsPanel.tsx**: usa `isAdminOrSupervisor` para decidir se filtra lancamentos
- **TradeLancamentos.tsx**: usa `isAdminOrSupervisor` para filtrar entradas financeiras  
- **useTradeExecutiveDashboard.ts**: busca stores count sem filtro

### Passo 4 -- Incrementar versao do app

Atualizar `APP_VERSION` em `src/lib/version.ts` para `1.1.3` para forcar limpeza de cache em todos os dispositivos.

## Detalhes Tecnicos

### TradeStores.tsx -- Mudancas Principais

**Antes (problematico):**
```typescript
const { isAdminOrSupervisor } = useUserRole();
// ...
const effectiveIsAdminOrSupervisor = isImpersonating 
  ? impersonatedPermissions.isAdmin || impersonatedPermissions.role === 'supervisor'
  : isAdminOrSupervisor;

const fetchStores = async () => {
  if (!effectiveIsAdminOrSupervisor) {
    // Filtrar por vendedor
  } else {
    // BUSCAR TUDO ← PROBLEMA
    const { data } = await supabase.from("stores").select("*").order("name");
  }
};
```

**Depois (corrigido):**
```typescript
import { useFilteredStores } from "@/hooks/useFilteredStores";

// Usar hook centralizado que ja separa admin/supervisor/vendedor
const { stores: filteredStoreIds, loading: storesLoading } = useFilteredStores();

// Para obter dados completos (*), fazer query filtrada pelos IDs
const fetchStoreDetails = async () => {
  if (filteredStoreIds.length === 0) { setStores([]); return; }
  const ids = filteredStoreIds.map(s => s.id);
  const { data } = await supabase
    .from("stores")
    .select("*")
    .in("id", ids)
    .order("name");
  setAllStores(data || []);
  setStores(data || []);
};
```

### TradeFinanceiro.tsx -- Mudanca no dropdown de lojas

Substituir a busca direta por `useFilteredStores`:
```typescript
const { stores: filteredStores } = useFilteredStores();
// Usar filteredStores no dropdown em vez do resultado direto do banco
```

### Arquivos que serao modificados

1. `src/pages/TradeStores.tsx` -- substituir fetchStores pelo hook centralizado
2. `src/pages/TradeFinanceiro.tsx` -- usar useFilteredStores para dropdown
3. `src/lib/version.ts` -- incrementar para 1.1.3

### Nota importante sobre dados

Apos a correcao, Michele vera apenas lojas que estao vinculadas a ela ou sua equipe. Atualmente **nenhuma loja** esta atribuida a Michele ou seus vendedores (Nathalia, Douglas, Juliana, Monique). Para que ela veja lojas, sera necessario atribuir lojas a esses vendedores no cadastro de PDVs (via campo vendedor ou tabela store_sellers).

