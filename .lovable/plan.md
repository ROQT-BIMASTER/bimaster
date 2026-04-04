

# Revisao Completa do Fluxo de Caixa — Valores e Interatividade

## Diagnostico (dados reais do banco)

### Problemas de Dados
| Problema | Impacto |
|---|---|
| Contas a pagar com datas absurdas: 1973, 2050, 2089 | ~R$ 6M poluindo aging e projecoes |
| 10 registros concentrados em UNION MEDIC SP, NELIDA, FABULOUS, DISPLAY GV | Distorcem saldo projetado e gaps |

### Problemas de Calculo (6 erros)
| KPI | Erro | Correção |
|---|---|---|
| **DSO** | Calcula media de dias ate vencimento a partir de hoje — nao e DSO real | DSO = (Recebíveis / Receita media mensal) x 30 |
| **DPO** | Mesmo erro | DPO = (Pagáveis / Custo medio mensal) x 30 |
| **Previsão 12m** | `saldoProjetado * 12` — sem sentido | Usar media movel dos ultimos 6 meses projetada |
| **YoY** | Compara `valor_aberto` (saldo residual) entre anos | Deve usar `valor_original` para comparacao justa |
| **Projecao diaria** | Usa `valor_aberto` de titulos filtrados | Correto, mas precisa excluir datas anomalas |
| **Ciclo Financeiro** | DSO - DPO com valores errados | Correto apos corrigir DSO/DPO |

### Problemas de UX (3 lacunas)
| Card | Estado | Necessário |
|---|---|---|
| Maior Gap | Estatico, sem detalhe | Dialog clicavel com lista de gaps por data |
| Previsao 12m | Estatico | Dialog com projecao mensal e premissas |
| Aging Receber/Pagar | Nao expande por cliente/fornecedor | Clique na faixa expande top 10 devedores/credores |

## Plano de Implementacao

### 1. Filtrar dados anomalos no hook (`useFluxoCaixaData.ts`)
- Adicionar filtro de sanidade: excluir `data_vencimento < 2020-01-01` e `> 2030-12-31` nos dados de contas_pagar
- Logar registros excluidos no console para auditoria

### 2. Corrigir calculos dos KPIs (`FluxoCaixaKPIsAdvanced.tsx`)
- **DSO**: `(totalReceber / (receita6meses / 6)) * 30` usando soma de `valor_original` dos ultimos 6 meses de `contasReceberRaw` com status `recebido`
- **DPO**: `(totalPagar / (custo6meses / 6)) * 30` usando `contasPagarRaw` com status `pago`
- **Previsao 12m**: Media movel do saldo liquido dos ultimos 6 meses x 12
- **YoY**: Trocar `valor_aberto` por `valor_original` na comparacao

### 3. Tornar "Maior Gap" clicavel (`FluxoCaixaKPIsAdvanced.tsx`)
- Envolver card em Dialog com lista dos 10 maiores gaps por data
- Mostrar: data, valor de entradas, valor de saidas, gap, top 3 fornecedores/clientes do dia
- Icone ChevronRight no hover (mesmo padrao YoY/Inadimplencia)

### 4. Tornar "Previsao 12m" clicavel (`FluxoCaixaKPIsAdvanced.tsx`)
- Dialog com tabela de 12 meses projetados
- Mostrar: mes, entrada estimada, saida estimada, saldo, acumulado
- Bloco explicativo: "Baseado na media dos ultimos 6 meses"

### 5. Expandir faixas de Aging por clique (`FluxoDeCaixa.tsx`)
- No componente AgingReport: ao clicar em uma faixa, expandir com top 10 clientes/fornecedores daquela faixa
- Mostrar nome, valor, quantidade de titulos, % da faixa
- Usar estado local com Collapsible para cada faixa

### 6. Adicionar tooltip explicativo em cada KPI
- Todos os 10 cards devem ter icone `Info` com tooltip explicando a formula
- Exemplo: "DSO = Recebiveis abertos / Receita media mensal x 30 dias"

## Arquivos Alterados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useFluxoCaixaData.ts` | Filtro de datas anomalas, buscar dados de pagos/recebidos para calculo DSO/DPO |
| `src/components/fluxocaixa/FluxoCaixaKPIsAdvanced.tsx` | Corrigir DSO/DPO/Previsao/YoY, adicionar Dialogs em Gap e Previsao, tooltips |
| `src/pages/FluxoDeCaixa.tsx` | Expandir AgingReport com detalhes por faixa clicavel |

