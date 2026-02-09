

## Melhorias na Ficha de Custos: Edicao Livre, Registro de Alteracoes e Modulo de Cotacoes de Materia-Prima

### Resumo

Tres grandes blocos de trabalho:

1. **Expandir para todos os insumos** (nao apenas os com apontamento da diretoria) - permitir edicao de valores com registro de alteracao
2. **Registro de alteracoes visivel na submissao** - ao submeter para aprovacao, incluir log das mudancas feitas
3. **Modulo administrativo de cotacoes/orcamentos** - subir orcamentos de fornecedores, comparar precos e escolher a melhor opcao

---

### 1. Linha expandivel para todos os insumos

**Arquivo:** `src/components/fabrica/FichaCustoProdutoEditor.tsx`

Atualmente, apenas insumos com apontamento (`temApontamento`) mostram o chevron de expandir. Vamos:

- Permitir expandir qualquer insumo (chevron sempre visivel ao lado do grip)
- A area expandida mostra:
  - Secao "Solicitacoes da Diretoria" (se houver apontamentos)
  - Secao "Historico de Alteracoes Recentes" - ultimas alteracoes de custo desse insumo (vindas de `fabrica_insumo_custo_historico`)
  - Secao "Cotacoes / Orcamentos" - lista de cotacoes recebidas de fornecedores para essa materia-prima
  - Secao "Evidencias / Arquivos" - upload de NFs, orcamentos, etc.
- Manter a linha vermelha apenas para insumos COM apontamento

### 2. Registro de alteracoes na submissao para aprovacao

**Arquivo:** `src/components/fabrica/FichaCustoProdutoEditor.tsx` e `src/hooks/useFichaRevisao.ts` (se existir)

- Ao clicar "Submeter para Aprovacao", buscar as alteracoes recentes de `fabrica_insumo_custo_historico` para os insumos deste produto
- Incluir no snapshot da revisao um campo `alteracoes_pendentes` com o resumo das mudancas (quais insumos mudaram, valores anteriores/novos, motivos)
- Na tela de revisao da diretoria, exibir essas alteracoes de forma clara

### 3. Modulo de Cotacoes de Materia-Prima

#### 3a. Nova tabela no banco

**Migration SQL:** Criar tabela `fabrica_mp_cotacoes`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | PK |
| produto_custo_id | uuid | FK para fabrica_produto_custos (insumo) |
| produto_id | uuid | FK para fabrica_produtos |
| mp_id | uuid | FK para fabrica_materias_primas (nullable) |
| fornecedor_nome | text | Nome do fornecedor |
| valor_unitario | numeric | Preco cotado |
| condicao_pagamento | text | Ex: "30/60/90 dias" |
| validade | date | Ate quando vale |
| observacoes | text | |
| arquivo_url | text | Link do orcamento em PDF |
| arquivo_nome | text | Nome do arquivo |
| selecionada | boolean | Se essa cotacao foi a escolhida |
| usuario_id | uuid | Quem cadastrou |
| usuario_nome | text | |
| created_at | timestamptz | |

- RLS: usuarios autenticados podem SELECT, INSERT, UPDATE

#### 3b. Novo componente de cotacoes

**Novo arquivo:** `src/components/fabrica/CotacoesInsumoPanel.tsx`

- Exibido dentro da area expandida de cada insumo
- Lista as cotacoes existentes em cards comparativos:
  - Fornecedor, Valor, Condicao, Validade
  - Indicador visual da melhor opcao (menor preco)
  - Badge "Selecionada" para a cotacao escolhida
  - Variacao percentual em relacao ao custo atual do insumo
- Botao "Nova Cotacao" que abre formulario inline ou dialog com:
  - Fornecedor, Valor, Condicao de pagamento, Validade, Observacoes
  - Upload de arquivo (orcamento PDF)
- Botao "Aplicar Cotacao" na cotacao escolhida que atualiza automaticamente o campo de custo do insumo (passando pelo fluxo de justificativa ja existente com motivo "Cotacao aprovada - [Fornecedor]")

#### 3c. Comparativo automatico

- Ao listar cotacoes, destacar em verde a opcao mais barata
- Exibir um resumo tipo:
  - "3 cotacoes recebidas | Menor: R$ 0,0295 (Lukmar) | Maior: R$ 0,0450 (XYZ)"
  - "Economia potencial: R$ 0,0155 por unidade (-34%)"

### Detalhes tecnicos

**Arquivos a criar:**
- `src/components/fabrica/CotacoesInsumoPanel.tsx` - painel de cotacoes dentro da linha expandida

**Arquivos a modificar:**
- `src/components/fabrica/FichaCustoProdutoEditor.tsx` - expandir para todos os insumos, integrar painel de cotacoes e historico recente
- `src/components/fabrica/AlterarCustoDialog.tsx` - adicionar motivo pre-definido "Cotacao aprovada"

**Migration SQL:**
- Tabela `fabrica_mp_cotacoes` com RLS
- Indice em `produto_custo_id` para performance

**Fluxo do usuario:**
1. Abre a ficha de custos de um produto
2. Clica no chevron de um insumo para expandir
3. Ve as cotacoes existentes e pode adicionar novas (upload de PDF de orcamento)
4. Sistema destaca a melhor opcao
5. Clica "Aplicar Cotacao" na opcao escolhida
6. Sistema pede justificativa (pre-preenchida) e atualiza o custo
7. Ao submeter para aprovacao, o historico de alteracoes acompanha a revisao

