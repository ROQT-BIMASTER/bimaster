

# Aprimorar API PesquisarLancamentos — Campos Completos Omie

## Resumo

A Edge Function `pesquisar-lancamentos-api` já existe mas está incompleta em relação à spec Omie. Serão adicionados os campos faltantes no `cabecTitulo`, preenchimento real dos `lancamentos` (baixas), campos completos no `resumo` e no `info`, além de filtros adicionais. Endpoints deprecated (`ObterURLBoleto`, `PesquisarExcluidos`) continuam não implementados.

## Campos a adicionar/corrigir

### cabecTitulo — campos faltantes
- `cCPFCNPJCliente`, `nCodCtr`, `cNumCtr`, `nCodOS`, `cNumOS`, `cNumParcela`, `cNSU`, `nCodNF`, `dDtRegistro`, `cNumBoleto` (já existe para R, adicionar para P), `nCodTitRepet`, `dDtCanc`
- Campos tributários: adicionar também para `cNatureza = "P"` (atualmente só para "R")

### lancamentos — preencher com dados reais
- Consultar tabela `pagamentos` (vinculada via `conta_pagar_id` / `conta_receber_id`) para cada título na página
- Mapear para: `nCodLanc`, `cCodIntLanc`, `nIdLancCC`, `dDtLanc`, `nValLanc`, `nMulta`, `nJuros`, `nDesconto`, `nCodCC`, `cNatureza`, `cObsLanc`

### resumo — campos faltantes
- Calcular `nDesconto`, `nJuros`, `nMulta` somando dos lançamentos reais (atualmente hardcoded 0)

### info — campos faltantes
- Adicionar `hInc`, `uInc`, `hAlt`, `uAlt` quando `lDadosCad = true`

### Filtros faltantes no body
- `nCodCtr`, `cNumCtr`, `nCodOS`, `cNumOS` (contrato e ordem de serviço)

## Documentação

Atualizar `docs/API_PESQUISAR_LANCAMENTOS.md` com todos os campos dos tipos complexos (`cabecTitulo` completo, `lancamentos`, `resumo`, `departamentos`, `aCodCateg`, `info`).

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/pesquisar-lancamentos-api/index.ts` | Editar — adicionar campos, buscar lancamentos reais, filtros |
| `docs/API_PESQUISAR_LANCAMENTOS.md` | Editar — documentar tipos complexos completos |

