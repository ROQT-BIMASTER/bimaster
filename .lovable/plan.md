# Corrigir contagem do filtro "Em Revisão"

## Diagnóstico

Conferi no banco: existem **7 produtos** com status em revisão. Destes:

- 6 são nacionais → entram no `produtos` da tela (KPI mostra 6 corretamente)
- 1 é importado (`HB-C7100/1-8 (PROVADOR)`) → excluído pelo filtro `origem.neq.importado` da query principal (essa tela é só para nacionais; importados têm tela própria). Comportamento correto.

Dos 6 nacionais, **5 aparecem na lista filtrada** e **1 some** (`RR B5006`).

Causa: `RR B5006` tem `status_aprovacao = 'revisao_solicitada'`, enquanto os outros têm `'em_revisao'`. O **KPI** e o **banner** já agrupam os dois status na mesma família âmbar (count = 6). Mas o **filtro** em `produtosFiltrados` faz comparação exata (`statusFichaProduto === filtroStatusFicha`), então só pega `'em_revisao'` (5 itens) — `'revisao_solicitada'` é descartado.

Resultado: usuário vê KPI=6 mas só 5 linhas → "um dos produtos não aparece".

## Correção

Em `src/pages/FabricaProdutosAcabados.tsx`, dentro do `produtosFiltrados`, ajustar a regra de `matchStatusFicha`:

- Quando `filtroStatusFicha === "em_revisao"`, aceitar tanto `"em_revisao"` quanto `"revisao_solicitada"` (igualar ao critério já usado no KPI e no banner).
- Manter `"revisao_solicitada"` como opção independente do select, caso o usuário queira isolar só esses.

Isso faz a lista ficar consistente com o KPI/banner (6 = 6).

## Arquivos

- `src/pages/FabricaProdutosAcabados.tsx` — apenas a regra do `matchStatusFicha` (5 linhas).
