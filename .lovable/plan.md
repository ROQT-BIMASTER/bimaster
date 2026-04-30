## Objetivo

Adicionar, na página **Estoque Unificado — 3 Níveis**, um seletor rápido de **unidade de exibição** que reapresenta toda a tabela e KPIs convertidos para a unidade escolhida, usando os fatores de conversão da BOM já existentes (CX → BX → UN).

## Modos de exibição

Um grupo de 3 botões / toggle (acima da tabela, ao lado de "Apenas com saldo"):

| Modo | O que mostra |
|---|---|
| **Caixas (CX)** | Converte BX e UN existentes em fração de caixa e soma. Mostra "quantas caixas equivalentes" cada produto-raiz tem. |
| **Displays / Box (BX)** | Converte CX → BX (multiplica pelo fator CX→BX) e soma com UN convertidas em fração de BX. |
| **Unidades (UN)** | Equivale ao `saldo_total_em_unidades` que já existe (CX e BX desmontados em UN). |
| **Físico (atual)** | Mantém a visão atual de 3 colunas separadas (CX / BX / UN). É o default. |

## Comportamento na tabela

Quando o modo for **CX**, **BX** ou **UN**:

- As colunas "Caixas / Displays / Unidades / ≡ Total em UN" colapsam em **uma única coluna** chamada conforme o modo (ex.: `Total em CX`, `Total em BX`, `Total em UN`).
- Cada linha continua exibindo o **código do produto-raiz** e a **descrição (nome)** — como já é hoje (`r.raiz_nome` + `Cód. {r.produto_raiz}`).
- Adiciona uma coluna auxiliar `EAN raiz` (código de barras da caixa-mãe) para facilitar identificação, lido de `fabrica_produtos.codigo_barras_ean` quando disponível, ou de `erp_estoque_distribuidora`.
- Mantém `Custo total` e `SKUs`.

No modo **Físico (atual)**, nada muda — fica como está hoje.

## Comportamento nos KPIs

A linha de KPIs (`EstoqueUnificadoKpis`) passa a refletir o modo selecionado:

- **CX**: KPI principal "Total em Caixas" (soma de todas as linhas convertidas).
- **BX**: KPI principal "Total em Displays/Box".
- **UN**: KPI principal "Total em Unidades equivalentes".
- **Físico**: 4 KPIs atuais (CX, BX, UN, Equivalente em UN).

`Custo total` e `produtos-raiz` permanecem em todos os modos.

## Como a conversão é feita

A view `vw_estoque_unificado` já entrega:

- `saldo_em_caixas` (CX físicas)
- `saldo_em_displays` (BX físicos)
- `saldo_em_unidades` (UN físicas)
- `saldo_total_em_unidades` (já é a equivalência total em UN)

Para os outros modos, preciso do **fator CX → UN** e **BX → UN** por produto-raiz, que vem da BOM (`vw_bom_path` / `fabrica_produto_grade_itens`). Plano:

1. Estender `vw_estoque_unificado` para também devolver:
   - `fator_cx_para_un` (quantas UN cabem em 1 CX da raiz)
   - `fator_bx_para_un` (quantas UN cabem em 1 BX intermediário, quando aplicável)
   - `ean_raiz` (código de barras EAN-14 da caixa-mãe)
2. No frontend, calcular por linha:
   - `total_em_cx = saldo_total_em_unidades / fator_cx_para_un`
   - `total_em_bx = saldo_total_em_unidades / fator_bx_para_un`
   - `total_em_un = saldo_total_em_unidades`
   - Quando o fator é nulo (produto sem BOM), exibe "—" em CX/BX e mantém o valor em UN.

A conversão é **somente de exibição** — não altera saldos no ERP nem cria movimentos. É uma "lente" sobre o estoque atual.

## Arquivos afetados

**Backend (1 migration):**
- `supabase/migrations/...` — adiciona colunas `fator_cx_para_un`, `fator_bx_para_un`, `ean_raiz` em `vw_estoque_unificado` (recriação da view com `security_invoker = true`).

**Frontend:**
- `src/hooks/estoque/useEstoqueUnificado.ts` — adiciona os 3 campos no tipo `EstoqueUnificadoRow`.
- `src/pages/estoque/EstoqueUnificadoPage.tsx` — adiciona estado `modoExibicao: 'fisico' | 'cx' | 'bx' | 'un'` e o ToggleGroup.
- `src/components/estoque/unificado/EstoqueUnificadoTable.tsx` — colunas dinâmicas conforme `modoExibicao`; nova coluna `EAN raiz`.
- `src/components/estoque/unificado/EstoqueUnificadoKpis.tsx` — KPIs dinâmicos conforme `modoExibicao`.
- `src/components/erp/ApiDocumentation.tsx` + `src/lib/version.ts` — bump para 3.4.45 e changelog.

## Fora do escopo

- Não altera `TransformacaoWizard` (desmontagem/remontagem real continua igual).
- Não altera o `DriftErpKpi`.
- Não persiste a preferência do modo entre sessões (pode ser feito depois se quiser).

## Pergunta rápida antes de implementar

O modo padrão ao abrir a página deve continuar sendo **Físico (3 colunas)**, ou você prefere que abra direto em **Unidades (UN)** para já ver a "verdade matemática" do estoque? Posso assumir Físico se você não responder.
