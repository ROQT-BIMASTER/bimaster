# Plano — Onda 1: Destravar Projetos & Tarefas (com segurança preservada)

Foco em **Projetos/Tarefas** (competidor direto do Asana), respeitando regra inegociável:

> **Quem não tem vínculo com o projeto NÃO vê o projeto.**

Vínculos válidos hoje (`user_can_access_projeto`):
1. `admin` global
2. `criador_id` do projeto
3. Linha em `projeto_membros` (qualquer papel)
4. Departamento do usuário ∈ `projeto_departamentos`

Nenhum desses será removido nem afrouxado. As correções ampliam **o que o usuário vinculado consegue fazer**, não quem entra.

---

## Diagnóstico

| # | Problema reportado | Causa raiz | Está em risco a segurança? |
|---|---|---|---|
| 1 | Coordenador/Gerente não vê todas as tarefas do projeto | Policy de `projeto_tarefas`/`projeto_secoes` usa `user_can_access_secao` (visibilidade por seção), mais restritiva que `user_can_access_projeto` | Não — corrigir é alinhar regra de tarefa à regra de projeto, mantendo o vínculo obrigatório |
| 2 | Atribuir Coordenador "fala e não atribui" | UPDATE bloqueado pela policy `Update project members` em casos válidos; sem feedback claro quando bloqueia | Não — policy continua exigindo papel de gestão |
| 3 | Tarefas do Asana terminam em "carregamento parcial" silencioso | Edge function corta por orçamento de tempo, frontend não retoma de forma visível | Não — sync já roda autenticado |
| 4 | Tela em branco / app parece travado | Sem skeletons, sem optimistic updates, sem cache do React Query bem ajustado | Não — só UI |
| 5 | Criar tarefa exige muitos cliques | Sem criação inline / atalhos | Não |

---

## Frente 1 — Acesso correto DENTRO do projeto (sem afrouxar entrada)

**Regra:** se o usuário tem vínculo com o projeto (admin / criador / membro / departamento), ele vê **todas** as seções e tarefas daquele projeto. Hoje a policy de tarefa exige visibilidade da seção, o que pode esconder tarefas de coordenadores legítimos.

**Ações:**
- Manter `user_can_access_projeto` exatamente como está (4 vínculos).
- Substituir a policy SELECT de `projeto_tarefas` para usar `user_can_access_projeto(auth.uid(), projeto_id)` em vez de `user_can_access_secao`.
- Manter `user_can_access_secao` apenas para o caso específico de membro **regular** (papel `membro`) com restrição de seção configurada em `projeto_membro_secoes`. Quem é coordenador/gestor/gerente/admin/criador ignora a restrição de seção.
- Replicar a mesma lógica em `projeto_secoes` SELECT.
- Adicionar testes SQL com 5 cenários: anônimo (negado), membro sem vínculo (negado), membro de outro projeto (negado), membro com restrição de seção (vê só suas seções), coordenador (vê tudo do projeto).
- Corrigir feedback do `updatePapel` em `useProjetoMembros` para mostrar erro específico quando 0 linhas retornam (já implementado parcialmente — adicionar diferenciação entre "sem permissão" e "membro inexistente").

## Frente 2 — Sync Asana visível e retomável

Sem mexer em autenticação. Apenas tornar o que já é seguro também transparente.

**Ações:**
- Persistir progresso real em `asana_sync_logs`: `total_esperado`, `total_processado`, `fase`, `percentual`.
- Componente `AsanaSyncProgress` com Realtime no `asana_sync_logs` filtrado por `user_id = auth.uid()` (RLS já existente).
- Auto-resume no frontend se status = `core_partial` há mais de 30s (mesma rotina autenticada).
- Toast persistente com link "Ver tarefas importadas" ao terminar.
- Botão "Forçar sync completo" (ainda chamando a edge function autenticada).

## Frente 3 — Velocidade percebida (UI only, zero impacto em RLS)

Toda mudança é client-side; o servidor continua sendo a fonte da verdade e rejeita ações sem permissão.

**Ações:**
- **Optimistic updates com React Query** + rollback em `onError` para:
  - Marcar tarefa concluída
  - Mover card no Kanban (drag-and-drop)
  - Editar título inline
  - Atribuir responsável (somente entre membros do projeto)
  - Mudar prazo
- **Cache**: `staleTime: 30s` em listas, `keepPreviousData: true` na navegação entre projetos.
- **Skeletons reais** (não spinner) em `Projetos`, `ProjetoDetalhe`, `Kanban`, `MinhasTarefas`.
- **Auto-save com debounce 500ms** em descrição/título/comentários, com indicador "Salvando…/Salvo às 14:32/Erro — tentar novamente".
- Toast de erro **não bloqueante** com action "Tentar novamente" (padrão Asana).
- Importante: se o servidor rejeitar (RLS), o rollback restaura o estado anterior **e** mostra mensagem clara — o usuário nunca pensa que salvou algo proibido.

## Frente 4 — Ações rápidas (sem novos vetores de acesso)

Toda criação/edição passa pelas RLS atuais; as policies de INSERT já exigem ser membro/criador/admin (a manter).

**Ações:**
- **Criar tarefa inline** no Kanban e na lista (clica "+", Enter salva, Esc cancela, Tab avança).
- **Atalho global `C`** quando o usuário está dentro de um projeto onde tem permissão de INSERT — abre quick-create. Se o servidor rejeitar, mostra mensagem.
- **Cmd+K** já existe — adicionar "Nova tarefa em [projeto]" e "Ir para [projeto recente]" (lista filtrada pelas RLS atuais).
- Hover nos cards do Kanban revela ações rápidas (concluir, atribuir, mover) — sempre vinculadas ao mesmo conjunto de RLS.
- Multi-seleção com `Shift+Click` para mover/concluir várias tarefas.

---

## Garantias de segurança (checklist de cada PR)

Toda alteração desta onda passa por:

- [ ] Nenhuma RLS é removida; nenhuma usa `USING (true)`.
- [ ] Nenhuma policy nova permite acesso sem um dos 4 vínculos.
- [ ] Função `user_can_access_projeto` permanece como gate único de entrada.
- [ ] Tentativa de acesso negado continua gerando linha em `security_audit_log`.
- [ ] Optimistic updates **não** ocultam erro de permissão — sempre rollback + toast.
- [ ] Nenhuma chamada nova faz `service_role` no client.
- [ ] Testes SQL cobrem cenário "usuário sem vínculo nenhum → 0 linhas em SELECT, erro em INSERT/UPDATE/DELETE".
- [ ] Linter Supabase rodado após cada migration; warnings novos = bloqueia merge.

## Ordem de execução

```text
Semana 1 — bloqueadores (sem afrouxar segurança)
 ├─ Frente 1: Policies SELECT de projeto_tarefas/projeto_secoes
 │   alinhadas a user_can_access_projeto + testes
 └─ Frente 2: Progresso visível e retomável do sync Asana

Semana 2 — paridade Asana (UI)
 ├─ Frente 3: Optimistic updates, cache, skeletons, auto-save
 └─ Frente 4: Criação inline, atalhos C / Cmd+K, multi-seleção
```

## Critério de sucesso

- Coordenador/Gerente vinculado vê **100%** das tarefas do projeto.
- Usuário **sem vínculo nenhum** continua não vendo o projeto nem as tarefas (validado por teste SQL).
- Sync do Asana mostra progresso e retoma sozinho — nunca termina silenciosamente parcial.
- Marcar tarefa como concluída responde em **< 50ms** na UI; rollback claro se RLS bloquear.
- Criar tarefa: 2 teclas (`C` → digitar → Enter).
- Zero "tela em branco" durante navegação.

## Detalhes técnicos

- Migration ajusta apenas as policies SELECT de `projeto_tarefas` e `projeto_secoes`. `user_can_access_projeto` e `user_can_access_secao` permanecem.
- Nova função `user_can_view_secao_within_projeto(uid, secao_id)`: retorna true se (a) o usuário é admin/criador/coordenador/gestor/gerente do projeto OU (b) é membro com a seção em `projeto_membro_secoes` OU (c) o membro não tem nenhuma restrição de seção. Mantém restrição opcional por seção apenas para papel `membro`.
- React Query: chave `["projeto-tarefas", projetoId]`; `setQueryData` para optimistic + `invalidateQueries` em `onSettled`.
- Realtime de `asana_sync_logs`: canal `asana-sync-{logId}`, RLS já filtra por `user_id`.
- Skeletons em `src/components/projetos/skeletons/`.
- Atalhos em `src/hooks/useGlobalShortcuts.ts` com mapa central; cada atalho checa permissão antes de abrir UI de mutação.
- Não tocar em outros módulos (Fábrica, Trade, Financeiro, Marketing) nesta onda.

Após sua aprovação, começo pela **Frente 1** com migration + testes SQL antes de qualquer mudança de UI.
