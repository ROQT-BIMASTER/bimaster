

# O Que Falta Para Nota 10 — Diagnóstico Final

## Nota Atual: 9.0 / 10

Após todas as correções anteriores, restam **~800 títulos com inconsistências** e **6 lacunas estruturais**.

---

## INCONSISTÊNCIAS DE DADOS (afetam ~800 títulos)

### 1. Departamento "TI" duplicado — 262 títulos
- Existem dois nomes: **"TI"** e **"Tecnologia da Informação"** para o mesmo departamento
- 262 títulos de SOFTWARE usam "TI", 388 usam "Tecnologia da Informação"
- 38 títulos de INTERNET também divididos entre "TI" e "Tecnologia da Informação"
- **Correção**: Unificar todos os 300 títulos com "TI" → "Tecnologia da Informação"

### 2. PRÓ-LABORE em RH — 60 títulos
- Pró-labore é retirada de sócios, responsabilidade do **Financeiro** (ref. CPC/ITG 1000)
- 60 títulos ainda em "Recursos Humanos"
- **Correção**: dept → Financeiro

### 3. MODELOS/INFLUENCER em Administrativo — 181 títulos
- Conta `3.3.9` pertence a Marketing, mas 176 títulos estão em "Administrativo", 3 em "Projetos", 2 em "Operações"
- **Correção**: Todos → dept **Marketing** (ou Comercial / Trade)

### 4. CONTRATADO PJ disperso — 262 títulos
- 160 em Administrativo, 71 em RH, 31 em Financeiro
- PJ contratado com plano `3.1.8.12` (Mão de Obra Terceirizada) deveria ser **Operações**
- **Correção**: Unificar em Operações

### 5. Fretes regionais em depts errados — ~5 títulos
- SUL em Administrativo/Comercial/Financeiro/Operações (4 títulos)
- SÃO PAULO em RH (1 título)
- **Correção**: Todos → Logística

### 6. Menores (~50 títulos)
- LANCHES E REFEIÇÕES: 19 em RH → Administrativo
- REEMBOLSOS DIVERSOS: 51 em RH/Financeiro → Administrativo
- ADIANTAMENTO DE SALÁRIOS: 1 em Administrativo → RH
- FRETES AGREGADOS: 1 em Administrativo → Logística
- SALÁRIOS: 1 em Administrativo → RH
- TRANSFERÊNCIA: 5 em Administrativo/RH → Financeiro

---

## LACUNAS ESTRUTURAIS (impedem nota 10)

### 7. 31 contas analíticas sem movimento ("contas mortas")
- Incluem: Boletos, Depósitos, Cheque, Mercado Pago (receitas), Importações China, PIS, COFINS, IRPJ, CSLL, Depreciação, Limpeza, Café, Empréstimos, Influencers, Prêmios, Patrocínio, veículos, Investimentos, Receitas Financeiras
- **Ação**: Avaliar quais são "futuras" (manter) vs obsoletas (desativar). Sugestão:
  - **Manter** (aguardando dados futuros): Importações China, IRPJ, CSLL, Depreciação, Receitas Financeiras, Investimentos
  - **Desativar** (12+ meses sem uso): Boletos, Depósitos, Cheque (receitas vestigiais), Limpeza, Café, IPVA, Manutenção Veículos
  - **Decisão do cliente**: PIS, COFINS, Patrocínio, Prêmios, Influencers, Empréstimos

### 8. Falta conta de Provisões Trabalhistas
- Ref. CPC 25: empresas devem provisionar férias e 13º mensalmente
- Conta sugerida: `3.2.15 Provisão de Férias e 13º` em RH
- Impacto: DRE mensal mais preciso (distribuição linear vs pico em dezembro)

### 9. Falta conta de PDD (Provisão para Devedores Duvidosos)
- Ref. CPC 48: empresas com contas a receber devem reconhecer perdas esperadas
- Conta sugerida: `3.1.26 PDD - Provisão para Devedores Duvidosos` em Financeiro
- Impacto: Receita líquida realista

### 10. Receitas (grupo 1.x) sem nenhum título vinculado
- As 4 contas de receita existem no plano mas com 0 títulos
- Se receitas vêm de outra tabela (contas_receber), as contas estão corretas mas ociosas
- Se não há tabela de receitas, o DRE não tem linha de receita bruta
- **Ação**: Verificar se `contas_receber` existe e vincula ao plano, ou criar fluxo

### 11. Depreciação criada mas sem lançamentos
- Conta `3.1.25 Depreciação e Amortização` existe, porém sem dados
- Para EBITDA vs EBIT correto, precisa de lançamentos mensais de depreciação
- **Ação**: Definir política de depreciação e criar rotina de lançamento

### 12. "Comercial" vs "Comercial / Trade" — inconsistência de nome
- Frete SUL tem 1 título com dept "Comercial" (sem " / Trade")
- Pode indicar dept legado ou digitação manual

---

## SCORECARD DETALHADO

| Critério | Nota Atual | Para 10 | O que falta |
|---|---|---|---|
| Estrutura hierárquica | 9.5 | 10 | Desativar contas mortas irrelevantes |
| Cobertura de contas | 8.0 | 10 | Provisões (CPC 25), PDD (CPC 48) |
| Classificação DRE | 9.5 | 10 | Já bem distribuída com 8 categorias |
| Departamentos | 8.5 | 10 | Unificar "TI", corrigir ~800 títulos |
| Precisão dos dados | 9.0 | 10 | Zero inconsistências de dept por categoria |
| Aderência IFRS 18 | 9.0 | 10 | Provisões + Depreciação efetiva |

---

## IMPLEMENTAÇÃO

### Migração 1: Corrigir ~800 títulos restantes
- UPDATE por `categoria_nome` + `departamento_nome` para unificar departamentos
- Unificar "TI" → "Tecnologia da Informação"
- Corrigir PRÓ-LABORE, INFLUENCER, CONTRATADO PJ, fretes regionais

### Migração 2: Criar contas faltantes
- `3.2.15 Provisão de Férias e 13º` (RH, despesas_fixas, CC-RH)
- `3.1.26 PDD - Provisão para Devedores Duvidosos` (Financeiro, despesas_fixas, CC-FIN)

### Migração 3: Desativar contas mortas irrelevantes
- `is_active = false` para contas de receita vestigiais e outras sem perspectiva de uso

| Ação | Títulos | Impacto |
|---|---|---|
| Unificar "TI" → "Tecnologia da Informação" | 300 | Consistência departamental |
| Corrigir Influencer/PJ/Pró-labore | ~500 | Departamentos 100% corretos |
| Criar Provisões e PDD | 0 (novas contas) | Aderência CPC 25/48 |
| Desativar contas mortas | 0 (schema) | Plano limpo e profissional |

