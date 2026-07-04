# Prompt Lovable — Suporte · Correções da revisão pós-entrega (Membros + Fluxo + Analytics)

> **Cole no Lovable e aplique tudo.** Revisão adversarial da main encontrou os itens abaixo. O núcleo das entregas está correto (confirmado por diff) — estas são correções pontuais. **Os 3 primeiros itens são os críticos.**

## PARTE 1 — Migration de correções

### 1.1 🔴 `rpc_suporte_bulk_update` — parar de bypassar a máquina de SLA e a transferência canônica
A RPC de ações em lote (entrega extra, sem spec) muda status por UPDATE manual e transfere sem os efeitos canônicos. Consequências: ticket que sai de "aguardando usuário" em lote fica **pausado para sempre** (`sla_pausado_em` preso); resolver em lote **não** apura `cumprido/violado` (subnotifica o % SLA do dashboard); reabrir em lote **apaga** `resolved_at`; e a transferência em lote tem **furo de autorização** (agente da fila DESTINO pode puxar tickets em massa de qualquer fila) além de não resetar status/SLA/participantes/notificação.

**Correção — recriar `rpc_suporte_bulk_update` delegando às funções canônicas:**
- Mudança de **status**: substituir o UPDATE manual de `status/resolved_at/...` por `PERFORM public.suporte_aplicar_status(v_ticket_id, v_new_status, auth.uid());` (mantém UPDATE manual apenas para `assignee_id`/`prioridade`).
- Mudança de **fila**: substituir o UPDATE manual por chamada à RPC canônica, por ticket, com tolerância a erro individual:
```sql
BEGIN
  PERFORM public.rpc_suporte_transferir(v_ticket_id, v_new_fila_id, 'Transferência em lote', false);
  v_ok := v_ok + 1;
EXCEPTION WHEN OTHERS THEN
  v_erros := v_erros + 1;  -- ex.: resolvido não transfere; sem permissão na fila de ORIGEM
END;
```
Isso restaura permissão pela fila de **origem**, reset para `novo`, recálculo de SLA, participantes da fila destino, mensagem 🔁 e notificação ao solicitante — tudo que a transferência unitária já faz. Retornar `{ok, erros}` no jsonb.
- Se mudar prioridade em lote: após o UPDATE, `PERFORM public.suporte_recalcular_sla(v_ticket_id, now())` **apenas** se o ticket ainda não teve primeira resposta e não está resolvido (prioridade nova ⇒ policy nova).

### 1.2 🔴 `suporte_views` — fechar o WITH CHECK
Qualquer authenticated consegue criar view com `escopo='fila'` de fila da qual não é membro (aparece para os agentes daquela fila — spoofing de views "oficiais"). Recriar a policy de escrita com:
```sql
WITH CHECK (
  owner_id = auth.uid()
  AND (
    escopo <> 'fila'
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.is_agente_fila(auth.uid(), fila_id)
  )
)
```

### 1.3 🔴 `rpc_suporte_fila_membro` v2 — brecha do último líder + sincronização com o projeto
Duas correções (a primeira é brecha da própria spec original — atualizada):
- **(a)** O upsert do ramo `adicionar` permite rebaixar o último líder por fora do guard (re-adicionar um líder ativo com `p_papel='agente'` troca o papel sem checagem). Corrigir o ON CONFLICT para **preservar o papel de quem já está ativo**:
```sql
ON CONFLICT (fila_id, user_id) DO UPDATE
  SET ativo = true,
      papel = CASE WHEN suporte_fila_agentes.ativo
                   THEN suporte_fila_agentes.papel   -- ativo mantém papel (mudar papel é só via p_acao='papel')
                   ELSE EXCLUDED.papel END;
```
- **(b)** Sincronizar papel no projeto vinculado: no bloco `projeto_membros` do `adicionar`, trocar `ON CONFLICT DO NOTHING` por **promover-nunca-rebaixar**; e replicar o mesmo upsert no ramo `papel` quando `p_papel='lider'`:
```sql
ON CONFLICT (projeto_id, user_id) DO UPDATE
  SET papel = CASE WHEN projeto_membros.papel = 'coordenador'
                   THEN 'coordenador' ELSE EXCLUDED.papel END;
```
- **(c)** Aproveitar a recriação para trocar o bloco `EXECUTE` dinâmico + probe em `information_schema` pelo **INSERT estático** (a coluna `suporte_filas.projeto_id` agora existe permanentemente; o probe é custo de catálogo a cada chamada, sem função).

### 1.4 🟡 Trigger `suporte_on_tarefa_secao` — action_url da notificação
A notificação vai para o **solicitante**, mas aponta para `/dashboard/suporte/desk` (tela do agente). Recriar a função com `action_url = '/dashboard/suporte'` (Meus Chamados). Só essa linha muda.

### 1.5 🟡 Reafirmar ACL do `rpc_suporte_abrir_chamado`
A última recriação não reafirmou grants (funciona por herança do CREATE OR REPLACE, mas é frágil). Acrescentar:
```sql
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) TO authenticated;
```
E adotar como regra: **todo** CREATE OR REPLACE de função reafirma REVOKE/GRANT na mesma migration.

## PARTE 2 — Correções de frontend

1. 🔴 **Excel sem auditoria** — `SuporteAnalisesBuilder.handleXlsx` instancia ExcelJS na mão; trocar por `exportToExcel` de `src/utils/excelExport.ts` (integra `auditExport` — trilha de auditoria de exports, exigência da spec §2.7).
2. 🔴 **Menu admin duplicado** — remover `<MenuItemLink to="/admin/suporte" ...>` do `AppSidebar.tsx` (linha ~1503, seção Sistema & Integrações). O redirect em `App.tsx` cobre URLs antigas. Hoje o admin vê duas "Central de Suporte".
3. 🔴 **Filtros do construtor ausentes** — adicionar Selects de **canal, prioridade e categoria** no card Construtor (a RPC e o hook já aceitam `p_canal/p_prioridade/p_categoria`), incluir no `config` da análise salva e reaplicar em `aplicarSalva()`.
4. 🔴 **Minhas análises × Do departamento** — separar em dois cards por `a.user_id === user.id`; excluir/renomear/compartilhar **só para o dono** (a condição atual `a.compartilhada !== undefined` é sempre true — lixeira aparece em análise de terceiros e o DELETE é bloqueado silenciosamente pela RLS); ligar o `useToggleCompartilhar` (existe e nunca é usado) a um switch na linha.
5. 🟡 **CsatPrompt no drawer do agente** — em `SuporteTicketDrawer`, o prompt aparece para o agente e o INSERT falha por RLS (só o solicitante pode avaliar). Condicionar a `(ticket.requester_id ?? ticket.owner_id) === user?.id` ou remover do drawer (a coleta canônica é em Meus Chamados).
6. 🟡 **Período "personalizado"** — adicionar a opção com DateRangePicker no período global do `SuporteDesk` (spec §2.3; hoje só 7/30/90).
7. 🟡 **Invalidação errada** — `useFilaMembros.ts:94` invalida `["suporte","chamados-desk"]`, mas a query real é `["suporte","desk",...]`. Corrigir para `qc.invalidateQueries({ queryKey: ["suporte","desk"] })`.
8. 🟡 **Badge de contagem no botão Membros** — spec §2.1: exibir `<Badge>{n}</Badge>` com membros ativos da fila selecionada.
9. 🟡 **TicketEtapaBadge no modo split** — o badge de etapa só existe no drawer; adicionar também no header do modo split (ao lado do protocolo), com o link "ver no projeto".
10. 🟡 **Ícone no NovoDepartamentoDialog** — o campo existe na RPC mas a UI não o expõe (envia sempre null); adicionar seletor simples de ícone lucide (como as filas seed usam) — ou informar que decidimos cortá-lo.

## Smoke pós-correção
```sql
-- (a) bulk delega às canônicas (grep na prosrc)
SELECT proname,
       prosrc LIKE '%suporte_aplicar_status%'  AS usa_aplicar_status,
       prosrc LIKE '%rpc_suporte_transferir%'  AS usa_transferir
FROM pg_proc WHERE proname = 'rpc_suporte_bulk_update';
-- (b) trigger notifica para /dashboard/suporte
SELECT prosrc LIKE '%''/dashboard/suporte''%' FROM pg_proc WHERE proname = 'suporte_on_tarefa_secao';
-- (c) membro: upsert preserva papel de ativo
SELECT prosrc LIKE '%suporte_fila_agentes.papel%' FROM pg_proc WHERE proname = 'rpc_suporte_fila_membro';
```
**Teste funcional dos críticos:** (1) em lote: mover 2 chamados "aguardando usuário" para "em atendimento" → `sla_pausado_em` limpo e prazos estendidos; (2) como agente só do Fiscal, tentar transferência em lote de chamados do RH → erro/contabilizado em `erros`; (3) exportar Excel de uma análise → registro em auditoria de exports.
