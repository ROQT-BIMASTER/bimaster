# PROMPT LOVABLE — Fase 2b: PMP/Pontualidade exatos (média aparada) em fn_cp_kpis_avancados

Contexto: o conector de Contas a Pagar foi corrigido para gravar `data_pagamento` como a **data real do pagamento** (campo `Data_Mtpg`, operação 2 no ERP Result) — antes usava um campo nominal que ficava antes da emissão em ~29% dos títulos e dava PMP negativo. A carga já rodou (`atualizados: 50.987`).

Agora ajustar a RPC `public.fn_cp_kpis_avancados` para (1) calcular o **PMP como média aparada** (só pagamentos entre 0 e 180 dias — exclui adiantamentos e a cauda de títulos antigos) e (2) marcar `aproximado = false` (o número deixou de ser aproximado; o frontend remove o ` ≈` automaticamente por esse flag).

**Mudança cirúrgica — alterar SOMENTE dois pontos dentro do `jsonb_build_object`, mantendo o resto da função (guard `check_user_access`, filtro `user_has_empresa_access`, todas as outras chaves, assinatura e `SET search_path`) BYTE-A-BYTE idêntico.** É `CREATE OR REPLACE` da assinatura de 7 params já existente.

1. **PMP — adicionar a janela [0,180] no `avg`:**
   ```sql
   -- ANTES:
   'pmp_dias_aprox', (SELECT COALESCE(round(avg(data_pagamento - data_emissao))::int,0) FROM pagos),
   -- DEPOIS:
   'pmp_dias_aprox', (SELECT COALESCE(round(avg(data_pagamento - data_emissao))::int,0)
                      FROM pagos WHERE (data_pagamento - data_emissao) BETWEEN 0 AND 180),
   ```
   (`data_pagamento - data_emissao` em Postgres = inteiro de dias; a média fica só sobre a janela plausível.)

2. **Flag — virar false:**
   ```sql
   -- ANTES:  'aproximado', true,
   -- DEPOIS: 'aproximado', false,
   ```

**NÃO mexer na pontualidade** — `pontualidade_pct_aprox` continua sobre todos os `pagos` (é percentual, robusto a outlier; adiantamento pago antes do vencimento conta como pontual, o que é correto). O nome do campo (`_aprox`) fica como está para não quebrar o frontend; quem controla o ` ≈` é o booleano `aproximado`.

## Verificação (rodar após aplicar)
```sql
-- Deve retornar PMP ~11 dias e pontualidade ~86%. aproximado=false.
SELECT (fn_cp_kpis_avancados())->>'pmp_dias_aprox'        AS pmp_dias,
       (fn_cp_kpis_avancados())->>'pontualidade_pct_aprox' AS pontualidade_pct,
       (fn_cp_kpis_avancados())->>'aproximado'            AS aproximado;
-- (rodar autenticado como usuário com acesso financeiro; sem acesso deve dar erro 42501.)
```
Interpretação esperada: `pmp_dias ≈ 11`, `pontualidade_pct ≈ 86`, `aproximado = false`.
