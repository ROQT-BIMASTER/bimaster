
# Plano — Estoque Unificado em 3 Níveis (Caixa Master → Display/Box → Unidade)

## 1. Diagnóstico do que já temos

A partir das duas fontes ERP já sincronizadas:

- **`erp_estoque_distribuidora`** — 9.878 linhas, 3.745 SKUs distintos.
  - **857 SKUs** com prefixo `CX` (caixa master, kit fechado, EAN-14)
  - **946 SKUs** com prefixo `BX` (display / "box", EAN-13)
  - **1.942 SKUs** sem prefixo CX/BX → unidade vendável (EAN-13 do produto final)
- **`erp_composicao_produto`** — 4.574 vínculos pai→filho (`produto_compo` → `materia_compo`, com `quantidade_compo`).
  - **2.593 produtos pai** distintos, **3.571 componentes** distintos.
  - **1.233 produtos** aparecem ao mesmo tempo como pai E como componente — confirma BOM **multi-nível** (CX contém BX, BX contém UN).
  - Componentes são **compartilhados**: existem BX que pertencem a até **15 CX diferentes**, e unidades que pertencem a vários BX. Esse é exatamente o problema descrito.

Conclusão: o ERP já fornece a **estrutura do produto** (BOM) e o **saldo por SKU em cada nível**, mas **não fornece** o histórico de desmontagem/remontagem nem uma visão consolidada equivalente nos 3 níveis. É isso que precisamos construir no Lovable Cloud.

## 2. Conceitos do modelo

Três níveis canônicos, derivados da BOM (não do prefixo do nome — o prefixo é só um indício):

```text
Nível 1: CAIXA MASTER (CX)   ──┐
                                ├─ explode em N DISPLAYS (qtd da BOM)
Nível 2: DISPLAY / BOX (BX) ───┤
                                └─ explode em N UNIDADES (qtd da BOM)
Nível 3: UNIDADE (UN)
```

Definições:
- **Nível** de um SKU = profundidade máxima na BOM (folha = 3, pai-de-folha = 2, raiz = 1). Calculado, não digitado.
- **Fator de explosão acumulado** CX→UN = produto das `quantidade_compo` no caminho. Permite converter qualquer saldo para qualquer nível.
- **Saldo físico** por SKU/empresa = o que vem do ERP (`erp_estoque_distribuidora.saldo`). É a **verdade física**.
- **Saldo equivalente** = projeção matemática do saldo total da empresa em um único nível (ex.: "se eu desmontar tudo, tenho X unidades da cor Y"). É **derivado**, nunca gravado.
- **Lote de desmontagem / remontagem** = transação interna que move saldo de um nível para outro, **sem alterar o ERP**, mas mantendo o caminho exato (pai original → filhos gerados) para permitir o retorno matematicamente exato.

## 3. Os problemas a resolver e como cada um é tratado

| Problema relatado | Solução |
|---|---|
| Mesmo BX está em várias CX | Tabela `bom_edges` modela N:N. Toda desmontagem grava **qual CX de origem** gerou aquele BX (chave do lote), evitando ambiguidade na remontagem. |
| Mesma UN está em vários BX | Idem: a remontagem só pode consumir UNs que foram geradas por aquele BX (FIFO sobre saldos rotulados por lote). Se não houver lote, exige confirmação manual e gera evento de auditoria. |
| Visão única de estoque | View `vw_estoque_unificado` que apresenta o mesmo saldo físico em **três colunas equivalentes** (em CX, em BX, em UN) por empresa/produto-raiz. |
| Explosão 1→muitos sem perder rastro | Tabela `estoque_desmontagem` (cabeçalho) + `estoque_desmontagem_itens` (filhos gerados) — espelha uma "nota" interna. |
| Remontagem muitos→1 sem quebrar a matemática | Tabela `estoque_remontagem` referencia o **lote de desmontagem original** quando possível; quando não, valida que a soma das quantidades respeita exatamente a BOM antes de aceitar. |
| Saldo virtual ≠ saldo ERP | Mantemos `saldo_erp` (espelho) + `saldo_ajuste_interno` (delta de desmontagens locais). O **saldo efetivo** = soma dos dois, e o "drift" vs ERP fica visível em um KPI. |

## 4. Modelo de dados proposto (Lovable Cloud)

Todas as tabelas em `public`, com RLS por `user_empresas` (mesmo padrão do estoque/composição já em uso).

1. **`estoque_produto_nivel`** (cache materializado, 1 linha por SKU)
   - `cod_produto`, `nivel` (1/2/3), `produto_raiz` (CX-âncora quando existe), `eh_folha`, `eh_raiz`.
   - Recalculada após cada sync de `erp_composicao_produto`.

2. **`bom_edges`** (espelho normalizado da composição)
   - `pai_cod`, `filho_cod`, `quantidade`, `empresa`, origem `erp` ou `manual`.
   - Permite consultas recursivas eficientes (CTE) e edição manual de exceções.

3. **`estoque_lote`** (rótulo de rastreio)
   - `id`, `empresa`, `cod_produto`, `quantidade`, `origem` (`erp`, `desmontagem`, `remontagem`, `ajuste`), `lote_pai_id` (nullable), `desmontagem_id` (nullable), `created_at`, `criado_por`.
   - Sempre que uma CX é desmontada em N BX, **N lotes-filhos** são criados apontando para o lote-pai e para o cabeçalho da desmontagem.

4. **`estoque_desmontagem`** (cabeçalho)
   - `id`, `empresa`, `cod_produto_origem`, `quantidade_origem`, `nivel_destino` (2 ou 3), `executado_em`, `executado_por`, `observacao`, `status` (`rascunho`, `confirmada`, `revertida`).

5. **`estoque_desmontagem_itens`** (filhos gerados)
   - `desmontagem_id`, `cod_produto_filho`, `quantidade_gerada`, `lote_id`.

6. **`estoque_remontagem`** + **`estoque_remontagem_itens`** (espelho da desmontagem, sentido inverso)
   - Referencia `desmontagem_origem_id` quando o usuário escolhe remontar a partir de um lote conhecido.
   - Quando não há lote (remontagem "livre"), só pode confirmar se as quantidades baterem com a BOM e exige justificativa.

7. **Views** (com `security_invoker = true`):
   - `vw_bom_path` — CTE recursiva: para cada folha, lista o caminho completo até a raiz e o **fator acumulado**.
   - `vw_estoque_unificado` — por (empresa, produto_raiz):
     - `saldo_em_caixa`, `saldo_em_display`, `saldo_em_unidade` (cada um já convertido pelo fator).
     - `composicao_atual` (quanto está realmente em cada nível físico hoje).
     - `drift_vs_erp` (quanto o saldo interno divergiu do ERP).
   - `vw_capacidade_montagem` — dado o saldo atual de UN/BX, quantas CX poderiam ser remontadas (limitado pelo componente mais escasso, igual à `vw_composicao_capacidade_producao` que já existe — vamos generalizar).

## 5. Regras matemáticas (invariantes que o sistema deve garantir)

Para qualquer empresa e qualquer produto-raiz `R`:

```text
saldo_total_em_unidades(R) =
    saldo_un(R) 
  + Σ ( saldo_bx(b) × fator(b → un) )
  + Σ ( saldo_cx(c) × fator(c → un) )
```

E essa soma **não pode mudar** ao executar uma desmontagem ou remontagem interna — só muda com sync do ERP (entrada/saída real). Esta é a invariante que protege a "matemática exata" pedida.

Validações no momento da confirmação:
- Desmontagem: `quantidade_origem × BOM = Σ quantidades_geradas` (igualdade exata, sem arredondamento implícito).
- Remontagem com lote: só consome dos lotes-filhos daquele lote-pai; FIFO para empate.
- Remontagem livre: exige que `Σ filhos / BOM` resulte em inteiro, senão recusa.

## 6. Funcionalidades de tela (frontend)

Nova rota **`/dashboard/estoque/unificado`** com três abas:

1. **Visão Unificada** — tabela por produto-raiz, três colunas (CX / BX / UN) mostrando saldo físico e equivalente; drill-down abre o caminho completo da BOM e a composição real atual.
2. **Desmontar / Remontar** — wizard:
   - escolhe SKU origem e quantidade,
   - sistema mostra preview do que será gerado conforme a BOM,
   - confirma e grava lote + movimento;
   - no caminho inverso, lista os lotes elegíveis para remontagem com `desmontagem_origem` em destaque.
3. **Auditoria & Drift** — log de toda desmontagem/remontagem, divergência vs ERP, e botão de "reconciliar" (zera ajuste interno aceitando o ERP como verdade).

Reutilizar padrões já existentes (`EstoqueTable`, `EstoqueDetailDrawer`, `EstoqueKpiBar`, formatadores) — sem reinventar UI.

## 7. Entregas em fases

1. **Fase 1 — Modelagem & cache** (migração)
   - Criar `bom_edges`, `estoque_produto_nivel`, views `vw_bom_path` e `vw_estoque_unificado`.
   - Função SQL `recalcular_estoque_niveis()` chamada após cada sync de composição.
2. **Fase 2 — Tela de Visão Unificada** (read-only)
   - Hook `useEstoqueUnificado`, página `/dashboard/estoque/unificado`, KPIs e drill-down.
3. **Fase 3 — Lotes & Desmontagem**
   - Tabelas `estoque_lote`, `estoque_desmontagem(_itens)`, RPC `executar_desmontagem(...)` com a invariante validada.
   - Wizard no frontend.
4. **Fase 4 — Remontagem rastreada**
   - Tabelas `estoque_remontagem(_itens)`, RPC `executar_remontagem(...)` com modos "por lote" e "livre".
   - Histórico bidirecional na auditoria.
5. **Fase 5 — Reconciliação ERP**
   - KPI de drift, fluxo de aceite/recusa quando o sync do ERP traz números que conflitam com ajustes internos.

## 8. Pontos a confirmar antes de codar

1. **Empresa**: a BOM é a mesma para todas as empresas, ou uma CX pode ter composição diferente por empresa? (a tabela `erp_composicao_produto.empresa_compo` sugere que sim — preciso confirmar se tratamos como global com override por empresa).
2. **Identificação dos níveis**: o ERP marca o nível em algum campo, ou inferimos 100% pela BOM (folha = UN, raiz = CX)? Hoje os prefixos `CX`/`BX` no nome ajudam mas não cobrem 1.942 SKUs.
3. **Reversão da desmontagem**: quando o usuário desmonta uma CX e depois quer "desfazer" sem ter remontado fisicamente, isso é permitido (revert) ou só por meio de remontagem normal?
4. **Sincronização com o ERP**: quando o ERP traz um saldo novo, ele substitui o saldo interno (autoritativo) ou apenas acrescenta o delta? Isso muda toda a lógica de "drift".

Posso aprofundar qualquer fase ou ajustar o modelo conforme as respostas acima.
