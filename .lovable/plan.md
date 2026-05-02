## Objetivo

Eliminar o fluxo paralelo "Despachar para Módulo" (que duplicava o trabalho dos usuários) e concentrar a aprovação de documentos da China **dentro da própria tarefa do projeto**, num **kanban de alçadas configurável por lote de documentos**, reusando o motor genérico que já existe (`fluxo_aprovacao_*`). Cada movimento (envio, aprovação, rejeição com nova rodada, transferência de seção/responsável) gera registro automático no log do projeto.

---

## Como vai funcionar (visão do usuário)

1. Usuário abre **Vincular China** e, em vez de "Despachar para Módulo", escolhe **"Vincular a tarefa"** (já existe `china_documento_tarefa_vinculos` — a UI passa a ser o caminho único).
2. Dentro da tarefa, na aba **"Aprovações"** (nova), o usuário cria um **Lote de Aprovação**: dá um nome ("Aprovação artes", "Validação ficha técnica"), escolhe um **template de alçadas** (ou monta do zero), arrasta os documentos vinculados para dentro do lote e define **prazo do lote** + **prazo por etapa**.
3. O lote vira um **kanban horizontal** dentro da tarefa: colunas = etapas (ex.: *Em revisão → Aprovador 1 → Aprovador 2 → Aprovado* / *Rejeitado*). O lote é o card que percorre as colunas; documentos e assinaturas ficam acoplados ao card.
4. Cada etapa tem **responsável(is)**, prazo e tipo (`simples` / `dupla` / `unanime`). Aprovação avança; **rejeição** devolve ao usuário origem marcando **Rodada 2**, **Rodada 3**, etc. — a contagem aparece no card.
5. Tarefa pode ser movida para outra **seção** ou ter outro **responsável** — o lote vai junto. A política de "continuar" vs. "reiniciar etapa atual" é definida no template.
6. **Prazos**: seção, tarefa, lote e cada etapa têm seu prazo. O sistema monitora atrasos e gera alertas/badges (já há `dias_alerta_antes` em `projeto_secoes`; reaproveitamos).
7. **Tudo é registrado** em `projeto_atividades` (criação de lote, mudança de etapa, aprovação, rejeição, mudança de rodada, transferência de seção, mudança de responsável, anexos adicionados).

---

## Estratégia antiga a desativar

Confirmado pela resposta às perguntas: **remover Despacho + telas legadas de Fluxo de Aprovação**.

**Frontend a deletar**
- `src/components/china/DespachoModuloDialog.tsx`
- `src/components/china/DespachoFichaDialog.tsx`
- `src/hooks/useDespachoDocumentos.ts`
- `src/hooks/useFluxoAprovacaoArtes.ts`
- `src/pages/FluxoAprovacaoConfig.tsx`
- `src/pages/FluxoAprovacaoDetalhe.tsx`
- `src/pages/FluxoAprovacaoArtes.tsx`
- `src/pages/FluxoArtesMotor.tsx`
- Constante `DESPACHO_MODULOS` em `useChinaPastaDigital.ts` e mutation `useDespacharModulo`
- Botões/menus "Despachar para Módulo" em `VincularChinaRowAction`, `VincularChinaBulkActions`, `ChinaPastaDigitalPanel`, `ChinaSubmissaoExpandido`
- Rotas em `App.tsx` para `/fluxo-aprovacao*` e `/fluxo-artes*`

**Backend a deprecar (migration de remoção depois de migrar dados pendentes para a nova UI)**
- Tabelas: `china_ficha_despachos`, `process_despacho_documento`, `process_despacho_transicoes`, `process_modulos_despacho`
- Edge functions associadas a fluxo-artes / despacho (verificar `supabase/functions/` no momento da execução)

**O que fica**
- Motor `fluxo_aprovacao_config / etapas / instancias / aprovadores / transicoes / anexos / vinculos` — é a base do novo kanban.
- `china_documento_tarefa_vinculos` — caminho único de vínculo doc → tarefa.

---

## Mudanças no banco

1. **`fluxo_aprovacao_instancias`** — adicionar campos:
   - `tarefa_id uuid` (FK `projeto_tarefas`, ON DELETE CASCADE)
   - `secao_id uuid` (FK `projeto_secoes`, ON DELETE SET NULL) — para mover junto com a tarefa
   - `lote_nome text NOT NULL`
   - `prazo_lote date NULL`
   - `politica_movimentacao text NOT NULL DEFAULT 'continuar'` (`continuar` | `reiniciar_etapa`)
2. **`fluxo_aprovacao_etapas`** — adicionar:
   - `prazo_dias integer NULL` (prazo da etapa contado a partir da entrada nela)
3. **Nova `fluxo_aprovacao_lote_documentos`**: `instancia_id`, `documento_id` (FK `china_produto_documentos`), `vinculo_tarefa_id` (FK `china_documento_tarefa_vinculos`), `ordem`, `created_by`, `created_at`. UNIQUE `(instancia_id, documento_id)`.
4. **Nova `fluxo_aprovacao_etapa_eventos`** (snapshot por etapa/rodada): `instancia_id`, `etapa_ordem`, `rodada`, `entrou_em`, `prazo_em`, `concluido_em`, `decisao` (`aprovado` | `rejeitado` | `pendente`), `responsavel_id`, `comentario`, `assinado_em`. Permite contagem clara de R1/R2/R3 e SLA por etapa.
5. **`china_documento_tarefa_vinculos`** — coluna opcional `lote_instancia_id` para indicar a qual lote o doc está acoplado (NULL = vinculado mas sem aprovação).
6. **RLS**:
   - `fluxo_aprovacao_instancias`/`etapa_eventos`/`lote_documentos`: SELECT/INSERT/UPDATE para membros do projeto da tarefa (semi-join via `EXISTS` em `projeto_membros` ∪ admin/supervisor) e DELETE para `created_by` ∪ admin.
   - Políticas seguem padrão `(select auth.uid())` (perf RLS).
7. **Trigger `trg_log_aprovacao_atividade`** após INSERT/UPDATE em `etapa_eventos` e em `instancias.tarefa_id/secao_id` → escreve em `projeto_atividades` com `tipo` apropriado (`aprovacao_etapa_avancada`, `aprovacao_rejeitada_rodada`, `aprovacao_lote_movido_secao`).
8. **Função RPC `rpc_avancar_etapa_aprovacao(instancia_id, decisao, comentario)`** SECURITY DEFINER: valida permissão do responsável atual, fecha o evento atual, abre o próximo (ou volta ao anterior em rejeição incrementando `rodada`).
9. **Função RPC `rpc_mover_lote_para_tarefa(instancia_id, nova_tarefa_id)`** SECURITY DEFINER: aplica `politica_movimentacao` (continuar = mantém etapa; reiniciar_etapa = abre novo evento na etapa atual com `rodada+1`); registra atividade.
10. **Backfill (one-shot)**: para cada `china_ficha_despachos` ainda aberto, criar uma `instancia` órfã ligada à tarefa "Pendentes legados" do projeto correspondente (ou marcar como concluído se já vencido) — script de migração com dry-run.

> Migrações em **uma transação por etapa** (criação de colunas/tabelas → backfill → drop das tabelas legadas). O drop das tabelas legadas só após uma release de validação.

---

## Mudanças no frontend

**Novos**
- `src/components/projetos/aprovacoes/LoteAprovacaoKanban.tsx` — kanban horizontal (dnd-kit), colunas = etapas, card = lote.
- `src/components/projetos/aprovacoes/LoteAprovacaoCard.tsx` — mostra docs anexos, rodada atual, responsável, prazo, ações (Aprovar / Rejeitar / Reatribuir).
- `src/components/projetos/aprovacoes/CriarLoteDialog.tsx` — escolha de template + override de etapas + seleção dos docs vinculados disponíveis na tarefa.
- `src/components/projetos/aprovacoes/EditarTemplateAlcadaDialog.tsx` — override pontual de etapas/responsáveis para o lote sem editar o template global.
- `src/components/projetos/tarefa-detalhe/TarefaAprovacoesSection.tsx` — nova aba/seção dentro do detalhe da tarefa, lista lotes + botão "Novo lote".
- `src/hooks/useLoteAprovacao.ts`, `useTemplateAlcadas.ts`.
- `src/pages/admin/TemplatesAlcadas.tsx` — substitui FluxoAprovacaoConfig (gerencia templates globais reutilizáveis = `fluxo_aprovacao_config` + etapas).

**Alterados**
- `ProjetoVincularChina.tsx`: remover botão "Despachar para Módulo"; deixar apenas "Vincular a tarefa". Adicionar atalho "Vincular e abrir lote de aprovação".
- `VincularChinaRowAction.tsx`, `VincularChinaBulkActions.tsx`: idem.
- `ProjetoTarefaDetalhe.tsx`: adicionar nova aba "Aprovações" (entre "Documentos da China" e "Atividades").
- `TarefaChinaDocsSection.tsx`: cada doc passa a mostrar o badge do lote em que está e o status da etapa (Em rev., Aprovador 1, etc.).
- Substituir `window.open` por `triggerBlobDownload` (alinha com Core: `StoragePreviewDialog`).
- `App.tsx`: remover rotas de `/fluxo-aprovacao*` e `/fluxo-artes*`; adicionar `/admin/templates-alcadas`.

---

## Detalhes técnicos

- **Movimentação**: `politica_movimentacao` por template (`continuar` | `reiniciar_etapa`). A coluna fica em `fluxo_aprovacao_instancias` para permitir override por lote.
- **Rodadas**: o número da rodada é derivado de `MAX(rodada)` em `fluxo_aprovacao_etapa_eventos` para `(instancia_id, etapa_ordem)`. Rejeição cria novo evento com `rodada+1` na etapa anterior.
- **Prazos**:
  - Tarefa: já há `prazo_em` em `projeto_tarefas`.
  - Lote: `fluxo_aprovacao_instancias.prazo_lote`.
  - Etapa: `fluxo_aprovacao_etapas.prazo_dias` → `etapa_eventos.prazo_em = entrou_em + prazo_dias` (calculado em `America/Sao_Paulo` com `parseLocalDate`).
  - Badge de atraso: vermelho quando `prazo_em < now()` e `decisao = 'pendente'`.
- **Notificações**: ao abrir um evento, dispara entrada em `projeto_atividades` com `user_id = responsavel_id` (já há `lida` boolean para inbox).
- **Auditoria**: trigger garante log para todo movimento, sem depender da UI.
- **Permissão**: usuário vê o kanban se for membro do projeto (já controlado por RLS de `projeto_tarefas`); só o responsável da etapa atual (ou admin/supervisor) pode chamar `rpc_avancar_etapa_aprovacao`.
- **Templates**: continuam em `fluxo_aprovacao_config` + `fluxo_aprovacao_etapas`. Tela admin substitui as 3 telas legadas. `checklist_tipo` vira `categoria` livre (artes, ficha, embalagem, fiscal…) só para filtro/busca.
- **Performance**: índices em `fluxo_aprovacao_instancias(tarefa_id)`, `etapa_eventos(instancia_id, etapa_ordem, rodada)`, `lote_documentos(instancia_id)`.
- **Realtime**: adicionar `fluxo_aprovacao_instancias` e `fluxo_aprovacao_etapa_eventos` ao `supabase_realtime` para atualização ao vivo do kanban.
- **Feature flag**: `VITE_LEGACY_DESPACHO_MODULO` (default `false`). Se `true`, mantém botões legados visíveis durante 1 release para usuários com lotes em andamento.

---

## Diagrama de fluxo

```text
[Vincular China]
      │
      ▼ (escolhe documentos + tarefa)
[china_documento_tarefa_vinculos] ─── doc(s) ligados à tarefa
      │
      ▼ (na tarefa: aba "Aprovações" → "Novo lote")
[fluxo_aprovacao_instancias] (lote)
   ├─ etapas (snapshot do template, com override)
   ├─ documentos (fluxo_aprovacao_lote_documentos)
   └─ eventos por etapa (etapa_eventos: rodada, decisao, prazo)
      │
      ▼ ações: aprovar / rejeitar / reatribuir / mover seção
[rpc_avancar_etapa_aprovacao]   [rpc_mover_lote_para_tarefa]
      │
      ▼ trigger
[projeto_atividades] (log automático)
```

---

## Plano em fases (entregáveis sequenciais)

**Fase 1 — Schema & motor (sem UI nova ainda)**
- Migration: novas colunas/tabelas/índices/RPC/triggers + RLS.
- Adiciona realtime nas 2 tabelas.
- Sem impacto no usuário (UI legada continua).

**Fase 2 — Tela admin nova + remoção das telas legadas de Fluxo de Aprovação**
- Cria `/admin/templates-alcadas`.
- Remove `FluxoAprovacaoConfig`, `FluxoAprovacaoDetalhe`, `FluxoAprovacaoArtes`, `FluxoArtesMotor`, `useFluxoAprovacaoArtes` e rotas correspondentes.

**Fase 3 — Kanban de aprovação dentro da tarefa**
- Cria `TarefaAprovacoesSection`, `LoteAprovacaoKanban`, `LoteAprovacaoCard`, `CriarLoteDialog`, hooks.
- Integra na aba do `ProjetoTarefaDetalhe`.
- Atualiza `TarefaChinaDocsSection` para mostrar status de lote.

**Fase 4 — Substituição na tela Vincular China**
- Remove `DespachoModuloDialog`, `DespachoFichaDialog`, `useDespachoDocumentos`, constante `DESPACHO_MODULOS` e mutation `useDespacharModulo`.
- Atualiza `VincularChinaRowAction`, `VincularChinaBulkActions`, `ProjetoVincularChina`, `ChinaPastaDigitalPanel`, `ChinaSubmissaoExpandido`.
- Substitui `window.open` por `triggerBlobDownload` em `TarefaChinaDocsSection`.

**Fase 5 — Backfill e drop das tabelas legadas**
- Script de migração de despachos abertos para lotes equivalentes (com dry-run e relatório).
- Drop de `china_ficha_despachos`, `process_despacho_documento`, `process_despacho_transicoes`, `process_modulos_despacho` e edge functions associadas.
- Remove `VITE_LEGACY_DESPACHO_MODULO`.

**Fase 6 — Memória e changelog**
- Nova memória `mem://features/projects/kanban-alcadas-aprovacao` documentando: lotes, rodadas, política de movimentação, RPCs.
- Atualiza `mem://features/projects/regulatory-and-art-approval-logic` apontando para o novo fluxo.
- Entrada no changelog `ApiDocumentation.tsx` (regra `release-changelog-discipline`).
- Atualiza `docs/onboarding/` com diagrama do novo fluxo.

---

## Critérios de aceite

- Não existe mais nenhum botão "Despachar para Módulo" na UI.
- Toda aprovação de documento China acontece dentro da tarefa, com kanban visível.
- Rejeição cria visivelmente Rodada 2/3 no card; rodada zerada nunca regride.
- Mover tarefa de seção move o lote junto, respeitando `politica_movimentacao` do template.
- Cada ação (criar lote, aprovar, rejeitar, mover) aparece em `projeto_atividades` sem chamada manual da UI.
- Tabelas legadas de despacho não recebem mais escrita (verificável por `pg_stat_user_tables`).
- Build verde, RLS E2E (`scripts/security/*`) passa, lints sem novos avisos.
