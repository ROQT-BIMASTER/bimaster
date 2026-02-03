
# Plano: Padronizar Formulários de Verba com Conta Contábil

## Problema Identificado

Existem dois contextos diferentes para criar verbas que não estão padronizados:

| Formulário | Onde aparece | Status inicial | Conta Contábil |
|------------|--------------|----------------|----------------|
| **Adicionar Verba Semestral** | Tela de Verbas | `active` (direto) | ✅ Disponível |
| **Solicitar Novo Orçamento** | Aprovação de Campanha | `pending` (aprovação) | ❌ Faltando |
| **Solicitar Complemento** | Aprovação de Campanha | `pending` (aprovação) | ❌ Faltando |

O campo `account_id` **já existe** na tabela `trade_budgets` e está disponível para uso.

---

## Solução Proposta

### 1. Adicionar Campo "Conta Contábil" nos Dialogs de Solicitação

Incluir o Select de conta contábil nos dois formulários de solicitação:
- `SolicitarOrcamentoDialog.tsx`
- `SolicitarComplementoDialog.tsx`

O campo será **opcional**, pois quem define a conta contábil final pode ser o Financeiro no momento da aprovação.

### 2. Padronizar Campos de Descrição/Notas

Unificar a nomenclatura:
- **Verbas Semestrais**: já possui `description` 
- **Solicitações**: usar `notes` como justificativa + `description` padronizado

### 3. Permitir Financeiro Ajustar Conta na Aprovação

Quando o Financeiro aprovar a verba, ele poderá:
- Revisar/ajustar a conta contábil vinculada
- Validar se a conta está correta para o tipo de despesa

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/trade/SolicitarOrcamentoDialog.tsx` | Adicionar Select de conta contábil |
| `src/components/trade/SolicitarComplementoDialog.tsx` | Adicionar Select de conta contábil |

---

## Detalhes de Implementação

### SolicitarOrcamentoDialog

Adicionar busca de contas e Select:

```typescript
// Buscar contas contábeis
const { data: accounts } = useQuery({
  queryKey: ['chart-of-accounts'],
  queryFn: async () => {
    const { data } = await supabase
      .from("trade_chart_of_accounts")
      .select("id, code, name")
      .eq("is_active", true)
      .order("code");
    return data || [];
  },
});

// Estado
const [accountId, setAccountId] = useState<string | null>(null);
```

Campo no formulário:

```text
┌─────────────────────────────────────────────────────────┐
│ Nome do Orçamento *                  │ Código *        │
│ [Campanha Verão 2025              ]  │ [CAMP-2025-01]  │
├─────────────────────────────────────────────────────────┤
│ Valor Total Solicitado *                                │
│ [0.00                                                 ] │
├─────────────────────────────────────────────────────────┤
│ Data Início *                        │ Data Fim *      │
│ [dd/mm/aaaa]                         │ [dd/mm/aaaa]    │
├─────────────────────────────────────────────────────────┤
│ Conta Contábil (Opcional)                    🆕 NOVO   │
│ [3.1.05 - Marketing e Publicidade           ▼]         │
│ "O Financeiro poderá ajustar na aprovação"             │
├─────────────────────────────────────────────────────────┤
│ Justificativa                                           │
│ [                                                     ] │
└─────────────────────────────────────────────────────────┘
```

No submit, incluir `account_id`:

```typescript
const { data: budgetData, error } = await supabase
  .from("trade_budgets")
  .insert({
    // ... campos existentes
    account_id: accountId || null,  // 🆕 Adicionar
  });
```

### SolicitarComplementoDialog

Mesmo padrão, mas herdar a conta da verba original se existir:

```typescript
// Pré-selecionar conta da verba original
useEffect(() => {
  if (open && budget?.account_id) {
    setAccountId(budget.account_id);
  }
}, [open, budget]);
```

---

## Fluxo Completo

```text
Usuário solicita verba
        ↓
Preenche dados + seleciona conta (opcional)
        ↓
Salva com approval_status = 'pending'
        ↓
Financeiro vê solicitação
        ↓
Revisa conta contábil (pode ajustar)
        ↓
Aprova → status = 'approved' → Verba disponível
```

---

## Benefícios

1. **Consistência**: Todos os formulários de verba têm os mesmos campos
2. **Rastreabilidade**: Cada verba terá sua classificação contábil desde a solicitação
3. **Flexibilidade**: Solicitante sugere, Financeiro valida
4. **Integração**: Facilita relatórios DRE e conciliação contábil

---

## Seção Técnica

### Query de Contas Contábeis

```typescript
const { data: accounts } = useQuery({
  queryKey: ['chart-of-accounts-active'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("trade_chart_of_accounts")
      .select("id, code, name, account_type")
      .eq("is_active", true)
      .eq("permite_lancamento", true) // Apenas contas analíticas
      .in("account_type", ["expense", "budget"]) // Despesas e verbas
      .order("code");
    
    if (error) throw error;
    return data || [];
  },
  staleTime: 5 * 60 * 1000,
});
```

### Componente Select Reutilizável

Usar o mesmo padrão visual da tela de Verbas Semestrais:

```tsx
<div className="space-y-2">
  <Label htmlFor="account_id">Conta Contábil (Opcional)</Label>
  <Select value={accountId || ""} onValueChange={(val) => setAccountId(val || null)}>
    <SelectTrigger>
      <SelectValue placeholder="Selecione uma conta" />
    </SelectTrigger>
    <SelectContent>
      {accounts?.map((account) => (
        <SelectItem key={account.id} value={account.id}>
          {account.code} - {account.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    O departamento financeiro poderá revisar na aprovação
  </p>
</div>
```
