

## Plano: Importação automática de custos dos filhos (Display/Kit) + Manual

### Resumo

Para produtos do tipo **DISPLAY**, oferecer um botão "Importar Custos dos Produtos" na Ficha de Custos que puxa automaticamente o custo total de cada produto filho (da grade), exibindo como linhas somente-leitura agrupadas. O modo manual atual permanece como padrão — a importação é uma **ação opcional** via botão.

Além disso, atualizar o manual contextual da tela com orientações específicas para Displays/Kits.

---

### 1. Hook — buscar custos dos filhos

**Arquivo:** `src/hooks/useFichaCustoProduto.ts`

- Criar função `carregarCustosFilhos()` que, quando `produto.tipo === 'DISPLAY'`:
  1. Busca itens da grade em `fabrica_produto_grade_itens` (com `produto_id = produtoId`)
  2. Para cada `produto_item_id`, busca o custo total consolidado via `fabrica_produto_custos` + `fabrica_produto_custos_config`
  3. Calcula: custo unitário total × quantidade da grade
- Expor `custosFilhos[]` e `importarCustosFilhos()` no retorno do hook
- `importarCustosFilhos()` insere os custos como insumos na tabela `fabrica_produto_custos` com um campo indicador (tipo_insumo = `"importado_filho"` ou marcador no nome)

### 2. UI — Botão de importação no Editor

**Arquivo:** `src/components/fabrica/FichaCustoProdutoEditor.tsx`

- Quando `produto.tipo === 'DISPLAY'`, exibir acima da tabela de insumos:
  - Botão "📥 Importar Custos dos Produtos do Kit" 
  - Ao clicar, abre Dialog de confirmação listando os produtos filhos com seus custos unitários e quantidades
  - Após confirmar, insere linhas na tabela de insumos (editáveis, como qualquer outro insumo)
  - Badge "Importado de [Produto X]" nas linhas importadas para rastreabilidade
- Também adicionar o `DisplayGradePopover` no header (conforme plano anterior aprovado)

### 3. Manual contextual atualizado

**Arquivo:** `src/components/fabrica/ManualFabricaDrawer.tsx`

- Adicionar nova seção no conteúdo de `"ficha-custos"`:
  - **"Ficha de Custos para Displays/Kits"** com orientações:
    - Opção 1: Digitar insumos manualmente (como produto normal)
    - Opção 2: Usar "Importar Custos dos Produtos" para puxar automaticamente os custos dos produtos filhos já cadastrados
    - Explicar que os custos importados ficam editáveis
    - Orientar a adicionar insumos extras do kit (embalagem terciária, acessórios, etc.)
    - Lembrar de configurar M.O. e Markup específicos do kit

### 4. Tipos de insumo

**Arquivo:** `src/hooks/useFichaCustoProduto.ts`

- Adicionar ao array `TIPOS_INSUMO`: `{ value: "importado_kit", label: "Produto do Kit" }`

---

### Fluxo do usuário

1. Abre Ficha de Custos de um Display
2. Vê botão "Importar Custos dos Produtos do Kit" (se a grade tiver itens)
3. Clica → Dialog mostra lista dos filhos com custo unitário e qtd
4. Confirma → Linhas são inseridas com badge "Produto do Kit"
5. Pode editar valores, adicionar insumos extras, configurar M.O./Markup
6. Consulta o manual (📘) para orientações específicas de Display

