## O que está acontecendo (verificado no código)

- **Lista de produtos (R$ 5,51)**: `src/pages/FabricaProdutosAcabados.tsx` monta o custo a partir do `snapshot_totais` da **última revisão aprovada** (via `custoTotalDoSnapshot`). Esse snapshot é congelado no momento da aprovação.
- **Ficha (R$ 6,0563)**: `FichaCustoProdutoEditor` recalcula ao vivo a partir das linhas atuais de `fabrica_produto_custos`.
- **Por que salvou sem você mandar**: em `useFichaCustoProduto.atualizarInsumo`, cada campo de insumo faz `UPDATE` direto no banco a cada edição — **não existe trava por status**. Só os campos de configuração (linhas 980/1017) respeitam `isLocked`.
- **Por que sumiram os botões**: em `FichaCustoProdutoEditor` (linha 181) `isLocked = status "em_revisao" || "aprovada"`, o que esconde "Salvar Ficha"; e o botão de submeter só aparece em `rascunho` ou `revisao_solicitada`. Numa ficha **aprovada** não sobra nenhuma ação — mas os insumos continuam editáveis e gravando.

Resultado: a ficha aprovada foi alterada silenciosamente e a lista continua mostrando o valor congelado da aprovação. Os dois números estão "certos" para fontes diferentes, e não há caminho para reconciliar.

## Correção proposta

### 1. Travar de verdade a ficha aprovada / em revisão
- Em `useFichaCustoProduto`, bloquear escrita quando o status for `aprovada` ou `em_revisao`: `atualizarInsumo`, `adicionarInsumo`, `removerInsumo`, `atualizarConfig` e reordenação retornam com aviso ("Ficha aprovada — abra uma nova revisão para editar").
- Em `FichaCustoProdutoEditor`, aplicar `disabled={isLocked}` também nos inputs de insumo (NF, Serviço, Condição, nome, fornecedor, tipo, NF ref.) e esconder os botões de adicionar/excluir/importar quando travada.

### 2. Ação "Abrir nova revisão" na ficha aprovada
- Novo botão visível quando `statusAprovacao === "aprovada"`: muda `fabrica_produto_custos_config.status_aprovacao` para `rascunho`, destrava a edição e mantém a revisão aprovada anterior intacta no histórico (nada é sobrescrito).
- Depois de editar, o fluxo normal "Submeter para Aprovação" gera a nova versão de revisão — que é o que atualiza o custo exibido na lista.

### 3. Sinalizar divergência (evita repetir o susto)
- Na ficha: quando o custo calculado ao vivo diferir do `custoTotal` do último snapshot aprovado, mostrar aviso "Custo atual difere da última versão aprovada (R$ X) — submeta para aprovação".
- Na lista de produtos: badge discreta de "custo desatualizado" no mesmo caso.

### 4. Reconciliar este produto (RR-B5014)
Como a ficha já foi editada fora do fluxo, ao aplicar a correção o produto ficará em `rascunho` com os valores novos (R$ 6,0563) e o botão "Submeter para Aprovação" disponível — a lista só passa a exibir R$ 6,0563 após a nova aprovação. Nenhum dado é perdido.

## Detalhes técnicos

Arquivos: `src/hooks/useFichaCustoProduto.ts` (guarda de escrita por status), `src/hooks/useFichaRevisao.ts` (mutation `abrirNovaRevisao` + expor último snapshot aprovado), `src/components/fabrica/FichaCustoProdutoEditor.tsx` (disabled nos inputs, botão "Abrir nova revisão", banner de divergência), `src/pages/FabricaProdutosAcabados.tsx` (badge de divergência), `src/lib/version.ts` + changelog em `src/pages/admin/ApiDocumentation.tsx`.

Sem migração de banco: o campo `status_aprovacao` já existe e as revisões já são versionadas.
