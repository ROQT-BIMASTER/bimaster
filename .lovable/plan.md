

# Minhas Tarefas — Painel Completo como o Projeto

## Problema

Ao clicar em uma tarefa em "Minhas Tarefas", abre um Sheet simplificado (`MinhasTarefaDetail`, 242 linhas) com apenas: titulo, status, prioridade, prazo, observacoes, anexos e chat. No painel do projeto (`ProjetoTarefaDetalhe`, 1272 linhas) existem funcionalidades completas que o usuario espera ter:

| Funcionalidade | Projeto | Minhas Tarefas |
|---|---|---|
| Subtarefas + criar subtarefa | Sim | Nao |
| Checklist (metas) | Sim | Nao |
| Comentarios com menções | Sim | Nao |
| Timeline de atividades | Sim | Nao |
| Dependencias entre tarefas | Sim | Nao |
| Vincular produto acabado | Sim | Nao |
| Enviar para cofre | Sim | Nao |
| Workflow de aprovacao | Sim | Nao |
| Focus Mode (tela cheia) | Sim | Nao |
| IA (sugerir subtarefas) | Sim | Nao |
| Mover entre secoes | Sim | Nao |
| Briefing | Sim | Nao |
| Link para China/Modulos | Sim | Nao |

## Solucao

Reutilizar o `ProjetoTarefaDetalhe` diretamente em Minhas Tarefas, em vez de manter um componente separado empobrecido. Isso requer:

1. **Adaptar `ProjetoTarefaDetalhe`** para funcionar sem `useParams` (projeto ID vem da tarefa, nao da URL)
2. **Buscar dados do projeto** (secoes, tipo) a partir do `projeto_id` da tarefa selecionada
3. **Prover callbacks** (`onUpdate`, `onToggle`, `onAddSubtarefa`, `onMoveTarefa`) que funcionem no contexto de Minhas Tarefas
4. **Substituir `MinhasTarefaDetail`** pelo `ProjetoTarefaDetalhe` na pagina

### Detalhes tecnicos

**1. Tornar `ProjetoTarefaDetalhe` independente da rota**

Atualmente usa `useParams<{ id: string }>()` para obter `projetoId`. Adicionar prop opcional `projetoIdOverride` que, quando presente, prevalece sobre `useParams`. Isso permite uso fora da rota `/projetos/:id`.

**2. Bridge hook em `MinhasTarefas`**

Criar um pequeno hook/wrapper que, ao selecionar uma tarefa:
- Busca as secoes do projeto (`projeto_secoes`)
- Converte `MinaTarefa` para `ProjetoTarefa` (adicionar campos faltantes: `descricao`, `ordem`, `parent_id`, `responsavel_id`, etc.)
- Fornece `onUpdate` que faz update direto + invalidate `minhas-tarefas`
- Fornece `onToggle` que alterna status
- Fornece `onAddSubtarefa` via insert direto

**3. Substituir na pagina**

Em `MinhasTarefas.tsx`, trocar `<MinhasTarefaDetail>` por `<ProjetoTarefaDetalhe>` com as props do bridge.

**4. Navegacao rapida para secao/projeto**

O `ProjetoTarefaDetalhe` ja tem botao "Abrir no projeto" que navega para `/dashboard/projetos/:id`. Isso ja resolve o pedido de "abrir o projeto" a partir de Minhas Tarefas.

### Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/components/projetos/ProjetoTarefaDetalhe.tsx` | Adicionar prop `projetoIdOverride?` e usar no lugar de `useParams` quando presente |
| `src/pages/MinhasTarefas.tsx` | Substituir `MinhasTarefaDetail` por `ProjetoTarefaDetalhe` com bridge de dados |
| `src/hooks/useMinhasTarefas.ts` | Expandir query para trazer campos extras (`descricao`, `ordem`, `parent_id`, `responsavel_id`) |

### Impacto

- Usuario passa a ter a mesma experiencia completa do painel de projeto ao clicar em qualquer tarefa em Minhas Tarefas
- Subtarefas, checklist, comentarios, anexos, chat, IA, focus mode — tudo disponivel
- Zero duplicacao de codigo — um unico componente de detalhe
- `MinhasTarefaDetail`, `MinhasTarefaAnexos`, `MinhasTarefaChat` e `useMinhasTarefaDetalhe` podem ser removidos (codigo morto)

