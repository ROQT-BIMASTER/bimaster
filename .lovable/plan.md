

# Auditoria Completa do Plano de Contas 2026 — Nota e Melhorias

## Referências Externas Consultadas

- **Vencru** — Chart of Accounts for Wholesale Distributors (abril 2024)
- **HubiFi** — Chart of Accounts Best Practices (outubro 2025)
- **Deloitte** — Strategic Chart of Accounts Design (ERP optimization)
- **Conta Azul** — DRE na Contabilidade: como fazer e analisar

---

## NOTA GERAL: **7.2 / 10**

| Critério | Nota | Peso | Justificativa |
|---|---|---|---|
| Estrutura hierárquica | 8/10 | 20% | 5 níveis bem definidos, numeração sequencial |
| Cobertura de contas | 6/10 | 20% | 28 contas analíticas sem movimento; faltam contas críticas |
| Classificação DRE | 8/10 | 20% | Boa após reclassificação recente (8 categorias) |
| Departamentos / CC | 7/10 | 15% | 100% preenchido, mas alguns mapeamentos questionáveis |
| Precisão dos dados | 6/10 | 15% | Conta "3.1.8.9 Outros" concentra R$ 6.5M (1.561 títulos) |
| Aderência a padrões | 8/10 | 10% | Segue CPC/IFRS para DRE gerencial |

---

## PROBLEMAS IDENTIFICADOS (12 itens)

### CRÍTICOS (impactam DRE)

**1. "Lixeira" 3.1.8.9 — R$ 6,5 milhões em "Outros Serviços"**
- 1.561 títulos de 11 categorias ERP diferentes jogados em uma conta genérica
- Inclui "DIVERSOS" (485), "PRESTAÇÃO DE SERVIÇOS/TERCEIRIZADO" (408), "MÃO DE OBRA" (12), "ANUIDADE DE ENTIDADES" (15)
- **Problema**: Impossível analisar despesas administrativas com 9,5% do valor total em "outros"
- **Correção**: Desmembrar em contas específicas: `3.1.8.10 Anuidades/Associações`, `3.1.8.11 Serviços Diversos Identificados`; redistribuir categorias que têm destino claro

**2. Tarifas Bancárias (2.7) como `custo_vendas` — deveria ser `resultado_financeiro`**
- R$ 591k em tarifas do Mercado Pago classificadas como custo de vendas
- Padrão contábil: tarifas bancárias são despesa financeira, não CMV
- **Correção**: Reclassificar `2.7.x` de `custo_vendas` para `resultado_financeiro`

**3. Receitas (1.x) no Contas a PAGAR — 0 títulos vinculados**
- As 4 contas de receita (Boletos, Depósitos, Cheque, Mercado Pago) estão no plano mas sem nenhum título
- **Problema**: Se receitas estão em outra tabela, essas contas são vestigiais; se não estão em nenhuma, o DRE não tem receita
- **Ação**: Verificar se existe tabela `contas_receber` e vincular; caso contrário, criar fluxo de receitas

**4. IRPJ e CSLL (2.5.5/2.5.6) — 0 títulos**
- Impostos sobre lucro existem no plano mas não possuem nenhum título vinculado
- Possível que o cliente pague via Simples Nacional (2.5.1) e essas contas sejam desnecessárias
- **Ação**: Se a empresa é Simples Nacional, desativar essas contas; se não é, investigar por que não há lançamentos

### ALTOS

**5. Concentração extrema: 71% do valor em uma única conta**
- `2.1.1 Compras Ruby Rose (Marca)` = R$ 487M (10.926 títulos)
- Referência Vencru recomenda separar COGS por linha de produto ou fornecedor
- **Correção**: Criar `2.1.1.1 Compras Nacionais`, `2.1.1.2 Importações China`, `2.1.1.3 Outros Fornecedores`

**6. Refeições (3.1.16) com R$ 3,8M — departamento errado**
- Classificada como CC-ADM/Administrativo, mas R$ 3,8M sugere que inclui refeições de TODOS os departamentos
- Referência Deloitte: despesas de alimentação devem ser segregadas entre benefício de pessoal (RH) e despesa administrativa
- **Correção**: Separar em `3.1.16.1 Refeições Corporativas` (ADM) e `3.2.12.4 Refeições Funcionários` (RH)

**7. 28 contas analíticas sem nenhum título (contas mortas)**
- Incluem: PIS, COFINS, IRPJ, CSLL, Limpeza, Café, Prêmios, Patrocínio, veículos
- Referência HubiFi: "Review your CoA quarterly; remove accounts with zero activity for 12+ months"
- **Ação**: Avaliar se são contas esperando dados futuros ou se devem ser desativadas

### MÉDIOS

**8. Falta conta de Depreciação/Amortização**
- Referência Vencru lista "807 Depreciation Expenses" como essencial para distribuidores
- O plano não possui conta de depreciação — importante para cálculo correto de EBITDA vs EBIT
- **Correção**: Criar `3.1.25 Depreciação e Amortização` em Despesas Fixas

**9. Falta separação de Frete de ENTRADA vs SAÍDA**
- `2.4.1 Transportadoras` mistura frete de venda (2.436 títulos) com "FRETE TRANSF. FORNECEDOR" (189 títulos)
- Frete de entrada = custo de aquisição (CMV); Frete de saída = despesa comercial
- **Correção**: Criar `2.4.6 Frete de Fornecedor (Entrada)` separado

**10. "Exposittores" com erro de grafia**
- Conta `3.3.5` escrita como "Exposittores" com dois "t"
- R$ 1,1M vinculado — aparece em relatórios com erro
- **Correção**: Renomear para "Expositores"

**11. Cartão de Crédito (3.1.20) como conta avulsa**
- R$ 993k classificados como despesa fixa administrativa
- Na prática, cartão de crédito é meio de pagamento, não tipo de despesa
- As compras no cartão deveriam ser classificadas pela natureza (material, viagem, etc.)
- **Ação**: Avaliar redistribuir ou manter como "transitória" com nota explicativa

**12. Internet (3.1.4) no departamento TI**
- Internet é infraestrutura que atende TODA a empresa, não apenas TI
- Referência: utilities devem ficar em Administrativo ou rateados
- **Correção menor**: Mover para CC-ADM ou criar rateio

---

## O QUE FALTA vs REFERÊNCIAS PROFISSIONAIS

| Conta Ausente | Referência | Impacto |
|---|---|---|
| **Depreciação / Amortização** | Vencru 807, IFRS/CPC | EBITDA vs EBIT incorreto |
| **Provisões Trabalhistas** | CPC 25 | Férias e 13º provisionados |
| **Perdas com Inadimplência (PDD)** | CPC 48 | Receita líquida superestimada |
| **Frete de Entrada (CMV)** | Vencru 702 | CMV subestimado |
| **Seguros de Mercadoria vs Predial** | Deloitte | Misturado em 3.1.11 |
| **Custos de Importação (China)** | Operação do cliente | Dept "Fábrica China" sem contas |

---

## PLANO DE CORREÇÕES SUGERIDO

### Etapa 1: Correções Imediatas (migração SQL)
1. Reclassificar `2.7.x` Tarifas → `resultado_financeiro`
2. Corrigir grafia "Exposittores" → "Expositores"
3. Criar contas: `3.1.25 Depreciação`, `2.4.6 Frete Entrada`, `2.1.1.1/2/3` subdivisões de compras

### Etapa 2: Desmembrar "Outros Serviços" (3.1.8.9)
1. Analisar as 11 categorias ERP que caem nessa conta
2. Criar contas específicas para as maiores (Serviços de Terceiros, Sistemas)
3. Redistribuir os 1.561 títulos

### Etapa 3: Contas Mortas e Limpeza
1. Avaliar as 28 contas sem movimento
2. Desativar as que não serão usadas
3. Criar contas faltantes (Depreciação, PDD, Importação)

### Etapa 4: Refinamento de Departamentos
1. Mover Refeições corporativas para RH (parcial)
2. Avaliar Internet → Administrativo ou rateio
3. Criar contas para dept "Fábrica China" e "Projetos"

| Prioridade | Ação | Impacto |
|---|---|---|
| Alta | Reclassificar tarifas bancárias | DRE financeiro correto |
| Alta | Desmembrar 3.1.8.9 | Visibilidade de R$ 6,5M |
| Alta | Subdividir Compras 2.1.1 | Análise de CMV por origem |
| Média | Criar Depreciação | EBITDA profissional |
| Média | Separar Frete Entrada/Saída | CMV preciso |
| Baixa | Limpeza de contas mortas | Organização |

| Arquivo | Mudança |
|---|---|
| Migração SQL (1) | Reclassificar 2.7.x, corrigir nomes, criar contas novas |
| Migração SQL (2) | Redistribuir títulos de 3.1.8.9 |
| Migração SQL (3) | Subdividir 2.1.1 em sub-contas |

