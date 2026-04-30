## Objetivo

Padronizar a exibição de **responsável** (e, quando aplicável, **colaboradores/relacionados**) em todas as listas/rows de tarefa do sistema. Hoje só a Central de Trabalho (Tarefas) mostra o avatar; widgets, "Para focar agora", Inbox, Mission Control de Marketing, Lead Subtarefas, Evidências de Etapa, etc. ainda não trazem essa informação visual.

## Mapeamento das superfícies de tarefa

Lista de telas/componentes onde aparecem rows de tarefa e o status atual:

| Superfície | Componente | Mostra responsável hoje? |
|---|---|---|
| Central → Hoje ("Para focar agora") | `central/HojeTab.tsx` | Não |
| Central → Tarefas | `central/MinhasTarefasContent.tsx` | Sim (acabamos de adicionar) |
| Central → Delegadas | `central/DelegadasContent.tsx` | Sim |
| Central → Inbox | `central/ProjetoInboxContent.tsx` | Verificar |
| Central → Resumo Semanal | `central/ResumoSemanal.tsx` | Verificar |
| Minhas Tarefas → Widget "Próximas" | `minhas-tarefas/widgets/WidgetListaProximas.tsx` | Não |
| Minhas Tarefas → Widget "Atrasadas" | `minhas-tarefas/widgets/WidgetListaAtrasadas.tsx` | Não |
| Minhas Tarefas → Board / Calendar / KPIs | vários em `minhas-tarefas/` | Verificar |
| Projeto → Lista de Tarefas (row principal) | `projetos/ProjetoTarefaRow.tsx` | Sim (avatar + seguidores) — padrão de referência |
| Projeto → Equipe Dashboard | `projetos/ProjetoEquipeDashboard.tsx` | Sim |
| Projeto Home → Quick Actions / KPIs | `projetos/home/*` | Verificar |
| Marketing → Mission Control (My Work) | `marketing/mission-control/MyWorkTab.tsx` | Verificar |
| Marketing → SmartKanban / Workflow Board | `marketing/mission-control/SmartKanban.tsx`, `workflow/WorkflowBoard.tsx` | Verificar |
| Kanban → Lead Subtarefas | `kanban/LeadSubtarefas.tsx` | Verificar |
| Processos → Evidências de Etapa | `processos/EvidenciasEtapaPanel.tsx` | Verificar |
| Cobrança / Financeiro / Fábrica drawers | vários | Fora do escopo (não são listas de tarefa) |

## Estratégia: componente reutilizável

Em vez de copiar o JSX do avatar em cada lugar, criar **um único componente padrão** e usá-lo em todas as superfícies de tarefa.

### Novo componente

`src/components/projetos/shared/TarefaResponsavelAvatar.tsx`

```tsx
interface Props {
  responsavelId?: string | null;
  nome?: string | null;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md"; // h-5 / h-6 / h-7
  showName?: boolean;        // mostrar nome ao lado em telas md+
  className?: string;
}
```

- Render: `<Avatar>` com `AvatarImage` + `AvatarFallback` (iniciais ou ícone `User`).
- Tooltip sempre presente: "Responsável: {nome}" / "Sem responsável".
- Avatar neutro/muted quando nulo.
- Sem dependência do shape do hook; aceita só os 3 campos brutos.

### Componente complementar (colaboradores)

`src/components/projetos/shared/TarefaSeguidoresStack.tsx` — stack de avatares horizontais (até 3 + "+N") para representar **colaboradores/seguidores**, espelhando o padrão já usado em `ProjetoTarefaRow.tsx` (linhas 565-569).

```tsx
interface Props {
  seguidores: Array<{ user_id: string; nome: string | null; avatar_url: string | null }>;
  max?: number;        // default 3
  size?: "xs" | "sm";  // default xs (h-5 w-5)
}
```

Exibido apenas quando há ≥1 colaborador além do responsável. Tooltip com lista de nomes.

## Plano de aplicação por superfície

Aplicar o avatar do **responsável** (obrigatório) em todas as superfícies abaixo. Adicionar **stack de colaboradores** apenas onde há espaço e o dado está disponível.

### Fase 1 — Central de Trabalho (alta prioridade — pedido explícito)

1. **`HojeTab.tsx` ("Para focar agora")**
   - `MinaTarefa` já traz `responsavel_nome` e `responsavel_avatar_url`.
   - Adicionar `<TarefaResponsavelAvatar>` na `TarefaRow` desse arquivo, posicionado entre o título/projeto e o badge de prazo.
   - Manter densidade compacta (size `xs`).

2. **`ResumoSemanal.tsx`** — se renderiza tarefas, aplicar mesmo padrão.

3. **`ProjetoInboxContent.tsx`** — verificar e aplicar quando houver row de tarefa.

### Fase 2 — Dashboard "Minhas Tarefas"

4. **`WidgetListaProximas.tsx`** e **`WidgetListaAtrasadas.tsx`** — adicionar coluna de avatar do responsável. Esses widgets podem ser usados em dashboards compartilhados, então mostrar o dono é essencial.
   - Pode exigir extensão do hook que alimenta o widget (verificar `useProjetoTarefas` / hook análogo) para incluir `responsavel_nome` e `responsavel_avatar_url` no SELECT.

5. **`MinhasTarefasBoard.tsx` / `MinhasTarefasCalendar.tsx`** — se mostram cards de tarefa, idem.

### Fase 3 — Marketing (Mission Control)

6. **`MyWorkTab.tsx`**, **`SmartKanban.tsx`**, **`WorkflowBoard.tsx`**, **`TaskDetailDrawer.tsx`** — aplicar `TarefaResponsavelAvatar` nos cards. Confirmar que a entidade de tarefa de marketing (`marketing_tarefas` ou similar) já carrega o responsável. Se não, estender a query.

### Fase 4 — Outros módulos com tarefa

7. **`kanban/LeadSubtarefas.tsx`** — subtarefas de lead.
8. **`processos/EvidenciasEtapaPanel.tsx`** — etapas de processo.
9. **`projetos/home/ProjetoHomeQuickActions.tsx`** e **`ProjetoHomeKPIs.tsx`** — onde houver listas curtas de tarefa.

### Fase 5 — Backend (lazy, só onde faltar)

Estender RPCs/queries que ainda não retornam `responsavel_nome` + `responsavel_avatar_url` (LEFT JOIN em `profiles`). A migration segue o mesmo padrão da já feita em `get_minhas_tarefas_central` e `get_minhas_delegadas_central`:

- Identificar via `rg "RETURNS TABLE.*responsavel_id" supabase/migrations` e função real no DB.
- Para cada RPC/view que serve listas de tarefa: `DROP FUNCTION` + `CREATE OR REPLACE` adicionando os 2 campos via `LEFT JOIN profiles pr ON pr.id = t.responsavel_id`.
- Atualizar tipo TS no hook correspondente.

## Detalhes técnicos / convenções

- Tamanho padrão: `h-5 w-5` (xs) em listas densas; `h-6 w-6` (sm) em cards.
- Fallback de iniciais: 2 primeiras letras do `nome` em maiúsculas; fallback final = ícone `User` (lucide).
- Tooltip obrigatório (acessibilidade — usuários só com avatar precisam saber o nome).
- Cores: avatar neutro (`bg-muted`/`text-muted-foreground`) quando `responsavel_id` for null; nunca usar cores hardcoded — sempre tokens semânticos do design system.
- Padrão de classes alinhado ao já usado em `ProjetoTarefaRow.tsx` (linha 413-418 / 565-569) para manter visual consistente.
- Em listas com seleção/checkbox, posicionar avatar entre o conteúdo central e o prazo/data.

## Validação

- Build limpo a cada fase.
- Browser nas telas-chave: Central/Hoje, Central/Tarefas (regressão), Central/Delegadas (regressão), Minhas Tarefas dashboard, Marketing Mission Control, Lead Subtarefas.
- Confirmar tooltip aparecendo, fallback correto e que tarefas sem responsável mostram avatar neutro com "Sem responsável".

## Fora do escopo

- Permitir trocar responsável diretamente do avatar (popover de seleção). Pode ser uma evolução posterior.
- Mostrar followers/colaboradores em superfícies onde o dado não existe sem refatoração de schema.
- Drawers/modais de detalhe que já têm seletor completo de responsável (esses já cumprem o objetivo).

## Ordem sugerida de execução (incremental e validável)

1. Criar `TarefaResponsavelAvatar` (e opcionalmente `TarefaSeguidoresStack`).
2. **Refatorar** `MinhasTarefasContent.tsx` e `DelegadasContent.tsx` para usar o componente novo (sem mudar visual).
3. Aplicar em `HojeTab.tsx` (Fase 1, fecha o pedido imediato da imagem).
4. Aplicar nos widgets de "Minhas Tarefas" (Fase 2).
5. Marketing (Fase 3).
6. Demais (Fase 4).
7. Estender RPCs apenas onde faltar dado (Fase 5, sob demanda).

Posso começar pela Fase 1+2 (Central + dashboard pessoal), que cobre 80% do uso diário, e depois seguir com as demais conforme prioridade.
