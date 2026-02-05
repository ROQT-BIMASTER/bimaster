
# Adicionar Seletor de Filial em Telas de Criação

## Objetivo
Garantir que ao criar eventos, despesas de eventos, lançamentos e outros registros financeiros, o usuário selecione sua filial. Isso mantém consistência com o padrão já implementado para despesas de departamento.

## Contexto Atual
O seletor de filial já foi implementado em:
- `NovaDespesaDepartamentoDialog.tsx` - Despesas de departamento

Já existem os hooks necessários:
- `useUserEmpresas()` - Lista filiais vinculadas ao usuário
- `usePrimaryEmpresa()` - Obtém filial principal do usuário

## Telas a Modificar

### Prioridade Alta (Módulo Eventos)

| Arquivo | Função | Alteração |
|---------|--------|-----------|
| `NovoEventoDialog.tsx` | Criar evento | Adicionar seletor de filial |
| `NovaDespesaEventoDialog.tsx` | Criar despesa de evento | Adicionar seletor de filial |
| `SolicitarVerbaEventoDialog.tsx` | Solicitar verba para evento | Adicionar seletor de filial |

### Prioridade Alta (Módulo Trade)

| Arquivo | Função | Alteração |
|---------|--------|-----------|
| `NovoLancamentoDialog.tsx` | Criar lançamento financeiro | Adicionar seletor de filial |
| `SolicitarOrcamentoDialog.tsx` | Solicitar orçamento Trade | Adicionar seletor de filial |
| `EditarLancamentoDialog.tsx` | Editar lançamento | Exibir/editar filial |
| `EditarInvestimentoDialog.tsx` | Editar investimento | Exibir/editar filial |

### Prioridade Média (Módulo Departamentos)

| Arquivo | Função | Alteração |
|---------|--------|-----------|
| `SolicitarVerbaDepartamentoDialog.tsx` | Solicitar verba | Adicionar seletor de filial |

### Prioridade Baixa (Outras Telas - Futura Implementação)

| Arquivo | Função |
|---------|--------|
| `NovaVisitaDialog.tsx` | Criar visita Trade |
| `NovoSellOutDialog.tsx` | Registrar sell-out |
| `NovaPromocaoDialog.tsx` | Criar promoção |
| `NovoLancamentoDialog.tsx` (Fábrica) | Lançamento de produção |

## Alterações no Banco de Dados

Adicionar colunas `empresa_id` e `empresa_nome` nas tabelas:

```sql
-- Eventos corporativos
ALTER TABLE corporate_events 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Despesas de eventos
ALTER TABLE corporate_event_expenses 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Lançamentos Trade
ALTER TABLE trade_financial_entries 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Orçamentos Trade
ALTER TABLE trade_budgets 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Verbas de Departamento
ALTER TABLE department_budgets 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_corporate_events_empresa ON corporate_events(empresa_id);
CREATE INDEX IF NOT EXISTS idx_corporate_event_expenses_empresa ON corporate_event_expenses(empresa_id);
CREATE INDEX IF NOT EXISTS idx_trade_financial_entries_empresa ON trade_financial_entries(empresa_id);
CREATE INDEX IF NOT EXISTS idx_trade_budgets_empresa ON trade_budgets(empresa_id);
CREATE INDEX IF NOT EXISTS idx_department_budgets_empresa ON department_budgets(empresa_id);
```

## Padrão de Implementação

Cada dialog seguirá o mesmo padrão já implementado em `NovaDespesaDepartamentoDialog`:

```typescript
// 1. Importar hooks
import { useUserEmpresas, usePrimaryEmpresa } from "@/hooks/useUserEmpresas";
import { Building } from "lucide-react";

// 2. Usar hooks no componente
const { data: userEmpresas = [] } = useUserEmpresas();
const { primaryEmpresa } = usePrimaryEmpresa();

// 3. Estado do formulário
const [formData, setFormData] = useState({
  // ... outros campos
  empresa_id: "",
});

// 4. Pre-selecionar filial principal
useEffect(() => {
  if (primaryEmpresa && !formData.empresa_id) {
    setFormData(prev => ({ 
      ...prev, 
      empresa_id: primaryEmpresa.id.toString() 
    }));
  }
}, [primaryEmpresa]);

// 5. No submit, obter dados completos da empresa
const selectedEmpresa = userEmpresas.find(
  ue => ue.empresa_id.toString() === formData.empresa_id
);

// 6. Incluir na criação
await createMutation({
  // ... outros campos
  empresa_id: selectedEmpresa?.empresa_id,
  empresa_nome: selectedEmpresa?.empresa.nome,
});
```

## Interface do Seletor

```text
┌──────────────────────────────────────────────┐
│ Filial *                                     │
├──────────────────────────────────────────────┤
│ 🏢 RUBY ROSE-SP (Principal)              ▼  │
└──────────────────────────────────────────────┘
  ↓ Dropdown aberto:
  ┌────────────────────────────────────────────┐
  │ 🏢 RUBY ROSE-SP (Principal)                │
  │ 🏢 RUBY ROSE - GYN                         │
  │ 🏢 RUBY ROSE - PR                          │
  └────────────────────────────────────────────┘
```

## Hooks a Atualizar

### useCorporateEvents.ts
- Adicionar `empresa_id` e `empresa_nome` na interface `CreateEventInput`
- Propagar campos no insert

### useEventExpenses.ts
- Adicionar `empresa_id` e `empresa_nome` na interface `CreateExpenseInput`
- Propagar campos no insert e ao enviar para financeiro

### Hooks de Trade (lançamentos/orçamentos)
- Atualizar interfaces e mutations para incluir empresa

## Tabelas de Listagem a Atualizar

Exibir coluna "Filial" nas tabelas:
- `EventsExpensesTable.tsx`
- Tabela de Eventos
- Tabela de Lançamentos Trade
- Tabela de Orçamentos

## Ordem de Implementação

1. **Migração SQL** - Adicionar colunas em todas as tabelas
2. **Dialogs de Eventos** - NovoEventoDialog, NovaDespesaEventoDialog
3. **Dialogs de Trade** - NovoLancamentoDialog, SolicitarOrcamentoDialog
4. **Dialogs de Departamentos** - SolicitarVerbaDepartamentoDialog
5. **Hooks** - Atualizar interfaces e mutations
6. **Tabelas** - Adicionar colunas de exibição
