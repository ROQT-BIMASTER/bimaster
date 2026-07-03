# Prompt Lovable — Suporte Help Desk · FASE 3A (Transferência entre departamentos)

> **Cole este prompt no Lovable.** Depende das **Fases 0, 1 e 2** aplicadas. Cria a **transferência de chamados entre filas/departamentos** com: trilha de auditoria (`suporte_transferencias`), SLA **recalculado para a fila destino**, agentes da nova fila adicionados à conversa (histórico preservado), **mensagem de sistema na thread** e **notificação ao solicitante** ("seu chamado foi encaminhado para X").
>
> **Impacto controlado:** apenas 1 RPC nova (`rpc_suporte_transferir`). Nenhum objeto existente é alterado. O frontend (botão Transferir no desk) vem por PR no repositório, atrás da mesma flag `ff_suporte_v2`.
>
> A **Fase 3B** (IA por fila com tool de transferência — generalização do `suporte-agente`) vem em prompt separado, depois desta validada.

## Contexto para o Lovable
Fase 3A do help desk multi-departamento (`docs/ARQUITETURA-SUPORTE-HELPDESK-MULTIDEPARTAMENTO.md`, §7.3). Regras de negócio da transferência (padrão de mercado — mesmo ticket, mesma thread, muda só a fila):

- **Mesmo ticket e mesma conversa** — nada é clonado; o histórico segue intacto.
- Ticket **resolvido não transfere** (reabra antes).
- Se estava **pausado** ("aguardando usuário"), o relógio **retoma** antes de transferir (usa `suporte_retomar_sla` da Fase 2).
- Na fila destino o chamado **volta para o pool**: `status='novo'`, `assignee_id=NULL`.
- **SLA recalculado** a partir de agora com a policy da **fila destino** (`suporte_recalcular_sla`). A 1ª resposta, se já aconteceu, **não** é recarimbada (métrica preservada).
- Agentes ativos da fila destino **entram como participantes** da conversa; os antigos permanecem (contexto de handoff).
- **Solicitante é notificado** via `notifications` + a thread ganha mensagem `tipo='sistema'` (o trigger da Fase 2 ignora mensagens de sistema — sem efeito colateral no SLA).
- `via_ia=false` nesta fase; a Fase 3B chamará **a mesma RPC** com `via_ia=true` (mesma trilha e mesma notificação para transferência humana e de IA).

## Instruções
Crie **uma migration** com o SQL abaixo (idempotente). Depois rode o smoke test e me reporte.

```sql
-- =====================================================================
-- SUPORTE HELP DESK — FASE 3A (transferência entre filas)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rpc_suporte_transferir(
  p_ticket_id    uuid,
  p_para_fila_id uuid,
  p_motivo       text DEFAULT NULL,
  p_via_ia       boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_t            record;
  v_fila_destino record;
  v_fila_origem  text;
  v_motivo       text := NULLIF(trim(coalesce(p_motivo,'')), '');
  v_requester    uuid;
BEGIN
  -- via_ia=true só via service_role (edge function da Fase 3B); client autenticado sempre false
  IF v_uid IS NULL AND NOT p_via_ia THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_via_ia AND v_uid IS NOT NULL THEN p_via_ia := false; END IF;

  SELECT t.id, t.fila_id, t.conversa_id, t.status, t.assignee_id, t.protocolo, t.titulo,
         COALESCE(t.requester_id, t.owner_id) AS requester_id
    INTO v_t
  FROM public.suporte_tickets t WHERE t.id = p_ticket_id;
  IF v_t.id IS NULL THEN RAISE EXCEPTION 'ticket nao encontrado'; END IF;
  IF v_t.status = 'resolvido' THEN RAISE EXCEPTION 'ticket resolvido nao pode ser transferido'; END IF;

  -- permissão: staff, ou agente da fila ATUAL (IA entra como service_role e passa direto)
  IF v_uid IS NOT NULL
     AND NOT (public.is_suporte_staff(v_uid) OR public.is_agente_fila(v_uid, v_t.fila_id)) THEN
    RAISE EXCEPTION 'sem permissao nesta fila';
  END IF;

  SELECT id, nome INTO v_fila_destino
  FROM public.suporte_filas
  WHERE id = p_para_fila_id AND ativo AND aceita_chamados;
  IF v_fila_destino.id IS NULL THEN RAISE EXCEPTION 'fila destino invalida ou nao aceita chamados'; END IF;
  IF v_fila_destino.id = v_t.fila_id THEN RAISE EXCEPTION 'ticket ja esta nesta fila'; END IF;

  SELECT nome INTO v_fila_origem FROM public.suporte_filas WHERE id = v_t.fila_id;
  v_requester := v_t.requester_id;

  -- se estava pausado, retoma o relógio antes de recalcular para a nova fila
  IF v_t.status = 'aguardando_usuario' THEN
    PERFORM public.suporte_retomar_sla(p_ticket_id);
  END IF;

  -- trilha de transferência
  INSERT INTO public.suporte_transferencias
    (ticket_id, de_fila_id, para_fila_id, de_assignee_id, para_assignee_id, motivo, via_ia, transferido_por)
  VALUES
    (p_ticket_id, v_t.fila_id, v_fila_destino.id, v_t.assignee_id, NULL, v_motivo, p_via_ia, v_uid);

  -- move o ticket: nova fila, volta ao pool
  UPDATE public.suporte_tickets
     SET fila_id = v_fila_destino.id,
         assignee_id = NULL,
         status = 'novo',
         ultima_interacao_em = now()
   WHERE id = p_ticket_id;

  -- SLA da fila destino, contado a partir de agora
  PERFORM public.suporte_recalcular_sla(p_ticket_id, now());

  -- agentes ativos da fila destino entram na conversa (histórico preservado)
  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  SELECT v_t.conversa_id, fa.user_id, 'membro'
  FROM public.suporte_fila_agentes fa
  WHERE fa.fila_id = v_fila_destino.id AND fa.ativo
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  -- mensagem de sistema na thread (trigger de SLA ignora tipo='sistema')
  INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, ticket_id, ticket_owner_id, visibilidade, metadata)
  VALUES (
    v_t.conversa_id,
    COALESCE(v_uid, v_requester),
    '🔁 Chamado transferido: ' || COALESCE(v_fila_origem,'?') || ' → ' || v_fila_destino.nome
      || COALESCE(E'\nMotivo: ' || v_motivo, ''),
    'sistema',
    p_ticket_id, v_requester, 'broadcast',
    jsonb_build_object('transferencia', true, 'de_fila', v_t.fila_id, 'para_fila', v_fila_destino.id, 'via_ia', p_via_ia)
  );

  -- notifica o solicitante (requisito: usuário de origem informado do status)
  IF v_requester IS NOT NULL AND v_requester <> COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (
      v_requester, 'suporte_transferencia', 'Chamado encaminhado',
      'Seu chamado ' || COALESCE(v_t.protocolo,'') || ' — ' || COALESCE(v_t.titulo,'') ||
      ' foi encaminhado para ' || v_fila_destino.nome || ' e voltou ao status "Novo".',
      '/dashboard/suporte'
    );
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'transferencia',
          jsonb_build_object('de', v_t.fila_id, 'para', v_fila_destino.id, 'motivo', v_motivo, 'via_ia', p_via_ia));

  RETURN jsonb_build_object('ok', true, 'para_fila', v_fila_destino.nome);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_transferir(uuid,uuid,text,boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_transferir(uuid,uuid,text,boolean) TO authenticated;
```

## Smoke test (rode e me mande o resultado)

```sql
-- (a) RPC existe com a assinatura certa
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc WHERE proname = 'rpc_suporte_transferir';

-- (b) ACL: sem PUBLIC/anon
SELECT proacl FROM pg_proc WHERE proname = 'rpc_suporte_transferir';
```

**Teste funcional (no app, flag ligada — fecha a fase):**
1. Abrir chamado no **Fiscal** → no desk, **Transferir** para **Compras** com motivo.
2. Conferir: card mudou para a aba Compras com status **Novo** e prazos novos; thread ganhou a mensagem 🔁; sino do solicitante recebeu "Chamado encaminhado"; e:

```sql
SELECT tr.created_at, fo.nome AS de_fila, fd.nome AS para_fila, tr.motivo, tr.via_ia
FROM public.suporte_transferencias tr
LEFT JOIN public.suporte_filas fo ON fo.id = tr.de_fila_id
JOIN public.suporte_filas fd ON fd.id = tr.para_fila_id
ORDER BY tr.created_at DESC LIMIT 5;
```

## Depois de aplicar
1. Me mande (a)–(b) + advisor.
2. O botão **Transferir** no desk já está no PR do frontend correspondente — com a RPC aplicada, funciona imediatamente.
3. Próximo: **Fase 3B** (IA por fila: generalização do `suporte-agente` com tool `transferir_departamento` chamando esta mesma RPC com `via_ia=true`).
