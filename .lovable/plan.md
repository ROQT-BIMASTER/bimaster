

# Vincular Plano de Contas a Departamentos

## Contexto

A tabela `trade_chart_of_accounts` já possui as colunas `departamento` (varchar) e `departamento_id` (uuid), mas ambas estão **100% vazias**. Os 9 departamentos ativos são:

```text
Administrativo | Compras e Faturamento | Fábrica China | Financeiro
Logística | Operações | Projetos | Recursos Humanos | TI
```

## Departamento Faltante

Analisando o plano de contas, falta o departamento **Marketing / Trade** — as contas `3.3.x` (Publicidade, Eventos, Influencers, etc.) e `2.6.x` (Comissões, Trade Comercial) não têm departamento correspondente.

**Ação**: Criar departamento "Marketing" ou "Comercial / Trade".

## Mapeamento Proposto (Conta → Departamento)

| Grupo de Contas | Departamento | Justificativa |
|---|---|---|
| **1.x** Receita Bruta | **Financeiro** | Recebimentos e tesouraria |
| **2.1.x** Fornecedores | **Compras e Faturamento** | Compras de mercadoria |
| **2.2** Embalagens | **Logística** | Materiais de expedição |
| **2.4.x** Fretes | **Logística** | Transporte e distribuição |
| **2.5.x** Impostos de Vendas | **Financeiro** | Obrigações tributárias |
| **2.6.x** Despesas Comerciais | **Comercial/Trade** (novo) | Comissões e trade |
| **2.7.x** Tarifas | **Financeiro** | Taxas bancárias |
| **3.1.1** Aluguel | **Administrativo** | Infraestrutura |
| **3.1.2 a 3.1.7** Utilities | **Administrativo** | Luz, água, internet, telefone |
| **3.1.8.x** Serviços terceiros | **Administrativo** | Limpeza, segurança, contabilidade |
| **3.1.9** Manutenção | **Operações** | Manutenção predial e equipamentos |
| **3.1.10** Veículos | **Logística** | Frota e combustível |
| **3.1.21, 3.1.22, 3.1.24** TI | **TI** | Hardware, software, locação IT |
| **3.1.18** Viagens | **Administrativo** | Despesas corporativas |
| **3.2.x** Pessoal (todo) | **Recursos Humanos** | Salários, férias, benefícios, rescisões |
| **3.3.x** Marketing (todo) | **Comercial/Trade** (novo) | Publicidade, eventos, influencers |
| **3.4.x** Financeiro | **Financeiro** | Juros e rendimentos |
| **3.5.x** Sócios | **Financeiro** | Pró-labore |
| **4.1.x** Mov. Financeiras | **Financeiro** | Estornos, transferências |
| **4.2.x** Investimentos | **Administrativo** | Ativos imobilizados |
| **4.3.x** Empréstimos | **Financeiro** | Amortizações |
| **4.4.x** Sócios/Lucros | **Financeiro** | Distribuição de lucros |

## Lacunas Identificadas no Plano

1. **Departamento "Marketing/Comercial" não existe** — precisa ser criado para comportar `3.3.x` e `2.6.x`
2. **Contas de TI misturadas em Administrativo** — `3.1.21` (Hardware), `3.1.22` (Software), `3.1.24` (Locação IT) e `3.1.4` (Internet) poderiam ter sub-grupo próprio `3.1.IT` ou serem vinculadas ao depto TI
3. **Operações sem contas específicas** — o departamento "Operações" existe mas não há contas claras para ele (apenas manutenção `3.1.9`); considerar vincular `2.2` (Embalagens) e `3.1.19` (Locações operacionais)
4. **Fábrica China sem contas** — departamento existe mas nenhuma conta reflete custos de importação/produção China
5. **Projetos sem contas** — departamento existe mas não há contas de "Despesas de Projeto" no plano

## Implementação

### 1. Criar departamento "Comercial / Trade"
Inserir na tabela `departamentos`.

### 2. UPDATE em massa no `trade_chart_of_accounts`
Setar `departamento_id` e `departamento` (nome) para cada conta usando o mapeamento acima, via SQL direto com CASE WHEN por faixa de código.

### 3. Interface (opcional, fase 2)
Na tela do Plano de Contas, exibir badge com nome do departamento ao lado de cada conta e filtro por departamento.

| Ação | Detalhe |
|---|---|
| INSERT departamento | Criar "Comercial / Trade" |
| UPDATE ~110 contas | Setar `departamento_id` por faixa de código |
| Sem alteração de schema | Colunas já existem na tabela |

