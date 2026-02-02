
# Plano: Ficha de Custos Simplificada no Produto Acabado

## Objetivo

Permitir que o usuário preencha uma ficha de custos **diretamente no produto acabado**, adicionando matérias-primas e seus custos detalhados (NF, Serviço, Condição) sem precisar criar uma fórmula. Isso atende usuários que querem apenas controlar custos, sem usar o módulo completo de BOM.

---

## Como Funciona

```text
FLUXO SIMPLIFICADO:

1. Usuário seleciona um Produto Acabado
2. Adiciona Matérias-Primas manualmente (busca no cadastro)
3. Preenche para cada MP: NF, Serviço, Condição, NF Ref
4. Preenche Mão de Obra e Markup
5. Sistema calcula custo total automaticamente
```

---

## Modelo de Dados

### Nova Tabela: `fabrica_produto_custos`

Armazena os insumos/MPs vinculados ao produto acabado para cálculo de custo.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária |
| produto_id | UUID | FK para fabrica_produtos |
| mp_id | UUID | FK para fabrica_materias_primas (nullable) |
| codigo | TEXT | Código do insumo (pode ser manual) |
| nome | TEXT | Nome do insumo |
| fornecedor | TEXT | Nome do fornecedor |
| tipo_insumo | TEXT | bulk, embalagem_primaria, etc. |
| custo_nf | NUMERIC | Custo NF |
| custo_servico | NUMERIC | Custo Serviço |
| custo_condicao | NUMERIC | Custo Condição |
| nf_referencia | TEXT | Número da NF de referência |
| ordem | INTEGER | Ordem de exibição |

### Nova Tabela: `fabrica_produto_custos_config`

Armazena configuração de M.O. e markup por produto.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária |
| produto_id | UUID | FK para fabrica_produtos (UNIQUE) |
| fornecedor_mao_obra | TEXT | Fornecedor da M.O. |
| custo_mao_obra_nf | NUMERIC | M.O. coluna NF |
| custo_mao_obra_servico | NUMERIC | M.O. coluna Serviço |
| percentual_markup | NUMERIC | % markup (default 10) |
| observacoes | TEXT | Observações gerais |

---

## Layout da Interface

### Tela: FichaCustoProdutoPage

Acessível via botão "Ficha de Custos" na listagem de produtos ou no dialog de edição.

```text
+------------------------------------------------------------------+
|  [<- Voltar] FICHA DE CUSTOS - [NOME DO PRODUTO]                 |
|  Código: PA-001 | Origem: Nacional                               |
+------------------------------------------------------------------+
|                                                                  |
|  CONFIGURAÇÃO                                                    |
|  +-------------+  +-------------+  +--------------+  +----------+|
|  | Forn. M.O.  |  | M.O. NF     |  | M.O. Serviço |  | Markup % ||
|  | [Rodrigues] |  | [0,050]     |  | [0,850]      |  | [10]     ||
|  +-------------+  +-------------+  +--------------+  +----------+|
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  INSUMOS                                              [+ Adicionar|
|  +---------------------------------------------------------------+|
|  | Código | Insumo      | Fornecedor | Tipo      | NF     | Serv | Cond  | NF Ref  | X |
|  |--------|-------------|------------|-----------|--------|------|-------|---------|---|
|  | 22904  | Bulk        | Rodrigues  | Bulk      | 0,188  | 0,188|       |         | x |
|  | 22983  | Frasco      | Kilimplast | Emb.Prim  | 0,091  |      | 0,270 | NF34956 | x |
|  | 22984  | Tampa       | Kilimplast | Emb.Prim  | 0,296  |      | 0,890 | NF34956 | x |
|  | 22985  | Batoque     | Kilimplast | Emb.Prim  | 0,037  |      | 0,110 | NF34956 | x |
|  +---------------------------------------------------------------+|
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  +----+ Markup 10%  | NF: 0,XX | Serv: 0,XX | Cond: 0,XX |       |
|                                                                  |
|  TOTAIS                                                          |
|  +---------+  +---------+  +---------+  +------------------+     |
|  | NF      |  | Serviço |  | Condição|  | CUSTO TOTAL      |     |
|  | R$ 0,75 |  | R$ 1,31 |  | R$ 1,70 |  | R$ 3,77          |     |
|  +---------+  +---------+  +---------+  +------------------+     |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Exportar PDF]                              [Salvar Ficha]      |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Estrutura de Arquivos

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| Página | `src/pages/FichaCustoProduto.tsx` | Tela principal da ficha |
| Componente | `src/components/fabrica/FichaCustoProdutoEditor.tsx` | Editor da ficha de custos |
| Componente | `src/components/fabrica/AdicionarInsumoCustoDialog.tsx` | Dialog para adicionar MP |
| Hook | `src/hooks/useFichaCustoProduto.ts` | Lógica de dados e cálculos |

---

## Funcionalidades

### 1. Adicionar Insumo
- Buscar em matérias-primas cadastradas (combobox com pesquisa)
- Ou inserir manualmente (código, nome, fornecedor)
- Pré-preencher custo se MP tiver custo_unitario

### 2. Edição Inline
- Todos os campos editáveis diretamente na tabela
- Tipo de insumo via dropdown
- Valores numéricos com 6 casas decimais

### 3. Cálculo Automático
- Linha de M.O. sempre no topo
- Soma NF + Serviço + Condição de cada linha
- Aplica markup sobre subtotal
- Custo total = (Soma todos) + Markup

### 4. Ordenação
- Drag-and-drop para reordenar insumos
- Ou botões sobe/desce

### 5. Exportar PDF
- Usa mesmo formato do PDF existente (FichaCustoPDF)
- Adaptar para receber dados da nova estrutura

### 6. Atualizar Custo do Produto
- Opção de atualizar campo `custo_unitario` do produto com o total calculado (se existir esse campo, ou adicionar)

---

## Integração com Sistema Atual

### O que NÃO muda
- Fórmulas continuam funcionando normalmente
- Ficha de Custos nas fórmulas permanece igual
- Produtos podem ter fórmula E ficha simplificada (usuário escolhe)

### O que é NOVO
- Botão "Ficha de Custos" na listagem de produtos
- Rota dedicada: `/dashboard/fabrica/produtos/:id/custos`
- Produtos sem fórmula agora podem ter custos detalhados

---

## Acesso

### Rota
- `/dashboard/fabrica/produtos/:id/custos`

### Botão na Listagem
Na tabela de produtos acabados, adicionar botão:
```text
[Editar] [Custos] [Excluir]
```

### Badge Visual
Se produto tem ficha de custos preenchida:
```text
[Custo: R$ 3,77]
```

---

## Resumo de Entregas

1. **Migração SQL**: Criar tabelas `fabrica_produto_custos` e `fabrica_produto_custos_config`
2. **Hook**: `useFichaCustoProduto.ts` com lógica de CRUD e cálculos
3. **Página**: `FichaCustoProduto.tsx` com layout completo
4. **Componentes**: Editor inline + Dialog para adicionar insumos
5. **Modificar**: `FabricaProdutosAcabados.tsx` para adicionar botão "Custos"
6. **Rota**: Registrar em App.tsx
7. **PDF**: Adaptar exportação para nova estrutura
