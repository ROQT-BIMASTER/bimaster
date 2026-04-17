

## Diagnóstico

Refinamento simples na Matriz 1 (FAIL + MISSING, 20 linhas): adicionar coluna **Severidade (rollup)** como segunda coluna, calculada por max(severidade dos findings) na ordem ALTA > MÉDIA > BAIXA. Sem alterar conteúdo das matrizes — apenas reformatação para permitir triagem por `grep "| ALTA |"`.

## Escopo

### Matriz 1 — novo formato (8 colunas)

| # | **Severidade** | Endpoint | Método | Handler (arquivo:linha) | Findings | Evidência |

Regra de rollup aplicada por linha:
- 1+ finding `[ALTA]` → coluna = `ALTA`
- senão, 1+ finding `[MÉDIA]` → `MÉDIA`
- senão → `BAIXA`

Ordenação: rollup ALTA → MÉDIA → BAIXA (mantém prioridade visual). Dentro de cada bucket, ordem por módulo (CR → CC → Parcelas → CP → Boletos → Export).

### Matriz 2 — EXTRA (sem mudança estrutural)

Mantém formato aprovado no ciclo anterior (Classificação + Risco + Recomendação). A coluna **Risco** já cumpre função de rollup para EXTRA — não duplicar.

### Bloco final

- Contagem por bucket de rollup: `ALTA: NN | MÉDIA: NN | BAIXA: NN` (Matriz 1).
- Comando de triagem: `grep "| ALTA |" relatorio.md` retorna apenas linhas críticas.
- Top 3 fixes prioritários (inalterado).

## Não-escopo

- Re-auditoria dos endpoints (dados já consolidados).
- Mudança na Matriz 2 EXTRA.
- Aplicar correções (read-only).

## Impacto

Triagem ALTA fica grep-friendly em 1 comando. Sem custo de re-execução — só reformatação da matriz já produzida.

