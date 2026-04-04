

# Auditoria do Plano de Contas 2026 — Falhas e Correções Necessárias

## Resumo da Análise

Após revisar as **110 contas ativas** e os **47.566 títulos classificados**, identifiquei **12 problemas** organizados por gravidade.

---

## FALHAS CRÍTICAS (impactam DRE e relatórios)

### 1. Conta 3.2.14 sobrecarregada — 4.770 títulos de SALÁRIOS

A conta `3.2.1 Salários CLT` é **grupo** (não aceita lançamento), então SALÁRIOS (3.247 títulos), ADIANTAMENTO DE SALARIOS (1.350) e Horas Extras (49) foram jogados em `3.2.14 Outras despesas com pessoal`.

**Correção**: Criar conta analítica `3.2.1.1.1 Salários` (nível 5, filha de `3.2.1.1 Hora Extra` ou criar `3.2.1.2 Salários`) e reclassificar os 4.646 títulos.

### 2. Grupo 4 inteiro sem `categoria_dre`

Todas as 23 contas do grupo 4 (Receitas/Despesas Não Operacionais, Investimentos, Atividades Financeiras, Sócios) estão com `categoria_dre = NULL`. Isso significa que **nenhuma dessas contas aparece no DRE**.

**Correção**: Definir `categoria_dre` para cada sub-grupo:
- `4.1` → pode ser um novo tipo ou mapear para existente
- `4.3` → despesas financeiras
- `4.4` → distribuição de lucros

### 3. Código `2.3` ausente — salto na numeração

A sequência vai de `2.2 Embalagens` direto para `2.4 Fretes`. O código `2.3` está vazio, quebrando a sequência numérica.

**Correção**: Renumerar ou criar `2.3` como conta reserva/placeholder.

### 4. `3.1.8.2 Limpeza` existe mas tem ZERO títulos

A conta foi cadastrada mas nenhum título foi classificado nela. Categorias como "SERVIÇOS DE TERCEIROS" e "PRESTAÇÃO DE SERVIÇOS/TERCEIRIZADO" (765 títulos) foram para `3.1.8.9 Outros Serviços` — parte deles poderia ser Limpeza.

**Correção**: Revisar se há títulos de limpeza dentro de `3.1.8.9` que deveriam ser reclassificados.

---

## FALHAS ESTRUTURAIS

### 5. Hierarquia `3.2.1` mal desenhada

```text
3.2.1   Salários CLT (GRUPO)
├─ 3.2.1.1   Hora Extra (GRUPO)  ← grupo dentro de grupo
│  └─ 3.2.1.1.2   Ajuda de Custo ← código .2 sem .1 existir
```

Problemas:
- `3.2.1.1.2` existe mas `3.2.1.1.1` não (salto)
- "Ajuda de Custo" não é sub-tipo de "Hora Extra"
- Não existe conta analítica para salários em si

**Correção**: Reestruturar:
```text
3.2.1   Salários CLT (GRUPO)
├─ 3.2.1.1   Salários (analítica)
├─ 3.2.1.2   Horas Extras (analítica)
├─ 3.2.1.3   Adiantamentos (analítica)
├─ 3.2.1.4   Ajuda de Custo (analítica)
```

### 6. `3.2.4 Encargos` contém apenas `3.2.4.1 Empréstimos`

"Empréstimos" não é encargo trabalhista. O nome do grupo e seu conteúdo são inconsistentes. Encargos deveria conter FGTS, INSS patronal, etc.

**Correção**: Renomear `3.2.4` para "Pensão/Descontos" ou mover Empréstimos para outro local e adicionar encargos reais (FGTS, INSS).

### 7. Conta `3.3.5 Exposittores` — erro de grafia

Nome com duplo "t": "Exposittores" em vez de "Expositores".

**Correção**: Corrigir nome para "Expositores".

---

## FALHAS DE CLASSIFICAÇÃO DRE

### 8. Marketing (`3.3`) classificado como `despesas_fixas`

Marketing geralmente é **despesa variável** pois varia com campanhas e sazonalidade. No plano do cliente, está como despesa fixa junto com aluguel e luz.

**Decisão do cliente**: Manter como fixa (simplificação) ou criar categoria DRE `despesas_variaveis` para marketing?

### 9. `2.5 Despesas Tributárias` com `categoria_dre = deducoes`

PIS, COFINS, ICMS como "deduções" é correto contabilmente (deduções da receita bruta). Porém, Simples Nacional (`2.5.1`) engloba tudo e está na mesma categoria — verificar se o cliente quer separar.

### 10. `2.7 Tarifas` contém apenas "Mercado Pago"

Se Mercado Pago é tarifa de meio de pagamento, deveria estar nas deduções (`categoria_dre: deducoes`) junto com impostos sobre vendas, não em `custo_vendas`.

---

## DADOS AUSENTES

### 11. Contas sem uso (0 títulos vinculados)

Contas cadastradas mas nunca utilizadas:
- `3.1.8.2 Limpeza`
- `3.1.10.1 Manutenção e Conserto (Veículos)`
- `3.1.10.2 IPVA/Licenciamento/Multas`
- `3.2.10 Café Funcionários`
- `3.3.4 Patrocínio`
- `4.2.7 Investimento Imóvel`

**Ação**: Verificar se realmente não há dados ou se faltou mapeamento no dicionário.

### 12. `3.1.8.9 Outros Serviços` concentra 1.561 títulos

Conta "genérica" com alta concentração. Categorias como "PRESTAÇÃO DE SERVIÇOS/TERCEIRIZADO" (408), "SERVIÇOS DE TERCEIROS" (242), "MÃO DE OBRA" (12) poderiam ser redistribuídas para contas mais específicas.

---

## Plano de Correção (se aprovado)

| Prioridade | Ação | Impacto |
|---|---|---|
| Alta | Criar `3.2.1.1` a `3.2.1.4` analíticas e reclassificar 4.770 títulos | Salários visíveis no DRE |
| Alta | Definir `categoria_dre` para grupo 4 inteiro | Grupo 4 aparece no DRE |
| Média | Corrigir hierarquia `3.2.1.x` e `3.2.4` | Estrutura limpa |
| Média | Corrigir grafia "Exposittores" → "Expositores" | Cosmético |
| Baixa | Criar `2.3` placeholder ou renumerar | Sequência numérica |
| Baixa | Revisar `3.1.8.9` para redistribuir | Precisão analítica |

| Arquivo | Mudança |
|---|---|
| Migração SQL (1) | Criar contas analíticas `3.2.1.x`, definir `categoria_dre` grupo 4, corrigir nomes |
| Migração SQL (2) | Reclassificar 4.770 títulos de `3.2.14` para novas contas `3.2.1.x` |

