

## Plano: Sistema de Composição de Grade / Display (Kit)

### Contexto

A imagem mostra um card de produto "Bronzer cremoso stick" com uma seção **"Composição de Grade"** listando variantes (Desert Haze, Sunlit Sand, Warm Touch, Sunset Sienna) — cada uma com EAN próprio e código de barras. Isso representa um **Display/Kit**: uma embalagem que agrupa vários produtos acabados (com cores, EANs e quantidades distintas) em uma unidade de venda.

O modelo é análogo à fórmula BOM (matéria-prima → produto acabado), mas no nível acima: **produto acabado → display/kit**.

---

### Estrutura de Dados

**Nova tabela: `fabrica_produto_grade_itens`**

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `produto_pai_id` | uuid FK → fabrica_produtos | O Display/Kit |
| `produto_filho_id` | uuid FK → fabrica_produtos | O produto acabado que compõe o kit |
| `quantidade` | integer | Quantas unidades desse produto no display |
| `ordem` | integer | Ordem de exibição |
| `created_at` | timestamp | |

**Alteração em `fabrica_produtos`**: Adicionar novo tipo `DISPLAY` no fluxo (o select de tipo já aceita strings livres). O campo `itens_display` existente será calculado automaticamente a partir da soma dos itens da grade.

---

### Componentes e Arquivos

#### 1. Migração SQL
- Criar tabela `fabrica_produto_grade_itens` com RLS
- Índices em `produto_pai_id` e `produto_filho_id`

#### 2. `NovoProdutoAcabadoDialog.tsx`
- Adicionar opção `DISPLAY` no select de Tipo de Produto
- Quando tipo = DISPLAY, exibir seção para montar a composição de grade

#### 3. Novo componente: `ComposicaoGradeEditor.tsx`
- Buscador de produtos acabados existentes (autocomplete)
- Lista dos itens selecionados com quantidade, EAN do produto filho, e ação de remover
- Cálculo automático do total de variantes e total de itens
- Drag-and-drop para reordenar (usa @dnd-kit já instalado)

#### 4. Novo componente: `ComposicaoGradeCard.tsx`
- Card visual (como na imagem) para exibir no `ProdutoDetalhesSheet` e no `ProdutoKanbanCard`
- Lista compacta: nome da variante + badge EAN
- Rodapé: "Total de Variantes: X"

#### 5. `ProdutoDetalhesSheet.tsx`
- Quando o produto é tipo DISPLAY, renderizar `ComposicaoGradeCard` na lateral
- Buscar itens de `fabrica_produto_grade_itens` com join nos produtos filhos

#### 6. `ProdutoKanbanCard.tsx`
- Para produtos DISPLAY, exibir mini-indicador de composição (ex: badge "Kit · 6 itens")

#### 7. Custo do Display
- O custo total do Display será calculado como soma dos custos unitários dos produtos filhos × quantidade, mais os insumos próprios do display (embalagem terciária, acessórios)
- Integrar no `useFichaCustoProduto` para displays

---

### Fluxo do Usuário

```text
1. Criar produto tipo DISPLAY (código, nome, EAN do display)
2. Na aba "Composição de Grade", buscar e adicionar produtos acabados
3. Definir quantidade de cada variante no display
4. Salvar → itens_display é calculado automaticamente
5. Na Ficha de Custo, o custo dos filhos aparece como linha de referência
6. No Kanban e no painel de detalhes, a grade é visualizada
```

---

### Arquivos Impactados

| Arquivo | Ação |
|---|---|
| Migração SQL | Nova tabela + RLS + índices |
| `NovoProdutoAcabadoDialog.tsx` | Tipo DISPLAY + aba composição |
| `ComposicaoGradeEditor.tsx` | **Novo** — editor da grade |
| `ComposicaoGradeCard.tsx` | **Novo** — visualização da grade |
| `ProdutoDetalhesSheet.tsx` | Renderizar grade para displays |
| `ProdutoKanbanCard.tsx` | Badge indicador de kit |
| `useFichaCustoProduto.ts` | Considerar custo dos filhos |

