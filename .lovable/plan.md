
# Auditoria das Telas Financeiras de Despesas e Aprovações

## Resumo Executivo

Após uma análise detalhada do código-fonte das telas de despesas departamentais, Central de Aprovações Unificada e Central de Pagamentos, foram identificadas **15 falhas e oportunidades de melhoria** categorizadas por severidade.

---

## Falhas Críticas (Impacto Alto)

### 1. Cache Desatualizado na Central de Aprovações Unificada

**Problema:** Quando uma despesa e aprovada ou rejeitada pelo dialog `AprovarDespesaDepartamentoDialog`, a query `manager-pending-expenses` NAO e invalidada. Isso significa que a tabela na Central de Aprovacoes Unificada (`DepartmentsApprovalHub.tsx`) NAO atualiza automaticamente apos aprovar uma despesa.

**Arquivo:** `src/hooks/useDepartmentExpenses.ts` (linhas 239-242 e 275-278)

**Solucao:** Adicionar invalidacao da query `manager-pending-expenses` nos callbacks de sucesso:
```typescript
queryClient.invalidateQueries({ queryKey: ["manager-pending-expenses"] });
```

---

### 2. Campos Errados no Edge Function de Notificacao

**Problema:** O edge function `send-department-expense-notification` tenta acessar campos que NAO existem na tabela:
- `expense.actual_amount` → Deveria ser `expense.valor_realizado`
- `expense.estimated_amount` → Deveria ser `expense.valor_previsto`
- `expense.expense_code` → Deveria ser `expense.code`
- `profiles.name` → Deveria ser `profiles.nome`
- `profiles.email` → Pode nao existir (campo opcional)

**Arquivo:** `supabase/functions/send-department-expense-notification/index.ts` (linhas 63-64, 93, 101-102)

**Impacto:** Notificacoes de email falham silenciosamente, usuarios nao sao avisados sobre aprovacao/rejeicao.

---

### 3. Empresa ID Obrigatorio em Contas a Pagar mas Nao Propagado

**Problema:** A tabela `contas_pagar` tem `empresa_id NOT NULL`, porem ao aceitar um pagamento no `useFinancialPaymentQueue.ts`, a empresa NAO e propagada para a criacao do registro.

**Arquivo:** `src/hooks/useFinancialPaymentQueue.ts` (linhas 283-295)

**Impacto:** Erro de banco de dados ao tentar aceitar pagamentos - a operacao falha.

---

## Falhas de Usabilidade (Impacto Medio)

### 4. Dialog de Aprovacao de Departamento Muito Limitado

**Problema:** O dialog `AprovarDespesaDepartamentoDialog` NAO exibe:
- Anexos da despesa
- Filial (empresa)
- Data da despesa em destaque
- Historico de alteracoes

Comparado com o dialog de pagamentos `PaymentReviewDialog`, falta o mecanismo de confirmacao de ciencia dos anexos.

**Arquivo:** `src/components/departments/AprovarDespesaDepartamentoDialog.tsx`

---

### 5. Falta Verificacao de Anexos na Aprovacao de Departamento

**Problema:** O gerente pode aprovar uma despesa SEM nenhum anexo. Diferente do fluxo de envio ao financeiro (que bloqueia), a aprovacao nao exige documentacao comprobatoria.

**Regra de Negocio Sugerida:** Exigir pelo menos um anexo antes de aprovar (ou no minimo alertar).

---

### 6. Filtro de Datas Ausente

**Problema:** Tanto a Central de Aprovacoes Unificada quanto a Central de Pagamentos NAO possuem filtro por periodo (data inicial/final).

**Impacto:** Gerentes nao conseguem ver despesas de um mes especifico facilmente.

---

### 7. Paginacao Inexistente

**Problema:** Todas as tabelas carregam TODOS os registros de uma vez. Com o crescimento de dados, isso causara problemas de performance e memoria.

**Arquivos Afetados:**
- `useManagerPendingExpenses.ts`
- `useFinancialPaymentQueue.ts`
- `DepartmentsApprovalHub.tsx`

---

### 8. Falta Botao de Atualizar na Central de Aprovacoes

**Problema:** A tela `DepartmentsApprovalHub.tsx` NAO possui um botao de refresh/atualizar como existe na Central de Pagamentos (`FinancialPaymentCentral.tsx`).

---

## Falhas de Seguranca (Impacto Medio-Alto)

### 9. RLS Policy Muito Permissiva em financial_payment_queue

**Problema:** As policies de INSERT e UPDATE usam `roles: {public}` ao inves de `{authenticated}`, permitindo potencialmente que usuarios nao autenticados manipulem dados.

**Policies Afetadas:**
- `fpq_insert_policy` - public
- `fpq_update_policy` - public

---

### 10. Falta Auditoria de Acoes

**Problema:** Nao ha registro de log/auditoria quando:
- Um gerente aprova/rejeita uma despesa
- O financeiro aceita/rejeita um pagamento
- O financeiro marca como pago

**Solucao Sugerida:** Criar tabela `audit_log` ou trigger para registrar todas as acoes criticas.

---

## Inconsistencias de Interface

### 11. Descricao da Central de Pagamentos Desatualizada

**Problema:** O subtitulo da Central de Pagamentos diz "Gerencie solicitacoes de pagamento de Trade e Eventos" mas agora tambem inclui Departamentos.

**Arquivo:** `src/pages/FinancialPaymentCentral.tsx` (linha 117)

---

### 12. Categoria Exibida como Codigo ao inves de Label

**Problema:** Na tabela da Central de Aprovacoes Individual (`DepartmentApprovalHub.tsx`), a categoria e exibida como o codigo interno (`viagem`) ao inves do label amigavel (`Viagem e Hospedagem`).

**Arquivo:** `src/pages/DepartmentApprovalHub.tsx` (linha 207)

---

### 13. Informacoes Incompletas no Card de Despesa

**Problema:** Na listagem de despesas pendentes em `DepartmentApprovalHub.tsx`, quando `expense.expense_date` e null, o campo de data aparece vazio sem tratamento visual.

---

## Oportunidades de Profissionalizacao

### 14. Exportacao de Dados

**Sugestao:** Adicionar botao para exportar lista de despesas pendentes ou pagamentos em Excel/PDF para fins de relatorio.

---

### 15. Dashboard de Metricas

**Sugestao:** Criar dashboard com:
- Tempo medio de aprovacao por departamento
- Top 5 categorias com mais despesas
- Tendencia de gastos mensais
- Comparativo Previsto vs Realizado

---

## Plano de Implementacao Recomendado

### Fase 1 - Correcoes Criticas (Prioridade Alta)

| # | Tarefa | Esforco |
|---|--------|---------|
| 1 | Corrigir invalidacao de cache `manager-pending-expenses` | 15 min |
| 2 | Corrigir campos do edge function de notificacao | 30 min |
| 3 | Propagar empresa_id ao criar conta a pagar | 20 min |
| 4 | Corrigir RLS policies para usar `authenticated` | 15 min |

### Fase 2 - Melhorias de Usabilidade (Prioridade Media)

| # | Tarefa | Esforco |
|---|--------|---------|
| 5 | Melhorar dialog de aprovacao (anexos + ciencia) | 1-2 horas |
| 6 | Adicionar botao de refresh na Central de Aprovacoes | 10 min |
| 7 | Corrigir subtitulo da Central de Pagamentos | 5 min |
| 8 | Corrigir exibicao de categoria (label vs codigo) | 10 min |

### Fase 3 - Profissionalizacao (Prioridade Baixa)

| # | Tarefa | Esforco |
|---|--------|---------|
| 9 | Implementar paginacao nas tabelas | 2-3 horas |
| 10 | Adicionar filtro de datas | 1 hora |
| 11 | Criar sistema de auditoria | 3-4 horas |
| 12 | Exportacao para Excel/PDF | 2-3 horas |

---

## Secao Tecnica - Detalhes de Implementacao

### Correcao 1 - Cache Invalidation

```typescript
// Em src/hooks/useDepartmentExpenses.ts
// Adicionar nas linhas 241 e 277:

onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["department-expenses"] });
  queryClient.invalidateQueries({ queryKey: ["pending-department-expenses"] });
  queryClient.invalidateQueries({ queryKey: ["manager-pending-expenses"] }); // ADICIONAR
  toast.success("Despesa aprovada com sucesso!");
},
```

### Correcao 2 - Edge Function

```typescript
// Corrigir mapeamento de campos:
const amount = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(expense.valor_realizado || expense.valor_previsto || 0);

// Corrigir query select:
.select(`
  *,
  department:departamentos!department_id(id, nome),
  creator:profiles!created_by(id, nome, email),
  approver:profiles!approved_by(id, nome)
`)
```

### Correcao 3 - Propagar empresa_id

```typescript
// Em useFinancialPaymentQueue.ts, linha 283:
const contaPagarData = {
  fornecedor_nome: item.supplier_name,
  // ... outros campos
  empresa_id: item.empresa_id || 1, // Fallback para empresa padrao
  empresa_nome: item.empresa_nome,
};
```

---

## Conclusao

O sistema atual possui uma arquitetura solida, mas precisa de correcoes pontuais para funcionar de forma profissional em producao. As falhas de cache e edge function sao as mais criticas pois afetam diretamente a experiencia do usuario e a confiabilidade das notificacoes.

Recomendo comecar pela Fase 1 imediatamente para garantir estabilidade operacional.
