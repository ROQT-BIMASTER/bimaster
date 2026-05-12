# QA — Módulo Fábrica China (walkthrough end-to-end)

> Data: 2026-05-12 · Escopo: ciclo completo Submissão → Checklist → Envio → OC → OP → Embarque → Container → Recebimento → NC.
> Método: revisão de código por tela + queries diretas no banco. Bugs visuais marcados como "alto" só quando bloqueiam a leitura/decisão.

---

## Resumo executivo (top 10)

| # | Severidade | Tela | Achado |
|---|---|---|---|
| 1 | **alto** | Múltiplas (Submissão, Ficha, Ordem, Embarque) | Downloads de documentos abrem `window.open(signedUrl)` em vez de `triggerBlobDownload`/`StoragePreviewDialog`, violando política `mem://architecture/storage-blob-download-protocol`. URLs assinadas vazam no histórico do navegador. |
| 2 | **alto** | `china_ordens_compra`, `china_embarques`, `china_recebimentos_carga`, `china_nao_conformidades` | RLS é puramente `auth.uid() IS NOT NULL` — qualquer usuário autenticado lê e escreve OCs/embarques/recebimentos/NCs de qualquer tenant. Falta semi-join por `submissao_id` ou `check_user_access`. |
| 3 | **alto** | `china_produto_submissoes` policy `china_sub_select` | `USING (true)` permite qualquer authenticated ler todas as submissões. Sem isolamento por marca/empresa. |
| 4 | médio | Inbox China | Notificação "pendente de envio" depende do `useEffect` em `useChinaMailbox`; após F5 o `notifiedRef` reseta e pode disparar toast novamente. Persistir set em `localStorage` por usuário. |
| 5 | médio | Pasta digital / envio ao Brasil | Não existe um log canônico de "submissão enviada"; era inferido pelo diff de status. Resolvido pelo trigger `trg_cte_submissoes` (status change) — mas chats e pareceres China ainda não geram evento na timeline. |
| 6 | médio | `useOCTimeline` | Não dedupe nem ordena cross-source; agora que existe `china_timeline_eventos`, refatorar para fonte única para evitar discrepâncias entre o inbox do comprador e demais telas. |
| 7 | médio | Checklist Focus Mode | Falta gate visível mostrando que a submissão só pode ir para "Liberada para OC" quando 100% dos itens estão `concluido` ou com waiver — botão `LiberarParaOCButton` precisa exibir tooltip do bloqueio. |
| 8 | médio | OP Drawer | `Nova OP` aceita criar OP para OC sem `qty_total > 0`, gerando OP fantasma. Validar Zod no front e via constraint. |
| 9 | baixo | Pátio Pronto p/ Embarque | Itens prontos não filtram por `qty_disponivel = qty_produzida - qty_alocada`. Pode mostrar item já totalmente alocado. |
| 10 | baixo | Torre Containers | Sync com Shipsgo não persiste evento na timeline; eventos de container só aparecem no `ContainerTimeline` interno. Adicionar `rpc_china_log_evento('container_evento', …)` no edge function `shipsgo-sync`. |

---

## Walkthrough por etapa

### 1. Dashboard Fábrica China (`/dashboard/fabrica-china`)
- **OK**: KPIs renderizam, atalhos funcionam.
- **Gap (baixo)**: contadores não usam realtime; só refetch on mount.

### 2. Nova Submissão (`/dashboard/fabrica-china/nova` e `/nova/:id`)
- **OK**: criação manual e via Excel funcionam, salva em `china_produto_submissoes`.
- **Bug (alto)**: download dos documentos anexados em rascunho usa `window.open(doc.arquivo_url)` — substituir por `StoragePreviewDialog` (linha 1057).
- **Gap (médio)**: Zod do formulário não usa `.strict()` em todos os schemas; risco de mass-assignment.
- **Recomendação**: ao submeter, gravar evento `submissao_criada` (já automatizado pelo trigger).

### 3. Checklist da Ficha (Focus Mode)
- **OK**: categorias padrão carregam, ajustáveis editáveis, governance panel mostra pesos/prazos.
- **Bug (médio)**: o painel de governança recém-criado (`ChecklistGovernancePanel`) já tem scroll interno, mas a aba "Conclusão da Ficha" ainda dispara reflow grande quando expandida pela primeira vez (devido a animation de `Collapsible`). Considerar `transition-all duration-200`.
- **Gap (médio)**: waivers não geram evento de timeline. Adicionar trigger em `china_checklist_item_estado` para `kind='waiver_aplicado'`.

### 4. Inbox China (`/dashboard/fabrica-china/caixa-entrada`)
- **OK**: pastas, filtros, snooze, estrela funcionam.
- **Bug (médio)**: `notifiedRef` reseta a cada F5 → o usuário pode receber o mesmo toast de "pendente de envio" repetidas vezes ao longo do dia. Persistir em `localStorage`.
- **OK (recente)**: rótulo com motivo (sem documento, sem parecer, rascunho) já implementado.

### 5. Pasta Digital + envio ao Brasil
- **OK**: envio individual e da submissão completa.
- **Gap (médio)**: contestação/parecer não logam evento canônico — adicionar chamada `rpc_china_log_evento('parecer_china', …)` no fluxo de pareceres.

### 6. Vincular China (Brasil)
- **OK**: aprovação/rejeição/vínculo a processo espelho.
- **Bug (alto)**: aprovação não exige `step-up auth` apesar de mudar produto fiscal — risco de erro irreversível.

### 7. Submissão Detalhe + Ficha Produto
- **OK**: visualização consolidada.
- **Bug (alto)**: `window.open` em downloads (linhas 81, 83 de Submissão; 182, 184, 1088 de Ficha). Migrar para Blob.
- **Melhoria**: agora têm o botão "Linha do tempo" no header (entregue neste ciclo).

### 8. Liberação para OC/OP
- **Gap (alto)**: o gate só valida `pesos==100` e `pendentes==0`, mas não checa se há documentos com status `rejeitado` pendentes. Documento rejeitado deveria bloquear a liberação.

### 9. Emitir OC → Inbox OC China
- **OK**: emissão funciona; aceite reflete em `oc_status`.
- **Bug (alto, RLS #2)**: qualquer authenticated edita qualquer OC. Restringir a `created_by = auth.uid() OR check_user_access(auth.uid(), 'fabrica')`.
- **Melhoria**: timeline da OC agora unifica eventos via `useChinaUnifiedTimeline({ ocId })`.

### 10. Ordens de Produção
- **OK**: criar OP, vincular OC↔OP, apontamentos.
- **Bug (médio)**: `NovaOPChinaDialog` não bloqueia OP com cores ausentes da OC; pode produzir cor inexistente.
- **Bug (baixo)**: `RegistrarApontamentoDialog` permite quantidade negativa (validar Zod `int().nonnegative()`).

### 11. Pátio Pronto p/ Embarque
- **Bug (baixo)**: ver #9 do top 10 — saldo disponível não considera alocações em containers abertos.

### 12. Embarque
- **OK**: criar embarque, embarque parcial, decisão de saldo.
- **Gap (médio)**: `EmbarqueParcialDialog` não cria registro em `china_oc_saldo_decisoes` quando o usuário escolhe "manter aberta" — precisa criar mesmo na decisão neutra para haver trilha de auditoria.

### 13. Torre de Containers + Container Detail
- **OK**: timeline do container, mapa de rota.
- **Melhoria**: agora há botão "Linha do tempo" também no Sheet do container, escopado por `containerId`.
- **Gap (baixo)**: edge function `shipsgo-sync` deveria gravar evento `container_evento` na nova tabela a cada update relevante.

### 14. Recebimentos + Monitor de Recebimentos OC
- **OK**: conferência, abertura de NC.
- **Bug (médio)**: `RecebimentoConferenciaDialog` permite `qty_recebida > qty_esperada` sem aviso — esperado é exigir motivo de divergência ou bloquear.

### 15. Divergências (NCs)
- **OK**: abertura, fechamento, vínculos.
- **Gap (médio)**: ao "resolver" uma NC, o status muda mas não cria evento de "resolução" com `resolucao` no payload — refinar trigger `trg_cte_nc` para incluir `payload.resolucao` quando status passar a `resolvida`.

### 16. Permissões/RLS (geral)
- **Crítico**: várias tabelas (`china_ordens_compra`, `china_embarques`, `china_recebimentos_carga`, `china_nao_conformidades`, `china_oc_saldo_decisoes`, `china_oc_custos`) têm policies do tipo `auth.uid() IS NOT NULL`. Para módulo cross-tenant (Brasil/China/Admin) é insuficiente. Próximo PR: trocar por semi-joins via `submissao_id → check_user_access('fabrica')` ou role-based via `has_role`.

---

## Linha do Tempo Unificada — entregue neste ciclo

- Tabela `china_timeline_eventos` (escopos: submissão, OC, OP, embarque, container, recebimento, NC).
- Função `rpc_china_log_evento` (`SECURITY DEFINER`, restrita a `authenticated`).
- Triggers automáticos em submissões, documentos, OCs, apontamentos, embarques, recebimentos e NCs.
- Backfill da história já existente.
- Hook `useChinaUnifiedTimeline(scope)` com realtime via `postgres_changes`.
- Componente `ChinaUnifiedTimeline` (Sheet com filtros por grupo + busca + agrupamento por dia).
- Botão padrão `ChinaTimelineButton` integrado em:
  - Submissão Detalhe (`/fabrica-china/submissao/:id`)
  - Ficha do Produto (`/fabrica-china/produto/:id`)
  - Checklist Embalagens (`/fabrica-china/produto/:id/checklist`)
  - Ordem de Compra Detalhe (`/fabrica-china/ordens/:id`)
  - Inbox — reading pane (Mailbox) — escopo por submissão selecionada
  - Container Detail Sheet — escopo por container
- `ChinaTimeline` antigo continua funcionando (não breaking) e pode ser substituído gradualmente.

## Próximos passos sugeridos

1. **PR de RLS** corrigindo as 6 tabelas listadas no top 10 #2/#3.
2. **PR de Blob downloads**: substituir `window.open` por `triggerBlobDownload` em todos os arquivos listados.
3. **PR de logging**: adicionar chamadas a `rpc_china_log_evento` em pontos sem trigger (parecer China, waivers, sync Shipsgo, decisão de saldo, resolução de NC).
4. **PR de validação**: Zod `.strict()` + `nonnegative()` em `NovaOPChinaDialog` e `RegistrarApontamentoDialog`; bloqueio de saldo já alocado no Pátio.
5. **PR opcional**: persistir `notifiedRef` do inbox em `localStorage` por usuário.
