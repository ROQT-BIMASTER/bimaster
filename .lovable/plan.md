

# Reclassificação Completa: 248 Categorias → Plano de Contas + Departamento + Centro de Custo

## Situação Atual

- **47.566 títulos** — 100% já possuem plano de contas e departamento
- **248 categorias** ERP distintas mapeadas
- Porém: **~45 categorias com erros** de classificação (departamento e/ou plano de contas incorretos)
- Impacto: **~7.500 títulos** precisam de correção (16% da base)

---

## ERROS IDENTIFICADOS (com referência contábil)

### CRÍTICOS — Departamento completamente errado

| Categoria ERP | Qtd | Dept ATUAL (errado) | Dept CORRETO | Plano Contas | Justificativa |
|---|---|---|---|---|---|
| **COMISSAO** | 1.670 | Recursos Humanos | **Comercial / Trade** | 2.6.1 ✓ | Comissão de vendas é despesa comercial variável (CPC 47) |
| **REPRESENTANTES** (com espaço) | 1.044 | Operações | **Comercial / Trade** | 2.6.1 ✓ | Representante comercial = comissão |
| **REPRESENTANTES** (sem espaço) | 764 | Compras e Faturamento | **Comercial / Trade** | 2.6.1 ✓ | Idem |
| **REPRESENTANTE** | 37 | Administrativo | **Comercial / Trade** | 2.6.1 ✓ | Idem |
| **COORDENADORES** | 25 | Recursos Humanos | **Comercial / Trade** | 2.6.1 ✓ | Comissão de coordenadores comerciais |
| **GERENTES** | 131 | Recursos Humanos | **Comercial / Trade** | 2.6.1 ✓ | Comissão de gerentes comerciais |
| **PROMOTORAS** | 16 | Operações | **Comercial / Trade** | 2.6.2 | Promotora de vendas = trade |
| **PROMOTOR** | 1 | Operações | **Comercial / Trade** | 2.6.2 | Idem |
| **PREMIOS/ GUELTAS** | 34 | Recursos Humanos | **Comercial / Trade** | 2.6.2 ✓ | Gueltas são incentivos comerciais |
| **TRANSPORTADORA/VENDAS ONLINE** | 1.201 | Recursos Humanos | **Logística** | 2.4.1 ✓ | Frete de vendas = logística |
| **IMPOSTOS/TAXAS** | 666 | Recursos Humanos | **Financeiro** | 2.5.1 ✓ | Impostos são responsabilidade do Financeiro |
| **SERVIÇOS DE TERCEIROS** | 242 | Recursos Humanos | **Operações** | 3.1.8.12 | Serviço terceirizado = Operações |
| **DIVERSOS** (com/sem espaço) | 583 | TI | **Administrativo** | 3.1.8.9 ✓ | "Diversos" é despesa administrativa genérica |
| **OUTROS** | 152 | Recursos Humanos | **Administrativo** | 3.1.8.9 ✓ | Idem |
| **FERRAMENTAS E ACEESSORIOS** | 48 | Tecnologia da Informação | **Operações** | 3.1.9.2 ✓ | Ferramentas físicas = Operações |
| **CAMERAS** | 52 | TI | **Operações** | 3.1.8.1 | Câmeras = Segurança/Monitoramento |
| **PRESTAÇÃO DE SERVIÇOS/TERCEIRIZADO** | 408 | TI | **Operações** | 3.1.8.12 | Terceirização = Operações |
| **SISTEMA DE TERCEIROS** | 42 | TI | **TI** ✓ | 3.1.8.11 | Plano errado: era 3.1.8.9, deve ser Sistemas |

### ALTOS — Plano de Contas errado

| Categoria ERP | Qtd | Plano ATUAL (errado) | Plano CORRETO | Justificativa |
|---|---|---|---|---|
| **COMPRA DE MERCADORIA PARA REVENDA** | 10.794 | 2.1.1 (grupo) | **2.1.1.1** (Compras Nacionais) | 2.1.1 virou grupo, títulos devem ir para analítica |
| **PENSÃO ALIMENTICIA** | 54 | 3.2.4.1 Empréstimos | **3.2.14** Outras desp. pessoal | Pensão não é empréstimo, é obrigação trabalhista |
| **IMPRESSORAS - COMPRA** | 47 | 3.1.8.6 Impressões | **3.1.21** Hardware e Acessórios | Compra de equipamento ≠ serviço de impressão |
| **UNIFORMES** | 48+4 | 3.2.13.1 Ações/Brindes | **3.2.12.3** Uniforme específico ou **3.2.14** | Uniforme é benefício/EPI, não brinde |
| **CONTRATADO PJ** | 262 | 3.1.8.4 Freelancers | **3.1.8.12** Mão de Obra Terceirizada | PJ contratado = terceirizado, não freelancer |
| **PALETES** | 48 | 3.1.9.2 Máq/Equip | **2.2** Embalagens e Materiais | Palete é material de acondicionamento logístico |
| **PORTA PALETES** | 26 | 3.1.9.2 Máq/Equip | **3.1.9.2** ✓ ou **4.2.5** | Rack é investimento/imobilizado |
| **CONSULTORIA** | 34 | 3.3.6 Consultoria MKT | **3.1.8.4** Freelancers | Consultoria genérica não é marketing |
| **CONSULTORIA COMERCIAL** | 3 | 3.3.6 Consultoria MKT | **2.6.2** Trade Comercial | Consultoria comercial é despesa variável |
| **DESENVOLVIMENTO SITES/REDE SOCIAIS** | 46 | 3.1.22 Softwares | **3.3.11** Mídia Social | Redes sociais é marketing digital |
| **AGENDAMENTO/TDE** | 2 | 3.3.1 Publicidade | **2.6.2** Trade Comercial | TDE = Trade Development Expense |
| **TAXAS REF. SERVIÇOS DE TERCEIROS** | 29 | 2.7.1 Mercado Pago | **3.4.1** Despesas Bancárias | Taxa de serviço = despesa financeira |
| **MATERIAL PARA REFORMA** | 59 | 3.1.14 Limpeza/Copa | **3.1.9.1** Predial | Reforma é manutenção predial |
| **MATERIAL PARA SEGURANÇA NO TRABALHO** | 23 | 3.1.14 Limpeza/Copa | **3.2.5** Medicina do Trabalho | EPI = segurança ocupacional (RH) |
| **MÃO DE OBRA** | 12 | 3.1.8.9 Outros | **3.1.8.12** Mão de Obra Terceirizada | Conta específica existe |
| **ANUIDADE DE ENTIDADES DE CLASSE** | 15 | 3.1.8.9 Outros | **3.1.8.10** Anuidades e Associações | Conta específica existe |
| **ASSINATURA REVISTA** | 3 | 3.1.8.9 Outros | **3.1.8.13** Publicações e Assinaturas | Conta específica existe |
| **SISTEMA FISCAL TRIBUTÁRIO** | 16 | 2.5.1 Simples Nacional | **3.1.8.11** Sistemas e Software | Sistema fiscal é software, não imposto |
| **IMPOSTOS- APLICA FINANCEIRA** | 1 | 2.5.1 Simples Nacional | **3.4.1** Despesas Bancárias | IOF s/ aplicação = resultado financeiro |
| **FRETE TRANSF. FORNECEDOR** | 189 | 2.4.1 Transportadoras | **2.4.6** Frete de Fornecedor | Frete de entrada tem conta própria |
| **ARMAZENAGEM MERCADORIA** | 9 | 3.1.19 Locações | **3.1.1.1** Depósito | Armazenagem = custo de depósito |
| **KM/PEDAGIOS/OUTROS** | 5 | 3.1.15 Uber/Táxi | **3.1.10.3** Combustível | Pedágio = custo veicular |
| **PROMOTORAS/REPOSITORES/FREE E BICOS** | 10 | 3.3.4 Influencers | **2.6.2** Trade Comercial | Repositores = trade marketing |
| **RECEPCIONISTA/PROMOTORAS/MAQUIADORAS** | 9 | 3.3.4 Influencers | **3.3.2** Eventos | Recepcionistas de eventos |
| **PREVIDENCIA PRIVADA** | 3 | 3.2.12.2 Plano de Saúde | **3.2.14** Outras desp. pessoal | Previdência ≠ saúde |
| **FARMACIA** | 3 | 3.2.5 Medicina do Trabalho | **3.2.14** Outras desp. pessoal | Farmácia genérica ≠ medicina ocupacional |
| **EQUIPAMENTOS DE INCENDIOS** | 3 | 3.1.23 Outras desp. admin | **3.1.8.1** Segurança/Monitoramento | Incêndio = segurança predial |
| **CONSULTORIA LOGISTICA** | 1 | 2.4.1 Transportadoras | **3.1.8.4** Freelancers | Consultoria ≠ transporte |
| **Ação comemorativa** | 50 | Administrativo → | **Recursos Humanos** | 3.2.13.1 ✓ Ações para funcionários = RH |
| **CONFRATERNIZAÇÃO** | 6 | Administrativo → | **Recursos Humanos** | 3.2.13.1 ✓ Idem |
| **ALIMENTAÇÃO** | 130 | Recursos Humanos | **Administrativo** | 3.1.16 ✓ R$ 3,3M em refeições corporativas |
| **MIDIA SOCIAL** | 123 | TI | **Comercial / Trade** | 3.3.11 ✓ Marketing digital é MKT |
| **CENTROESTE: MT/MS/GO/DF** | 5 | Marketing | **Logística** | 2.4.1 ✓ Frete regional = logística |
| **ESTORNO DE PAGAMENTO** | 17 | Logística | **Financeiro** | 4.1.1 ✓ Estorno = resultado financeiro |
| **CHEQUE** | 10 | Financeiro ✓ | **Financeiro** | 4.1.1 → **3.4.1** Despesas Bancárias (não é receita) |
| **BRINDES/PRODUTOS** | 18 | Administrativo | **Comercial / Trade** | 2.6.2 ✓ Brindes comerciais = trade |
| **DESPESAS PAGAS C/DINHEIRO** | 83 | Operações | **Financeiro** | **3.1.23** Outras desp. admin | Cofre = caixa do financeiro |

### MÉDIOS — Ajustes de Centro de Custo

| Categoria | CC ATUAL | CC CORRETO |
|---|---|---|
| COMISSAO, REPRESENTANTES*, GERENTES, COORDENADORES | CC-RH/CC-OPS | **CC-COM** |
| TRANSPORTADORA/VENDAS ONLINE | CC-RH | **CC-LOG** |
| IMPOSTOS/TAXAS | CC-RH | **CC-FIN** |
| CAMERAS | CC-TI | **CC-OPR** |
| DIVERSOS, OUTROS | CC-TI/CC-RH | **CC-ADM** |
| MIDIA SOCIAL | CC-TI | **CC-MKT** |

---

## RESUMO DE IMPACTO

| Tipo de Correção | Títulos Afetados | Valor (R$) |
|---|---|---|
| Departamento errado | ~5.800 | ~R$ 60M |
| Plano de contas errado | ~1.400 | ~R$ 7M |
| Ambos errados | ~300 | ~R$ 2M |
| **TOTAL** | **~7.500** | **~R$ 69M** |

---

## IMPLEMENTAÇÃO

### Migração SQL única com ~50 UPDATEs

Cada UPDATE corrige `plano_contas_id`, `plano_contas_codigo`, `plano_contas_nome`, `departamento_id`, `departamento_nome` usando `CASE WHEN categoria_nome = 'X' THEN ...` para garantir 100% de precisão determinística.

A migração também propaga o `centro_custo` correto baseado no plano de contas vinculado (herda da `trade_chart_of_accounts`).

| Ação | Detalhe |
|---|---|
| UPDATE ~7.500 títulos | Corrigir plano + departamento por categoria_nome |
| Sem alteração de schema | Apenas dados |
| Referências: TOTVS, Conta Azul, CPC 47, Deloitte | Comissões = variável, impostos = financeiro, terceirizados = operações |

