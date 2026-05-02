## Objetivo

Validar, com o sistema já em produção, **todas as superfícies impactadas pelas alterações recentes desta sequência de releases** (Kanban de alçadas, central de aprovações consolidada, hotfix de permissões RLS e correção de visibilidade da tela Vincular China). Foco: descobrir trava ou regressão **antes** que um usuário real seja impactado.

## Mudanças recentes em escopo

| # | Mudança | Risco principal |
|---|---|---|
| 1 | Lotes de aprovação dentro da tarefa (`rpc_criar_lote_aprovacao`, `rpc_avancar_etapa_aprovacao`, `rpc_mover_lote_para_tarefa`, templates globais em `/admin/templates-alcadas`) | Tarefa não abre; aprovação trava; aprovador não consegue avançar |
| 2 | Remoção do fluxo "Despachar para Módulo" (deleção de `DespachoFichaDialog.tsx` e `DespachoModuloDialog.tsx`) e migração para o novo fluxo dentro de `ChinaPastaDigitalPanel` / `TarefaChinaDocsSection` | Botões antigos quebrados; documento sem destino |
| 3 | Central de Aprovações consolidada (`CentralAprovacoes.tsx`, `ProjetoAprovacoes.tsx`, `vw_aprovacoes_consolidado`, `rpc_aprovacoes_pendentes_para`) | View/RPC com erro silencioso; KPIs zerados; Realtime não atualiza |
| 4 | Hotfix RLS: `GRANT EXECUTE` em `check_user_access`, `can_view_profile`, `user_can_access_projeto`, `user_can_access_projeto_via_tarefa` | Algum outro objeto ainda sem GRANT; usuário continua sem ver projetos |
| 5 | Ampliação de RLS de `china_produto_submissoes` / `china_produto_documentos` para módulos `china` e `projetos` (SELECT) | Quebra inesperada em escrita; vazamento entre escopos |

## Testes a executar

### A. Auditoria server-side (sem UI)

A1. Rodar `supabase--linter` e revisar apenas warnings **novos** após as 3 últimas migrations.
A2. Conferir `pg_proc` por funções `SECURITY DEFINER` chamadas em policies que **ainda não tenham** `GRANT EXECUTE TO authenticated`. Listar e granjear o que faltar (mesma família do hotfix anterior).
A3. Conferir que `vw_aprovacoes_consolidado` retorna linhas para um usuário comum (impersonando via RLS test).
A4. Testar `rpc_aprovacoes_pendentes_para(uid)` para 3 perfis: admin, supervisor, usuário comum membro de projeto.
A5. Validar contagem de `china_produto_submissoes` visível para usuário só do módulo `projetos` (esperado: 24, conforme banco).
A6. Verificar que a escrita em `china_produto_submissoes`/`china_produto_documentos` continua **negada** para usuário só do módulo `projetos`.
A7. Varredura nos `postgres_logs` da última hora por `permission denied for function` e `permission denied for table`. Lista deve estar vazia (ou apenas pré-existentes documentados).

### B. Smoke test de UI (browser, login admin)

B1. `/dashboard/projetos` carrega lista; abrir um projeto; abrir uma tarefa.
B2. Dentro da tarefa: abrir aba "Aprovações", criar lote a partir de template global, avançar uma etapa, mover lote entre tarefas. Verificar que badges/SLA atualizam.
B3. `/dashboard/aprovacoes` (Central) — KPIs preenchidos, drawer abre, filtros funcionam, Realtime reflete uma alteração feita em B2.
B4. `/dashboard/projetos/:id/aprovacoes` — escopo do projeto, mesma verificação.
B5. `/dashboard/projetos/vincular-china` — produtos aparecem (24+), filtros, abrir submissão, ver documentos no painel lateral, vincular a uma tarefa de teste, desvincular.
B6. `/dashboard/fabrica-china/recebimentos` (rota atual do usuário) — não regrediu.
B7. `/dashboard/fabrica-china/pasta-digital` ou equivalente — confirmar que o fluxo novo de "Encaminhar para tarefa" abre o `ChinaDocVincularDialog` corretamente; o botão antigo "Despachar para Módulo" não existe mais e não há link morto.
B8. `/admin/templates-alcadas` — listar, criar e editar template; apenas admin acessa.

### C. Smoke test com perfil restrito

Repetir B1, B3, B5 logado como **usuário comum** (não-admin, sem `fabrica`):
- C1. Vê os projetos dos quais é membro.
- C2. Central de aprovações lista apenas lotes onde é responsável/substituto.
- C3. Em "Vincular China": vê produtos e documentos (após a migration recente), mas botões de UPDATE/DELETE em documentos China não aparecem ou erram com toast amigável (não 500).

### D. Regressões clássicas

D1. Login + reload de cada uma das telas acima (deep-link funciona).
D2. Console do navegador limpo de erros vermelhos nas telas testadas.
D3. Network: nenhum request retornando 401/403/500 inesperado.
D4. `bunx vitest run` da suíte atual; revisar quebras.
D5. Scripts `scripts/security/e2e-anonymous-sensitive-columns.sh` e `e2e-authenticated-sensitive-columns.sh` continuam passando.

### E. Plano de rollback

Para cada mudança, deixar pronto o atalho:
- E1. Mudança 4 e 5 (RLS): migration de `REVOKE` / restauração das policies anteriores já mapeada.
- E2. Mudança 1 e 3 (UI/Backend): revert via History no Lovable; identificar a mensagem âncora.
- E3. Documentar em `docs/qa/` o resultado com timestamp para auditoria.

## Saídas esperadas

1. **Relatório curto** por bloco (A–D): PASS / FAIL / observação.
2. **Lista de bugs encontrados**, com severidade (bloqueador / alto / médio / cosmético) e proposta de correção.
3. **Hotfixes imediatos** apenas para itens **bloqueadores** descobertos (com aprovação explícita do usuário antes de tocar em qualquer arquivo de produção).
4. **Atualização** da memória `mem://features/projects/kanban-alcadas-aprovacao` se a auditoria revelar novo padrão a fixar.

## O que **não** vou fazer sem nova aprovação

- Refatorar componentes que estiverem funcionando, mesmo que pareçam frágeis.
- Mexer em RLS de tabelas China que **não** estejam no escopo da queixa atual (já registrado como follow-up no plano anterior).
- Rodar testes destrutivos em produção (deletar lote real, mover documento real). Tudo será feito em registros de teste criados no momento, e revertidos.

## Próximo passo

Aprovado o plano, eu começo pelo **Bloco A** (totalmente server-side, risco zero), depois B (browser logado como admin) e em seguida proponho ao usuário fazer C com um login restrito (preciso que ele indique qual usuário de teste posso usar, ou aciono via impersonate de admin).
