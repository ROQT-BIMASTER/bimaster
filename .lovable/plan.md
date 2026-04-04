

# Implementar Centros de Custo no Plano de Contas

## Situação Atual

- Coluna `centro_custo` existe em `trade_chart_of_accounts` mas está **100% vazia**
- Já temos **10 departamentos** vinculados às contas
- Centro de custo é um nível mais granular que departamento — permite rastrear custos por **unidade de negócio, projeto ou atividade**

## Proposta de Estrutura de Centros de Custo

Baseado na operação do cliente (distribuição de cosméticos com marca própria, logística, trade marketing), a estrutura recomendada:

```text
CC-ADM     Administrativo Geral
CC-FIN     Financeiro e Tesouraria
CC-RH      Recursos Humanos
CC-LOG     Logística e Distribuição
CC-TI      Tecnologia da Informação
CC-MKT     Marketing e Trade
CC-COM     Comercial / Vendas
CC-FAB     Fábrica / Importação China
CC-DEP     Depósito / Armazém
CC-OPR     Operações
```

## Mapeamento Centro de Custo → Contas

| Centro de Custo | Contas | Lógica |
|---|---|---|
| **CC-ADM** | `3.1.1.x` a `3.1.7`, `3.1.8.x`, `3.1.11` a `3.1.20`, `3.1.23` | Aluguel, utilities, serviços, seguros |
| **CC-FIN** | `1.x`, `2.5.x`, `2.7.x`, `3.4.x`, `4.1.x`, `4.3.x`, `4.4.x` | Receitas, impostos, tarifas, juros |
| **CC-RH** | `3.2.x` (todo) | Salários, férias, benefícios, rescisões |
| **CC-LOG** | `2.2`, `2.4.x`, `3.1.10.x` | Fretes, embalagens, veículos |
| **CC-TI** | `3.1.4`, `3.1.21`, `3.1.22`, `3.1.24` | Internet, hardware, software |
| **CC-MKT** | `3.3.x`, `2.6.x` | Marketing, trade, comissões |
| **CC-COM** | `2.1.x` | Compras de mercadoria, devoluções |
| **CC-DEP** | `3.1.1.1` (Aluguel Depósito) | Separar depósito do escritório |
| **CC-OPR** | `3.1.9` (Manutenção) | Manutenção predial |
| **CC-SOC** | `3.5.x` | Pró-labore e retiradas de sócios |

## Implementação

### Migração SQL única

1. **UPDATE em massa** na `trade_chart_of_accounts` setando `centro_custo` com código padronizado (CC-XXX) por faixa de código contábil
2. Sem necessidade de criar tabela nova — a coluna já existe

O centro de custo fica como texto livre na conta, alinhado ao departamento já vinculado, porém com a granularidade de separar por exemplo "Depósito" de "Escritório" dentro do mesmo departamento Administrativo.

| Ação | Detalhe |
|---|---|
| UPDATE ~100 contas | Setar `centro_custo` por faixa de código |
| Sem alteração de schema | Coluna já existe |

