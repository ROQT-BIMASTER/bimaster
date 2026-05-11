# Auditoria pré-produção — PRs #2 e #3 (módulo Projetos)

Data: 2026-05-11
Auditor: Lovable agent (revisão estática + grep dirigido).
Escopo: revisão isolada de cada PR + análise de integração. Não altera código de Projetos.

> Observação operacional: a auditoria foi feita com base no código presente em `main`
> e nos diffs descritos no prompt. Onde o diff dependia de hipóteses (ex.: comportamento
> exato de `patchView`), o item foi marcado como **a confirmar via diff completo**.

---

## PR #2 — `fix/projetos-tarefa-detalhe-sync`

### Bloqueadores

Nenhum bloqueador estrito — o PR é seguro de mergear, mas com follow-ups.

### Avisos

1. **`src/components/projetos/ProjetoTarefaDetalhe.tsx` (~linha 149) — `selectedSubtarefa` continua snapshot stale.**
   O mesmo padrão corrigido em `selectedTarefa` (derivar via `useMemo` a partir de `selectedSubtarefaId` + lista de subtarefas do cache) deve ser aplicado aqui. Sem isso, o usuário que abre uma subtarefa, edita responsável/seguidor por outro caminho (mention, IA, etc.), continua vendo o estado antigo até reabrir.
   Recomendação: incluir no PR #2 ou abrir PR #2.1 imediato.

2. **`src/hooks/useProjetoTarefas.ts` (~linha 248, `onMutate` de `updateTarefa`) — optimistic update parcial.**
   O cache de `tarefas` carrega o objeto derivado `responsavel: { id, nome, avatar_url }`, mas o spread só atualiza `responsavel_id`. Resultado prático: o avatar/nome só mudam visualmente após o refetch da invalidação. Para o usuário, parece "não aplicou".
   Mitigação: no `onMutate`, se `updates.responsavel_id` estiver presente, lookup em `teamMembers` e popular `responsavel: { id, nome, avatar_url }` no patch. Mesma lógica para `colaboradores` (já feita em `addColaborador` — confirmar com leitura do diff).

3. **`logAtividade` fire-and-forget — risco de auditoria silenciosa.**
   Para cosmético/ux é aceitável. Para empresa cosmética/farma sob LGPD ou ISO 9001/22716 (BPF cosméticos), a perda de log é não-conformidade. Duas alternativas, em ordem de robustez:
   - Trigger DB `AFTER UPDATE` em `projeto_tarefas` que insere em `projeto_tarefa_atividades` automaticamente (preferida — independe do client).
   - Fila local (IndexedDB) com retry em background quando volta online; ainda dependente do client.
   Mínimo aceitável agora: garantir que o `console.error` chegue ao logger central (verificar se `src/lib/observability` ou similar já encaminha para Sentry/Datadog). Se não chega, trocar `console.error` por `logger.error` antes do merge.

4. **`addColaborador.mutate` + `logAtividade` em paralelo — atividade espúria em caso de erro do colaborador.**
   Cenário: insert de colaborador falha por violação `UNIQUE (tarefa_id, user_id)`. O `patchView` reverte a UI, mas o log "adicionou seguidor X" já foi disparado em `onSuccess`. Como `logAtividade` está dentro de `onSuccess`, em tese só dispara após sucesso — confirmar que está mesmo assim no diff. Se for fora do `onSuccess`, mover.

5. **Outros pontos com mesmo padrão `useState<T | null>` armazenando objetos do cache** (varredura inicial em `src/components/projetos` e `src/components/china`):
   - `ProjetoTarefaDetalhe.tsx::selectedSubtarefa` — confirmado.
   - `ProjetoVincularChina.tsx::selectedSubmissao` (via `useMemo` linha 274) — **já está correto** (derivado).
   - Recomendação: rodar `rg -n "useState<.*Tarefa|useState<.*Submissao|useState<.*Item.*\| null>" src/components` antes do merge para varredura completa.

6. **RLS de `projeto_tarefa_atividades` para insert assíncrono.**
   Verificar (não verificado nesta auditoria) que existe policy `INSERT` permitindo `auth.uid() = autor_id` em contexto autenticado. Se policy exigir match de role/projeto, o insert assíncrono pode silenciosamente falhar para cliente externo.

### Testes manuais sugeridos não cobertos no plan

- Marcar responsável → fechar tarefa → reabrir pela mesma rota → conferir que avatar/nome aparecem (testa o item 2 acima).
- Adicionar e remover o mesmo seguidor 5x em <2s → cache final deve refletir estado real do banco.
- Excluir a tarefa em outra aba do navegador (mesmo usuário) → confirmar que o Sheet desta aba fecha sem erro de "Cannot read property X of null".
- Off-line: editar responsável com rede desligada → ao voltar online, confirmar que `logAtividade` foi gravado (testa robustez do fire-and-forget).
- Logar como usuário sem permissão de edição na tarefa (read-only) → o Sheet abre, mas controles de edição em `TarefaResponsavelSeguidoresEditor` permanecem desabilitados.

### Veredito

**Aprovar com ressalvas.** Mergear em produção após:
- (a) decidir se `selectedSubtarefa` entra neste PR ou em hotfix imediato.
- (b) confirmar que `logAtividade` chega ao logger central (não só `console`).
- (c) corrigir o optimistic update parcial em `responsavel` (avatar/nome).

---

## PR #3 — `fix/auth-token-refresh-no-remount`

### Bloqueadores

1. **`PermissionsContext.tsx` (~linha onde o branch novo de `TOKEN_REFRESHED` zera `globalPermissionsCache = null` antes do `fetchPermissions(true)`).**
   Janela de tempo entre `cache=null` e a resposta nova chegar pode causar:
   - consumidores que leem `permissions.modules` no instante errado recebem `[]`.
   - guards que dependem do cache (mesmo com `permissionsReady=true`) podem renderizar conteúdo "vazio".
   Recomendação obrigatória antes do merge: usar estratégia **swap-on-success** — manter o cache atual servindo, fazer fetch em background, substituir atomicamente apenas no sucesso. Em caso de erro, manter o cache antigo e logar.

### Avisos

2. **`globalPermissionsCache.userId !== newUserId` em `TOKEN_REFRESHED` — segurança crítica.**
   Em fluxos normais, Supabase emite `SIGNED_IN` na troca de usuário. Mas em um cenário de browser compartilhado com `localStorage` manipulado, o evento pode ser apenas `TOKEN_REFRESHED` no boot. A salvaguarda está OK — mas adicionar:
   - log explícito (`logger.warn("user mismatch on refresh — full reset")`) para detectar abuso.
   - métrica/contador para alertar se ocorrer >0 vezes em produção.

3. **`session_invalidation_queue` (linhas ~304-315).**
   Verificar (não foi possível confirmar via diff) que a verificação acontece **antes** do retorno do cache no `useMemo` que serve `permissions.modules`. Se a fila for processada de forma assíncrona após o refresh ter retornado permissões stale, há janela de privilege leakage. Se possível, mover a verificação para o início do `fetchPermissions(true)`.

4. **`ImpersonationContext` em `ModuleProtectedRoute`.**
   `useImpersonation` tem cache próprio? Se sim, `TOKEN_REFRESHED` durante uma impersonação ativa pode descasar `currentUserId` (do auth) de `effectiveUserId` (do impersonate). Recomendação: na impersonação ativa, ignorar o branch `TOKEN_REFRESHED` (não revalidar permissões com o usuário real, manter a sessão impersonada estável até `Stop Impersonation` explícito).

5. **Guards consistentes (`!permissionsReady && loading`) nos 4 arquivos.**
   Verificar visualmente que a expressão é literalmente igual nos 4 (`ProtectedRoute`, `ModuleProtectedRoute`, `ScreenProtectedRoute`, `ClienteProtectedRoute`). Pequena divergência (ex.: `!permissionsReady || loading` em um deles) quebra a paridade.

6. **PWA mobile / `visibilitychange`.**
   Em iPad/iOS PWA, ao voltar do background, Supabase frequentemente dispara `TOKEN_REFRESHED`. Com o swap-on-success acima, o sheet de tarefa em iPad deve permanecer estável. Sem swap-on-success, há risco de flicker mesmo após este PR.

7. **Token expirou mid-session sem refresh possível.**
   Cenário: usuário em sessão longa, conexão cai, refresh token também expira. Supabase emite `SIGNED_OUT`. O reset agressivo é o caminho correto. Confirmar que o `SIGNED_OUT` cai no branch antigo (não no novo `TOKEN_REFRESHED`).

8. **`DashboardRedirect` (não alterado).**
   Tem safety timeout próprio de 8s — não depende dos guards alterados. OK.

### Testes manuais sugeridos não cobertos no plan

- Sessão longa (>1h): abrir tarefa, ir para outra aba 30 min, voltar → o sheet permanece aberto, sem refresh visual.
- iPad PWA: abrir checklist China, lock screen 5 min, desbloquear → checklist intacto.
- Compartilhar browser: usuário A faz login → loga out → usuário B faz login. Confirmar que B nunca vê módulos/screens de A nem por 100ms.
- Forçar role change via admin (script SQL ou tela de admin) durante sessão ativa do alvo → o alvo é deslogado em <30s pela `session_invalidation_queue`.
- Devtools → Application → Local Storage → editar `sb-*-auth-token` para ID de outro usuário → forçar reload → `TOKEN_REFRESHED` deve resetar o cache via `userId !== newUserId`.

### Veredito

**Pedir mudanças.** Aprovar somente após:
- (1) implementar swap-on-success em vez de `cache = null` (item 1, **bloqueador**).
- (2) decisão sobre comportamento durante impersonação (item 4).
- (3) auditoria literal da expressão `!permissionsReady && loading` nos 4 guards.

---

## Análise de integração

- Os arquivos não se sobrepõem (Projetos vs. Auth/Permissions).
- **Ordem recomendada de merge**:
  1. PR #3 primeiro, **após** as 3 correções acima. Motivo: o swap-on-success de PR #3 reduz a chance de flicker que o PR #2 visa evitar — mergear PR #3 estabilizado dá base para validar PR #2.
  2. PR #2 em seguida, com as ressalvas (avatar/nome no optimistic update + decisão sobre `selectedSubtarefa`).
- **Rebase**: não é necessário rebase de um sobre o outro — não há conflito de arquivos. Apenas garantir que o `main` esteja limpo entre os dois merges para isolar regressões.
- **Janela de release**: mergear em janela de baixo tráfego (madrugada Brasil) e monitorar:
  - `auth.audit_log_entries` para picos de SIGNED_OUT inesperados.
  - Erros em `projeto_tarefa_atividades` (logger central) — a fila fire-and-forget não deve gerar mais que <0,1% de falhas.
  - Sentry/Datadog para erros React não-capturados em `ProjetoTarefaDetalhe`.

---

## Itens fora do escopo dos 2 PRs (descobertos durante a auditoria)

Sem ação obrigatória — registrar em backlog:

- Padronizar wrapper `logger.error` em todos os fire-and-forget de auditoria (não só Projetos).
- Documentar em `docs/onboarding/` a regra "objetos do cache nunca em `useState`, sempre derivar via `useMemo` por id".
- Considerar mover `globalPermissionsCache` para um `Map<userId, cache>` em vez de singleton — elimina o risco de cross-user leak por construção, sem depender de comparações de id.
