

## Plano: Collapse/Expand no BriefingView + Briefing no Modo Foco

### 1. BriefingView - Botão Expandir/Recolher

Adicionar um estado `collapsed` com um botão `ChevronDown`/`ChevronRight` no header do `BriefingView`. Quando recolhido, esconde as tabelas de campos e mostra apenas o header (nome do arquivo, data, botões de ação).

**Arquivo**: `src/components/projetos/BriefingView.tsx`
- Importar `useState` e `ChevronDown`/`ChevronRight`
- Adicionar estado `collapsed` (default: `false`)
- Botão toggle no header (antes do nome do arquivo)
- Envolver o bloco `<div className="space-y-3">` das tabelas em condicional `{!collapsed && ...}`

### 2. TarefaFocusMode - Seção de Briefing

Adicionar uma seção de Briefing na coluna esquerda do Modo Foco (após Descrição e antes de Subtarefas), usando o hook `useProjetoBriefing` com o `tarefa.id`. Mostrará o `BriefingView` completo (expandido por padrão) com botão para importar/reimportar.

**Arquivo**: `src/components/projetos/TarefaFocusMode.tsx`
- Importar `useProjetoBriefing`, `BriefingView`, `BriefingImportDialog`, `BriefingToTasksDialog`
- Adicionar estados para dialogs de briefing
- Usar `useProjetoBriefing(tarefa.id)` para buscar o briefing da tarefa
- Inserir seção com header "Briefing" + botão "Importar/Reimportar" + `BriefingView` entre Descrição e Subtarefas (~linha 446)
- Renderizar os dialogs `BriefingImportDialog` e `BriefingToTasksDialog` no final do componente

