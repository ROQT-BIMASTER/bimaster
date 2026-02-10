

# Revisao e Melhorias - Modulo de Atendimento (Prospects/CRM)

## Problemas Identificados

1. **Central de Demandas sem acesso na sidebar** - A pagina `/dashboard/demandas` existe mas nao tem link no menu lateral, tornando-a inacessivel pela navegacao normal
2. **Lista de Prospects usa dialog antigo** - `ProspectsOptimized.tsx` ainda usa o `ProspectDetailDialog` simples ao inves do novo `ProspectFullModal` com 4 abas
3. **ProspectsModule (landing page) incompleta** - Faltam links para Central de Demandas e Municipios no modulo principal
4. **KanbanColumn nao passa `vendedor` para ProspectCard** - A interface do KanbanColumn nao inclui o campo `vendedor`, fazendo com que o card nao exiba o vendedor responsavel
5. **InternalTicketsPage sem KPIs** - Nao segue o padrao arquitetural de paginas operacionais (sem breadcrumbs, sem metricas no topo)
6. **ProspectFullModal sem botao de editar/salvar dados** - O modal so exibe dados mas nao permite edicao direta dos campos de qualificacao
7. **LeadWhatsAppHistory sem dados mock** - Interface de chat vazia, sem demonstracao visual

## Melhorias Planejadas

### 1. Adicionar Central de Demandas na Sidebar
- Adicionar link "Central de Demandas" no menu de Prospects na sidebar (`AppSidebar.tsx`)
- Garantir navegacao acessivel

### 2. Unificar Modal de Prospect
- Substituir uso do `ProspectDetailDialog` em `ProspectsOptimized.tsx` pelo `ProspectFullModal` com as 4 abas
- Manter consistencia entre Kanban e Lista

### 3. Melhorar ProspectsModule (Landing Page)
- Adicionar cards de acesso rapido para Central de Demandas e Lista de Prospects
- Incluir link para Municipios nos modulos secundarios

### 4. Corrigir interface KanbanColumn
- Atualizar a interface `Prospect` no `KanbanColumn.tsx` para incluir `vendedor`
- Passar dados corretamente para `ProspectCard`

### 5. Melhorar InternalTicketsPage
- Adicionar KPIs no topo (Total, Abertos, Em Andamento, Urgentes)
- Adicionar icone de busca/filtro por texto
- Melhorar layout visual com estilo Linear.app (bordas finas, espacamento)

### 6. Adicionar aba de Edicao no ProspectFullModal
- Incorporar formulario de edicao (campos do ProspectDetailDialog) como funcionalidade dentro da aba "Resumo IA"
- Botao "Editar" que alterna para modo edicao inline

### 7. Inserir dados mock no WhatsApp
- Criar seed de mensagens simuladas na primeira carga quando nao ha mensagens
- Mensagens de texto, audio e imagem para demonstracao

## Detalhes Tecnicos

### Arquivos Modificados

| Arquivo | Alteracao |
|---|---|
| `src/components/dashboard/AppSidebar.tsx` | Adicionar link "Demandas" no menu Prospects |
| `src/pages/ProspectsOptimized.tsx` | Trocar `ProspectDetailDialog` por `ProspectFullModal` |
| `src/pages/modules/ProspectsModule.tsx` | Adicionar cards para Demandas e Municipios |
| `src/components/kanban/KanbanColumn.tsx` | Corrigir interface Prospect com campo `vendedor` |
| `src/pages/InternalTicketsPage.tsx` | Adicionar KPIs, busca textual, melhorar layout |
| `src/components/kanban/LeadResumoIA.tsx` | Adicionar botao de edicao inline dos dados |
| `src/components/kanban/LeadWhatsAppHistory.tsx` | Adicionar dados mock de demonstracao |
| `src/components/kanban/ProspectFullModal.tsx` | Adicionar callback de edicao na aba Resumo |

### Padrao Seguido
- Layout padronizado de paginas operacionais (KPIs + Filtros + Lista)
- Estilo Linear.app (limpo, bordas finas, tipografia precisa)
- Componentes Shadcn/UI + Tailwind + Lucide Icons

