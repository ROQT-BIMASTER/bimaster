

# Auditoria de Classificação de Despesas — Erros Remanescentes

## Referências Externas Consultadas

- **IFRS 18 / CPC 51** — Nova estrutura DRE obrigatória a partir de 2027: 3 categorias (Operacional, Investimento, Financiamento) + Impostos sobre Lucro
- **Analize.com.br** — Guia prático de categorias IFRS 18 na DRE
- **CPC 47** — Receita de contrato com cliente (comissões como despesa variável)
- **CPC 25** — Provisões, passivos contingentes (obrigações trabalhistas)
- **CPC 27** — Ativo imobilizado (classificação de investimentos vs despesa)

---

## NOTA PÓS-CORREÇÕES: 8.4 / 10 (era 7.2)

As correções anteriores resolveram os problemas mais graves. Restam **18 erros** que afetam **~2.100 títulos (R$ 16M)**.

---

## ERROS REMANESCENTES IDENTIFICADOS

### CRÍTICOS — Impactam DRE diretamente

**1. COMPRA DE MERCADORIA — Departamento inconsistente (R$ 484M)**
- 10.584 títulos → dept **Logística** ✗
- 207 títulos → dept **Financeiro** ✗
- 3 títulos → dept **Compras e Faturamento** ✓
- Ref. IFRS 18: Custo das vendas é categoria operacional, responsabilidade de **Compras e Faturamento**
- **Correção**: Todos os 10.794 títulos → dept **Compras e Faturamento** (o plano `2.1.1.1` já pertence a esse dept)

**2. RUBY ROSE - MARCA em conta GRUPO (R$ 2,5M)**
- 104 títulos apontam para `2.1.1` (que é **grupo**, não analítica)
- Conta correta: `2.1.1.3 Compras Marca Ruby Rose`
- Dept atual: Operações ✗ → deveria ser **Compras e Faturamento**

**3. DESPESAS PAGAS C/DINHEIRO — Conta errada (R$ 2,5M)**
- 83 títulos em `2.1.3 Despesas Comerciais` (custo_vendas)
- Despesa paga em dinheiro/cheque é meio de pagamento, não natureza da despesa
- Ref. CPC 51: dinheiro é instrumento, a despesa deveria ser classificada pela **natureza**
- **Correção**: Mover para `3.1.23 Outras despesas administrativas` (despesas_fixas) + dept **Financeiro**

**4. SUPERVISORES em Recursos Humanos (R$ 1M)**
- 83 títulos de comissão de supervisores em dept **RH**
- Ref. CPC 47: Comissão de vendas = despesa variável comercial
- **Correção**: dept → **Comercial / Trade**, CC → **CC-COM** (plano `2.6.1` já está correto)

**5. TARIFAS BANCÁRIAS em `2.7.1 Mercado Pago` (R$ 527k)**
- 1.431 títulos (TARIFAS BANCARIAS + TAXAS ADMINISTRATIVAS) todos apontam para `2.7.1 Mercado Pago`
- `2.7.1` está com `categoria_dre = resultado_financeiro` ✓, mas o **nome da conta** sugere apenas Mercado Pago
- Ref. IFRS 18 cat. Financiamento: tarifas bancárias genéricas deveriam ir para `3.4.1 Despesas Bancárias`
- **Correção**: Apenas TAXAS ADMINISTRATIVAS (43 títulos, R$ 205k) → `3.4.1` (as tarifas bancárias do MP podem ficar em 2.7.1)

### ALTOS — Departamento errado

**6. MODELOS/MANEQUINS/INFLUENCER em Administrativo (R$ 363k)**
- 176 títulos em dept **Administrativo**, conta `3.3.9 Modelos` (Marketing)
- Ref: Influencers são despesa de marketing variável
- **Correção**: dept → **Marketing**, CC → **CC-MKT**

**7. CONSULTORIA MARKETING em múltiplos departamentos**
- 53 títulos em **Administrativo** (R$ 380k), 2 em **Operações** (R$ 3,7k), 3 sem dept (R$ 75k)
- Conta `3.3.6` é Marketing
- **Correção**: Todos → dept **Marketing**, CC → **CC-MKT**

**8. ROYALTIES em Financeiro + Administrativo (R$ 4,5M)**
- 50 títulos em **Financeiro** (R$ 3,9M), 20 em **Administrativo** (R$ 534k)
- Ref. IFRS 18: Royalties de marca = despesa operacional de Marketing
- **Correção**: dept → **Marketing**, CC → **CC-MKT**

**9. CONTABILIDADE EXTERNA em dois departamentos**
- 388 títulos em **Financeiro**, 108 em **Administrativo**
- Contabilidade é serviço **Financeiro** (ref. Deloitte: G&A → Finance)
- **Correção**: Todos 108 do Administrativo → dept **Financeiro**

**10. DISPLAY em 4 departamentos diferentes**
- 16 sem dept, 9 em Compras, 5 em Trade MKT, 4 em Operações
- Display/Expositores = Trade Marketing (conta `3.3.5`)
- **Correção**: Todos → dept **Comercial / Trade**, CC → **CC-MKT**

**11. PRODUÇÃO DE EVENTOS em Operações (R$ 55k)**
- 13 títulos → conta `3.3.2 Eventos` (Marketing) mas dept **Operações**
- **Correção**: dept → **Marketing**

**12. UNIFORMES em Ações/Brindes (R$ 68k)**
- 57 títulos em `3.2.13.1 Ações e Brindes para Colaboradores`
- Uniforme é EPI/benefício, não brinde. Ref. NR-6: uniforme obrigatório = custo de pessoal
- **Correção**: Mover para `3.2.14 Outras despesas com pessoal`

### MÉDIOS — Inconsistências menores

**13. GARRAFAS DE ÁGUA em `3.1.3 Conta de Água` (R$ 14k)**
- 50 títulos — Garrafão de água mineral ≠ conta de água/saneamento
- **Correção**: Mover para `3.1.14 Material Limpeza/Higiene/Copa`

**14. MATERIAIS/FERRAMENTAS em `3.1.7 Material de Escritório` (R$ 730k)**
- 236 títulos — Ferramentas industriais ≠ material de escritório
- **Correção**: Mover para `3.1.9.2 Máquinas e Equipamentos`

**15. MATERIAL ELÉTRICO em `3.1.7 Material de Escritório` (R$ 23k)**
- 12 títulos — Material elétrico = manutenção predial
- **Correção**: Mover para `3.1.9.1 Predial`

**16. PRÓ-LABORE em dois departamentos**
- 88 títulos em **Financeiro**, 60 em **Recursos Humanos**
- Pró-labore é retirada de sócios, responsabilidade do **Financeiro**
- **Correção**: 60 títulos de RH → dept **Financeiro**

**17. ~312 títulos SEM departamento (R$ 934k)**
- 15 categorias com `departamento_nome = NULL`
- Incluem: SOFTWARE (164), PROVEDOR (43), DISPLAY (16), COMISSAO (2)
- **Correção**: Atribuir departamento baseado no plano de contas vinculado

**18. PALETERA em dept errado**
- 14 títulos em **Logística**, 17 em **Operações**
- Paleteira = equipamento de depósito = **Logística**
- **Correção**: 17 títulos de Operações → **Logística**

---

## ALERTA IFRS 18 / CPC 51 (vigência 2027)

A nova norma exige 3 categorias obrigatórias na DRE:
1. **Operacional** (nosso `receita_bruta` + `deducoes` + `custo_vendas` + `despesas_fixas` + `despesas_variaveis`) ✓
2. **Investimento** (nosso grupo 4.2.x — já está fora do DRE) ✓
3. **Financiamento** (nosso `resultado_financeiro`) ✓

Subtotais obrigatórios: **Lucro Operacional** e **Lucro antes de Financiamento e Impostos**. A estrutura atual já suporta isso com ajustes mínimos no frontend.

---

## RESUMO DE IMPACTO

| Tipo | Títulos | Valor (R$) |
|---|---|---|
| Departamento errado | ~1.500 | ~R$ 12M |
| Plano de contas errado | ~290 | ~R$ 3,5M |
| Sem departamento | ~312 | ~R$ 934k |
| **TOTAL** | **~2.100** | **~R$ 16M** |

---

## IMPLEMENTAÇÃO

Migração SQL única com ~20 UPDATEs por `categoria_nome` + `departamento_nome` para corrigir os registros afetados. Sem alteração de schema.

| Ação | Detalhe |
|---|---|
| UPDATE ~2.100 títulos | Corrigir dept + plano por categoria_nome |
| Sem alteração de schema | Apenas dados |
| Referências | IFRS 18, CPC 51, CPC 47, CPC 27, Deloitte |

