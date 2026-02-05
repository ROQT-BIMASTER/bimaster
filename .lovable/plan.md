
# Simplificação do Filtro de Origens

## Objetivo
Unificar todos os filtros em um único dropdown de "Origens", listando cada departamento individualmente junto com Trade e Eventos.

## Mudança Visual

```text
ANTES (2 filtros):
┌──────────────────┐  ┌──────────────────┐
│ Origens         ▼│  │ Departamento    ▼│  ← Filtro extra
├──────────────────┤  ├──────────────────┤
│ Todas Origens    │  │ Todos           │
│ Trade - Lanç.    │  │ Administrativo   │
│ Trade - Invest.  │  │ Logística        │
│ Trade - Campanha │  │ ...              │
│ Evento           │  └──────────────────┘
│ Departamento     │
└──────────────────┘

DEPOIS (1 filtro unificado):
┌──────────────────────┐
│ Origens             ▼│
├──────────────────────┤
│ Todas Origens        │
│ ── Trade ──          │  ← Separador visual
│ Trade - Lançamento   │
│ Trade - Investimento │
│ Trade - Campanha     │
│ ── Eventos ──        │
│ Evento               │
│ ── Departamentos ──  │  ← Separador visual
│ Administrativo       │
│ Logística            │
│ Marketing            │
│ ...                  │
└──────────────────────┘
```

## Arquivos a Modificar

### 1. PaymentQueueTable.tsx
- Remover o segundo Select de departamentos
- Modificar o Select de origens para incluir departamentos dinamicamente
- Usar separadores visuais para organizar as opções
- Ajustar o tipo do filtro para suportar valores compostos como `dept:Administrativo`

### 2. FinancialPaymentCentral.tsx
- Simplificar o estado dos filtros (remover `department_name`)
- Ajustar a lógica de parsing do valor selecionado

### 3. useFinancialPaymentQueue.ts
- Modificar a lógica de filtragem para interpretar valores compostos
- Quando valor começar com `dept:`, filtrar por `source_type = department_expense` E `department_name`

## Detalhes Técnicos

**Estrutura do valor do filtro:**
```typescript
// Valores possíveis:
"all"                    // Todas origens
"trade_entry"            // Trade - Lançamento
"trade_investment"       // Trade - Investimento
"trade_campaign"         // Trade - Campanha
"event_expense"          // Evento
"dept:Administrativo"    // Departamento específico
"dept:Logística"         // Departamento específico
```

**Lógica de parsing no hook:**
```typescript
if (filters?.source_type?.startsWith('dept:')) {
  const deptName = filters.source_type.replace('dept:', '');
  query = query.eq('source_type', 'department_expense');
  query = query.eq('department_name', deptName);
} else if (filters?.source_type && filters.source_type !== 'all') {
  query = query.eq('source_type', filters.source_type);
}
```

## Benefícios
- Interface mais simples e intuitiva
- Menos cliques para filtrar
- Consistência visual com Trade e Eventos
- Código mais limpo sem filtro condicional
