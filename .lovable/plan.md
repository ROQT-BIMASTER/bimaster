## Diagnóstico

A função `calculateFinancialStatus` em `src/hooks/useFinancialStatus.ts` decide o status exibido na UI (badge "Pago"/"Vencido"/"Pendente"/"Parcial") usando uma hierarquia errada:

1. Confia em `status` textual do banco (linha 14): `if (statusLower === 'pago') return 'pago'` — sem checar saldo.
2. Confia em `data_pagamento` preenchida (linha 20): `if (dataPagamento) return 'pago'` — sem checar saldo.

O ERP preenche `data_pagamento` com a **data prevista** mesmo em títulos não quitados, e a coluna `status` é calculada na origem por uma regra que não considera o saldo atual após sincronização incremental.

### Impacto medido no banco (`contas_pagar`, 48.328 registros)

| Situação | Qtd | Comportamento atual |
|---|---|---|
| Saldo aberto > 0 **com** `data_pagamento` preenchida | **4.615** | Exibe "Pago" (ERRADO) |
| Saldo aberto > 0 e venceu antes de hoje | **3.799** | Devem aparecer como "Vencido" |
| Pagamentos parciais (pago > 0 e ainda há saldo) | **92** | Status "Parcial" nunca aparece |
| Quitados de fato (`valor_aberto ≤ 0`) | 43.660 | Corretos |

A imagem enviada mostra exatamente o sintoma: linhas com `R$ 2.182,55` em saldo, `R$ 0,00` pago, vencimento de hoje, badge verde "Pago".

## Correção (regra contábil correta)

Reescrever `calculateFinancialStatus` para usar **valores monetários como fonte da verdade** e cair em data só como desempate:

```text
1. valor_aberto ≤ 0.005          → "pago"        (quitado, tolerância 1 centavo)
2. valor_pago > 0 e aberto > 0   → "parcial"     (pagamento parcial)
3. data_vencimento < hoje        → "vencido"     (saldo aberto e venceu)
4. resto                         → "pendente"
```

Datas e o campo `status` textual passam a ser **apenas dicas** (parcial vindo do ERP é mantido se valores faltarem) — não decidem mais o resultado.

## Arquivos tocados

### 1. `src/hooks/useFinancialStatus.ts`
- Adicionar parâmetros `valorAberto` e `valorPago` na assinatura de `calculateFinancialStatus`.
- Reescrever corpo seguindo a hierarquia acima.
- Atualizar `useCalculatedFinancialStatus` para passar `valor_aberto` e `valor_pago` (com fallback `valor_recebido` para AR).

### 2. `src/components/financeiro/ContasPagarTabContent.tsx` (a tabela da imagem)
- Linhas 470 e 476: passar `c.valor_aberto, c.valor_pago` nas duas chamadas de `calculateFinancialStatus`.

### 3. `src/pages/ContasAPagar.tsx`
- Linha 436 (filtro de status): passar `c.valor_aberto, c.valor_pago`.
- Linhas 471, 477, 482 (KPIs): idem.
- Linhas 486-491 (`pagasNoMes`): trocar `(c.status || '').toLowerCase() === 'pago'` por checagem de `valor_aberto ≤ 0.005` + `data_pagamento` no mês corrente. Garante que o KPI "Pagas no mês" use o mesmo critério dos badges.

### 4. `src/components/financeiro/DashboardContasPagar.tsx`
- Linhas 308-312: passar `c.valor_aberto, c.valor_pago`.

### 5. `src/components/financeiro/CalendarioVencimentos.tsx`
- Linhas 46, 97, 101, 117, 121: passar `c.valor_aberto, c.valor_pago` (já passa `null` para `data_pagamento`, mantém).

### 6. Documentação inline
- Atualizar entrada APP_VERSION em `src/components/erp/ApiDocumentation.tsx` com bump de patch (3.2.4 → 3.2.5) descrevendo a mudança de regra e os 4.615 títulos reclassificados, conforme a disciplina de changelog.

## Compatibilidade

A nova assinatura mantém `valorAberto`/`valorPago` como **opcionais**. Chamadas que não foram atualizadas continuam funcionando (caem no fallback de data) — sem quebra de tipos. As 4 telas listadas acima são atualizadas explicitamente para passar os valores e ganhar a precisão.

## Verificação pós-deploy

- Visual: voltar para `/dashboard/financeiro/contas-a-pagar`, ver as linhas da imagem como "Vencido" (vermelho) ou "Pendente" (cinza), nunca mais "Pago" verde quando há saldo.
- KPI "Total a Pagar" e "Vencidas" no topo passam a refletir os 4.615 + 3.799 títulos antes mascarados.
- Badge "Parcial" passa a aparecer nos 92 títulos com pagamento parcial.
- `grep "calculateFinancialStatus(c.data_vencimento, c.data_pagamento, c.status)"` em `src/components/financeiro/` e `src/pages/ContasAPagar.tsx` deve retornar **0** (todas as chamadas migradas para a nova assinatura de 5 parâmetros).
