
# Auditoria do ambiente de Projetos

Escopo analisado: `src/pages/Projetos*.tsx`, `ProjetoDetalhe.tsx`, `MinhasTarefas`, `CentralTrabalho`, `src/components/projetos/**`, `src/hooks/useProjetos*.ts`, `useProjetoTarefas`, `useMinhasTarefas`, `useMeusProjetosRecentes`, `useProjetosTeamData`, RLS conhecida (mem://security/projects-access…), e logs de Edge Functions (Asana sync).

Cada achado vem com **gravidade**, **impacto**, **correção sugerida** e **risco de regressão**. Nenhuma mudança altera contratos públicos nem RLS — todas são aditivas ou refatorações internas.

---

## 🔴 Críticos (corrigir antes)

### 1. Erro recorrente no `asana_sync_log` (constraint) [bug em produção, silencioso]
Logs mostram a cada execução do `asana-sync`:
> `new row for relation "asana_sync_log" violates check constraint "asana_sync_log_status_check"`

A migration `20260402165624` permite `running | core_done | secondary_partial | completed | failed`, mas o código está gravando outro valor (provavelmente `partial` ou `core_partial` quando `Done (complete=false)`).
- **Impacto:** logs de sync ficam órfãos / status final não é registrado → painel "última sincronização" mente.
- **Correção:** localizar `setLog/updateLog` em `supabase/functions/asana-sync` e mapear o status final para um dos valores válidos (provavelmente `secondary_partial` quando `complete=false`); ou estender o CHECK via migration.
- **Risco:** baixo (apenas EF + 1 valor de status).

### 2. `useProjetos.projetoColaboradores` faz fan-out gigante e sem cache
Hoje o hook lê **todas** as `projeto_tarefas` (`select id, projeto_id`), depois faz N batches de 500 em `projeto_tarefa_colaboradores`, depois um SELECT em `profiles`. Roda no carregamento da listagem `/dashboard/projetos` para todo usuário logado.
- **Impacto:** com a base atual (centenas de tarefas) já pesa; vai degradar linearmente. É a causa provável de lentidão na lista. Também atinge limite de 1000 linhas de `projeto_tarefas` para usuários com muito acesso.
- **Correção:** criar RPC `get_projetos_collab_avatars()` (mesmo padrão de `get_projetos_member_avatars`), retornando 1 linha por (projeto_id,user_id) já com nome+avatar. Substituir 3 queries por 1.
- **Risco:** baixo — RPC nova, hook trocado, mesma forma de saída.

### 3. Em `Projetos.tsx`, `restrictToAccessible` não inclui o "gerente geral"
Na linha 88 só admin libera o toggle "Ver todos", mas `useIsGerenteGeralProjetos` é importado e nunca usado. Gerente geral não consegue ver todos os projetos do depto pela UI mesmo tendo direito (a RPC backend já libera).
- **Impacto:** UX inconsistente — gerente geral é forçado para "Apenas meus".
- **Correção:** `const podeVerTodos = isAdmin || isGerenteGeral;`
- **Risco:** mínimo (somente toggle de visualização, RLS já decide o que retorna).

### 4. `ProjetoDetalhe` usa `.single()` para o projeto
Quando RLS bloqueia, `single()` lança erro genérico em vez de devolver `null`. Hoje mascara para "permissão negada" via `if (!projeto)`, mas o `useQuery` fica em `error` state, sem retry, e o `logProjectAccessDenied` nunca é chamado de fato.
- **Correção:** trocar para `.maybeSingle()` (já é o padrão em `useProjeto`).
- **Risco:** mínimo.

---

## 🟠 Importantes (qualidade / performance)

### 5. Query `tarefasExcluidas` carrega toda a lixeira ao abrir o projeto
Em `useProjetoTarefas` há `useQuery(["projeto-tarefas-excluidas", projetoId])` rodando sempre, mesmo se o usuário nunca abrir o diálogo. Em projetos antigos isso traz centenas de linhas com `select *`.
- **Correção:** lazy: `enabled: dialogAberto`, controlado por flag passada do `ProjetoHeader`. E trocar `select *` por colunas usadas.
- **Risco:** baixo (lazy load aditivo).

### 6. `MinhasTarefasContent.tsx` tem 1342 linhas
Mistura ListRow, ListSection, board, calendário, filtros, persistência URL, preferências, atalhos. Difícil manter, prone a re-render excessivo.
- **Correção:** extrair `ListRow`, `ListSection`, helpers de filtro para `central/parts/`. Sem mudança de comportamento.
- **Risco:** baixo se feito incrementalmente, com testes manuais.

### 7. Falta realtime em `projeto_tarefas` na lista do projeto
`useProjetoChat` e `useProjetoTarefaDetalhe` usam `postgres_changes`, mas a lista (`useProjetoTarefas` / `get_projeto_tarefas_v2`) não. Quando outro membro cria/edita uma tarefa, só vê após `staleTime: 30s` ou refetch manual.
- **Correção:** assinar `projeto_tarefas` com filtro `projeto_id=eq.${id}` e invalidar a queryKey `["projeto-tarefas-v2", projetoId]` (debounced 500ms para evitar tempestade).
- **Risco:** baixo, é aditivo.

### 8. `useMeusProjetosRecentes` ignora filtro de exclusão e limite
Faz `.in("projeto_id", ids)` sem `.limit()` na consulta de tarefas e busca todas (excluídas inclusive não filtradas em alguns casos). Pode estourar 1000 rows silenciosamente em usuários com muita atividade.
- **Correção:** acrescentar `.is("excluida_em", null)` (já tem) + paginar metrics via RPC `get_projeto_metrics_for_user(uid)`.
- **Risco:** baixo.

### 9. `Projetos.tsx` filtra por `selectedUser` usando o conjunto `membrosMap` reduzido
O `Select` "Usuário" só lista quem está em projetos visíveis ao usuário atual; logo, gerente que ativa "Ver todos" recebe lista de usuários potencialmente diferente. OK comportamentalmente, mas o `selectedUser` persiste após desligar "Ver todos" e pode esconder todos os projetos sem feedback.
- **Correção:** ao desligar "Ver todos", resetar `selectedUser` se o usuário escolhido não pertence mais à lista.
- **Risco:** mínimo.

### 10. `ColumnConfigPopover.loadColumnConfig` lê localStorage no render inicial
`useState(loadColumnConfig)` chama `localStorage.getItem` no SSR/primeiro paint, sem proteger `typeof window`. Em ambientes de SSR/preview falha silenciosamente.
- **Correção:** `useState(() => typeof window === 'undefined' ? defaultCols : loadColumnConfig())`.
- **Risco:** mínimo.

---

## 🟡 Polimento / consistência

### 11. Drag-and-drop manual sem skeleton de fallback
`reorderTarefasSecao` faz optimistic update, mas se o RPC falha o toast aparece e a posição volta — sem indicador visual. Adicionar borda lateral `animate-pulse` enquanto `isPending`.

### 12. `ProjetoFilterSort.applyFilters` não tem teste para `__me__` e `sem_responsavel`
Já existe `src/lib/__tests__/projetoFilterUtils.test.ts`. Adicionar 4 casos cobrindo: `__me__` com user logado, `__me__` sem user, `sem_responsavel`, e combinação atrasadas+responsável.

### 13. Status "pendente" vs "todo" inconsistente
Em `useProjetos.createProjeto` cria tarefas com `status: "todo"` (linhas 320, 354). Em `useProjetoTarefas.createTarefa` o optimistic usa `status: "pendente"`. Filtros checam `pendente`, `em_andamento`, `concluida`, `bloqueada`. Tarefas vindas de modelo nascem com status fora do enum reconhecido pela UI.
- **Correção:** padronizar para `pendente` no `useProjetos.createProjeto` (só onde o template materializa). Verificar no banco se o enum aceita `todo` — se sim, normalizar via SQL update opcional (não obrigatório para não tocar produção).

### 14. `ProjetoDetalhe` cria tabs `painel` e `equipe` que renderizam o mesmo componente
Linhas 195-196 — duplicação. Definir um único id ou condicionar a um modo `tab=equipe&view=painel`.

---

## Plano de execução proposto (ordem segura)

```text
Fase 1 – correções críticas sem risco
  [1] Mapear status válido no asana-sync (EF)
  [3] Incluir isGerenteGeral no podeVerTodos (Projetos.tsx)
  [4] Trocar .single() por .maybeSingle() (ProjetoDetalhe.tsx)
  [10] Guardar typeof window em ColumnConfigPopover

Fase 2 – performance
  [2] RPC get_projetos_collab_avatars + troca no hook
  [5] Lazy fetch de tarefasExcluidas
  [8] Limite/RPC em useMeusProjetosRecentes
  [7] Realtime opcional na lista de tarefas (debounced)

Fase 3 – qualidade
  [6] Extrair ListRow/ListSection de MinhasTarefasContent
  [9] Reset de selectedUser ao desligar "Ver todos"
  [11] Indicador visual no reorder pending
  [12] Testes adicionais em projetoFilterUtils
  [13] Padronizar status "pendente" no createProjeto
  [14] Unificar tabs painel/equipe
```

Cada fase pode ser entregue isoladamente. Bumps de `APP_VERSION` e changelog em `ApiDocumentation.tsx` por fase, conforme a regra do projeto.

---

## Observações de segurança

A política RLS de Projetos (4 vínculos via `user_can_access_projeto`) está respeitada em todos os hooks revisados — nenhum bypass detectado. O fix #2 mantém a RLS (RPC com `security definer` filtrando por `auth.uid()` e usando `user_can_access_projeto`).

Aguardando aprovação para iniciar pela **Fase 1** (4 ajustes pequenos, alto retorno e zero risco).
