

# Filtros em Painel Lateral Esquerdo + Coluna Data de Cadastro

## O que muda

### 1. Layout com painel lateral de filtros (estilo Trade Marketing)
Reorganizar a página `FabricaProdutosAcabados` de layout vertical (filtros em cima, tabela embaixo) para layout horizontal com **painel de filtros à esquerda** e **conteúdo à direita**.

O painel lateral terá:
- Busca por código/nome
- Filtro de marca (select)
- Filtro de tipo (select)
- Filtro de linha (select)
- **Novo: Filtro de data de cadastro** (data início e data fim)
- Toggle de agrupamento
- Toggle de ocultos
- Seletor de visualização (tabela/cards/kanban)
- Botão "Limpar filtros"

O painel será colapsável com um botão para esconder/mostrar em telas menores.

### 2. Coluna "Cadastro" na tabela
Adicionar coluna exibindo `created_at` formatado como `DD/MM/YYYY` entre "Responsável" e "Ações".

### 3. Filtro de data no painel lateral
Dois campos de data (De / Até) que filtram produtos pelo `created_at`. Filtragem local no `produtosFiltrados`.

## Estrutura visual

```text
┌──────────────────────────────────────────────────────┐
│  Header + Botões de ação                             │
├──────────┬───────────────────────────────────────────┤
│ FILTROS  │  KPIs (cards)                             │
│          ├───────────────────────────────────────────┤
│ Busca    │  Tabela / Cards / Kanban                  │
│ Marca    │                                           │
│ Tipo     │                                           │
│ Linha    │                                           │
│ Data De  │                                           │
│ Data Até │                                           │
│ Agrupar  │                                           │
│ Ocultos  │                                           │
│ View     │                                           │
│ [Limpar] │                                           │
└──────────┴───────────────────────────────────────────┘
```

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/pages/FabricaProdutosAcabados.tsx` | Reorganizar layout para flex horizontal com painel lateral de filtros, adicionar estados `dataInicio`/`dataFim`, coluna "Cadastro", filtro de data no `produtosFiltrados` |

## Detalhes técnicos

- Painel lateral: `w-64 shrink-0` com `border-r`, colapsável via estado `filtrosAbertos`
- Filtro de data: inputs `type="date"` simples, filtrando `new Date(p.created_at) >= dataInicio`
- Coluna "Cadastro": `format(new Date(p.created_at), 'dd/MM/yyyy')` usando date-fns
- Em mobile (`< md`): painel oculto por padrão, abre como overlay/drawer
- Sem migration, sem mudança de RLS

