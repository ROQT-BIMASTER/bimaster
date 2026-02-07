
# Central de Aprovacoes: Modo Foco + Politica de Pagamento Financeiro

## Parte 1: Modo Foco para Despesas Lancadas

### Problema
Quando ha muitas despesas pendentes na Central de Aprovacoes, a lista fica longa e o espaco da tela fica pequeno, dificultando a revisao pelo gestor.

### Solucao
Adicionar um botao "Modo Foco" na secao de Despesas Lancadas que abre todas as despesas em tela cheia (full-screen dialog), com melhor aproveitamento do espaco e filtros acessiveis.

### O que sera feito
- Botao "Modo Foco" (icone Expand/Maximize) no header da secao de Despesas Lancadas
- Ao clicar, abre um Dialog em tela cheia com:
  - Filtros (busca, departamento, categoria) na barra superior
  - Lista completa de despesas em layout otimizado (mais compacto, tipo tabela)
  - Acoes rapidas de aprovar/rejeitar diretamente na lista
  - Contadores e totalizadores visiveis
  - Botao para fechar e voltar a visualizacao normal

### Arquivo a criar
- `src/components/departments/DespesasFocoModeDialog.tsx` -- Dialog full-screen com a listagem completa

### Arquivo a modificar
- `src/pages/DepartmentsApprovalHub.tsx` -- Adicionar botao "Modo Foco" na secao de despesas

---

## Parte 2: Politica de Calendario de Pagamento do Financeiro

### Problema
O financeiro precisa controlar quando os usuarios podem lancar despesas para pagamento e quando os pagamentos serao processados. Atualmente nao existe nenhuma configuracao de politica de pagamento no sistema.

### Regras de negocio
1. O financeiro configura uma politica com:
   - **Dia de corte**: dia da semana ate quando as despesas podem ser lancadas (ex: quinta-feira)
   - **Horario de corte**: horario limite no dia de corte (ex: 18:00)
   - **Dia de pagamento**: dia da semana em que os pagamentos sao processados (ex: segunda-feira)
   - **Aceita excecoes**: se o financeiro aceita pagamentos fora da politica (requer aprovacao adicional)

2. Se o usuario lanca uma despesa apos o corte:
   - A despesa e automaticamente agendada para o proximo ciclo de pagamento
   - O sistema mostra claramente qual sera a data de pagamento

3. Se excecoes estao habilitadas:
   - O usuario pode solicitar pagamento fora da politica
   - Essa excecao precisa de aprovacao do financeiro

4. A politica fica visivel para todos os usuarios em um banner/botao no topo das telas de despesas

### Mudancas no banco de dados
Nova tabela `financial_payment_policies`:

```text
| Coluna                  | Tipo      | Descricao                                    |
|-------------------------|-----------|----------------------------------------------|
| id                      | uuid (PK) | Identificador                                |
| name                    | text      | Nome da politica (ex: "Politica Semanal")    |
| cutoff_day_of_week      | int       | Dia de corte (0=Dom, 1=Seg ... 4=Qui)        |
| cutoff_time             | time      | Horario de corte (ex: 18:00)                 |
| payment_day_of_week     | int       | Dia de pagamento (0=Dom, 1=Seg)              |
| allows_exceptions       | boolean   | Aceita excecoes de pagamento                 |
| exception_requires_approval | boolean | Excecao precisa de aprovacao             |
| description             | text      | Descricao da politica para os usuarios       |
| is_active               | boolean   | Se esta ativa                                |
| created_by              | uuid      | Quem criou                                   |
| created_at              | timestamp | Quando foi criada                            |
| updated_at              | timestamp | Ultima atualizacao                           |
```

### Arquivos a criar

1. **`src/hooks/useFinancialPaymentPolicies.ts`**
   - Hook com CRUD para politicas de pagamento
   - Funcoes utilitarias para calcular:
     - Proxima data de pagamento baseada na politica
     - Se uma despesa esta dentro ou fora do prazo de corte
     - Proximo ciclo de pagamento

2. **`src/components/financeiro/payments/PaymentPolicyConfigDialog.tsx`**
   - Dialog para o financeiro configurar a politica
   - Selecao de dia da semana para corte e pagamento
   - Campo de horario de corte
   - Toggle para aceitar excecoes
   - Campo de descricao da politica

3. **`src/components/financeiro/payments/PaymentPolicyBanner.tsx`**
   - Banner/botao que aparece no topo das telas de despesas
   - Mostra resumo da politica vigente (ex: "Lancamentos ate quinta 18h -- Pagamento na segunda")
   - Ao clicar, abre um dialog com os detalhes completos da politica
   - Mostra a proxima data de pagamento calculada
   - Se excecoes sao aceitas, indica isso claramente

### Arquivos a modificar

1. **`src/pages/FinancialPaymentCentral.tsx`**
   - Adicionar botao "Configurar Politica" no header da Central de Pagamentos
   - Integrar o dialog de configuracao

2. **`src/pages/DepartmentsApprovalHub.tsx`**
   - Adicionar o `PaymentPolicyBanner` no topo da pagina

3. **`src/components/events/EventsExpensesTable.tsx`** (ou tela equivalente de lancamento)
   - Adicionar o `PaymentPolicyBanner` para que o usuario veja as regras ao lancar despesas

---

## Resumo das entregas

| Item | Tipo | Descricao |
|------|------|-----------|
| Modo Foco | Novo componente | Dialog fullscreen para revisao de despesas em massa |
| Tabela `financial_payment_policies` | Banco de dados | Armazena configuracoes de politica de pagamento |
| Hook de politicas | Novo hook | CRUD + calculos de datas de pagamento |
| Config da politica | Novo componente | Dialog para o financeiro definir regras |
| Banner de politica | Novo componente | Visivel para todos os usuarios nas telas de despesas |
| Integracao | Modificacoes | Central de Pagamentos, Central de Aprovacoes, e telas de lancamento |
