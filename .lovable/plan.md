

## Melhorias na Tela de Produtos Acabados e Ficha de Custos

### Resumo das 4 demandas

1. **Linha vermelha** para produtos com status "Revisao Solicitada" na listagem principal
2. **Destacar materia-prima** com apontamento dentro da ficha de custos (linha vermelha no insumo)
3. **Exibir custo total** na tabela principal de produtos acabados
4. **Historico de alteracoes de precos** de materias-primas com comparativo, log e exigencia de novo lancamento para eventos futuros

---

### 1. Linha vermelha na listagem principal

**Arquivo:** `src/pages/FabricaProdutosAcabados.tsx`

- No `renderProdutoRow`, verificar se `fichasMap.get(produto.id) === "revisao_solicitada"`
- Se sim, aplicar classe `bg-red-50 dark:bg-red-950/20` no `TableRow`

### 2. Destacar insumos com apontamento na Ficha de Custos

**Arquivo:** `src/components/fabrica/FichaCustoProdutoEditor.tsx`

- Os apontamentos ja sao passados como prop (`apontamentos: RevisaoItem[]`)
- Na tabela de insumos, verificar se existe algum `apontamento` cujo `insumo_id` corresponde ao insumo da linha
- Se sim, aplicar `bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500` no `TableRow`
- Exibir tooltip ou icone de alerta indicando qual campo foi apontado e o valor sugerido

### 3. Custo total na tabela principal

**Arquivo:** `src/pages/FabricaProdutosAcabados.tsx`

- Alterar a query de `fichasConfig` para tambem buscar os campos de custos ou usar os snapshots de revisoes
- Opcao mais simples: buscar da `fabrica_produto_custos_config` os dados necessarios para calcular o custo total, ou buscar o `snapshot_totais` da ultima revisao aprovada
- Alternativa pratica: criar uma query separada que calcula o custo total por produto somando `fabrica_produto_custos` (NF + servico + condicao) + config de markup
- Adicionar coluna "Custo Total" na tabela com o valor formatado em R$

**Abordagem escolhida:** Buscar os totais a partir do snapshot da ultima revisao (ja contem `custoTotal` calculado) para produtos que tem ficha. Isso garante que o valor exibido e o mesmo da ficha aprovada/submetida.

### 4. Historico de alteracoes de precos de materias-primas

Esta e a funcionalidade mais complexa. Sera dividida em:

#### 4a. Nova tabela de log de alteracoes de custo de insumos

**Migration SQL:**
- Criar tabela `fabrica_insumo_custo_historico` com:
  - `id`, `produto_custo_id` (FK para fabrica_produto_custos), `produto_id`, `mp_id`
  - `campo` (custo_nf, custo_servico, custo_condicao)
  - `valor_anterior`, `valor_novo`
  - `motivo` (text)
  - `usuario_id`, `usuario_nome`
  - `created_at`
- RLS: usuarios autenticados podem SELECT e INSERT (append-only)
- Trigger na tabela `fabrica_produto_custos` para registrar automaticamente alteracoes nos campos de custo

#### 4b. Exigir novo lancamento para alteracoes

**Arquivo:** `src/hooks/useFichaCustoProduto.ts`

- Modificar `atualizarInsumo` para que, quando o campo alterado for `custo_nf`, `custo_servico` ou `custo_condicao`, abrir um fluxo de confirmacao com motivo obrigatorio
- Registrar o historico automaticamente via trigger no banco

**Arquivo:** `src/components/fabrica/FichaCustoProdutoEditor.tsx`

- Ao alterar um campo de custo, exibir um dialog pedindo justificativa/motivo da alteracao
- Campos como "Reajuste de fornecedor", "Nova negociacao", etc.

#### 4c. Comparativo de custos

**Novo componente:** `src/components/fabrica/HistoricoCustosInsumoDialog.tsx`

- Dialog que mostra o historico de todas as alteracoes de custo de um insumo especifico
- Tabela com: Data, Campo, Valor Anterior, Valor Novo, Variacao (%), Usuario, Motivo
- Indicador visual de aumento (vermelho) ou reducao (verde)

#### 4d. Alerta de aumento em produto ja cadastrado

- Ao registrar uma alteracao de custo, comparar com o valor anterior
- Se houve aumento, exibir um alerta/badge na listagem de produtos acabados
- Badge "Custo Aumentou" com icone de seta para cima

#### 4e. Botao de historico na tabela de insumos

**Arquivo:** `src/components/fabrica/FichaCustoProdutoEditor.tsx`

- Adicionar um icone de "historico" (relogio) ao lado de cada insumo na tabela
- Ao clicar, abre o `HistoricoCustosInsumoDialog` com todas as alteracoes daquele insumo

---

### Detalhes tecnicos

**Arquivos a criar:**
- `src/components/fabrica/HistoricoCustosInsumoDialog.tsx` - Dialog de historico por insumo
- `src/components/fabrica/AlterarCustoDialog.tsx` - Dialog para justificar alteracao de custo

**Arquivos a modificar:**
- `src/pages/FabricaProdutosAcabados.tsx` - Linha vermelha + coluna custo total
- `src/components/fabrica/FichaCustoProdutoEditor.tsx` - Linha vermelha no insumo + botao historico + fluxo de alteracao com justificativa
- `src/hooks/useFichaCustoProduto.ts` - Logica de registro de alteracao com motivo

**Migration SQL:**
- Tabela `fabrica_insumo_custo_historico`
- Trigger para log automatico de alteracoes de custo
- Politicas RLS (append-only para usuarios autenticados)

