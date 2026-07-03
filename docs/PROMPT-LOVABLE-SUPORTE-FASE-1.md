# Prompt Lovable — Suporte Help Desk · FASE 1 (Backend: conversa por chamado + desk por fila)

> **Cole este prompt no Lovable.** Depende da **Fase 0** já aplicada. Adiciona as **RPCs** de abertura/atendimento de chamados (cada chamado ganha sua própria conversa de chat) e ajusta a **RLS de `suporte_tickets`** para o agente da fila enxergar os chamados dela. O frontend desta fase vem por **PR no repositório** (não por este prompt).
>
> **Impacto controlado:** a única alteração em objeto existente é (a) expandir o `CHECK` de `conversas.tipo` para aceitar `'suporte'` (aditivo — mantém todos os valores atuais) e (b) recriar as 2 policies de `suporte_tickets` incluindo o agente da fila (o desk de TI atual, que usa papel `suporte`/`admin`, continua funcionando). Nada no chat corporativo, no `suporte-agente` ou em `mensagens` muda.

## Contexto para o Lovable
Fase 1 do help desk multi‑departamento. Modelo: **1 conversa (`tipo='suporte'`) por chamado**, com o solicitante + os agentes ativos da fila como participantes — assim a RLS de `mensagens` já existente funciona sem alteração. Escrita de tickets passa a ser feita por RPCs `SECURITY DEFINER` (padrão do projeto, igual a `rpc_chat_aprovacao_*`). SLA em tempo real e canais (WhatsApp) **não** entram aqui. Arquitetura: `docs/ARQUITETURA-SUPORTE-HELPDESK-MULTIDEPARTAMENTO.md`.

## Instruções
Crie **uma migration** com o SQL abaixo (idempotente). Depois rode o smoke test do final e me diga o resultado.

```sql
-- =====================================================================
-- SUPORTE HELP DESK — FASE 1 (RPCs + RLS; conversa por chamado)
-- =====================================================================

-- ---------- 1. conversas.tipo aceita 'suporte' (aditivo) ----------
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_tipo_check;
ALTER TABLE public.conversas
  ADD CONSTRAINT conversas_tipo_check
  CHECK (tipo IN ('privada','grupo','private','group','suporte'));

-- ---------- 2. Realtime no suporte_tickets (desk atualiza ao vivo) ----------
ALTER TABLE public.suporte_tickets REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.suporte_tickets;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ---------- 3. RLS de suporte_tickets: incluir agente da fila ----------
DROP POLICY IF EXISTS "Owner e suporte veem tickets" ON public.suporte_tickets;
DROP POLICY IF EXISTS suporte_tickets_sel ON public.suporte_tickets;
CREATE POLICY suporte_tickets_sel ON public.suporte_tickets FOR SELECT TO authenticated
USING (
  requester_id = auth.uid()
  OR owner_id = auth.uid()
  OR public.is_suporte_staff(auth.uid())
  OR public.is_agente_fila(auth.uid(), fila_id)
);

DROP POLICY IF EXISTS "Suporte atualiza tickets" ON public.suporte_tickets;
DROP POLICY IF EXISTS suporte_tickets_upd ON public.suporte_tickets;
CREATE POLICY suporte_tickets_upd ON public.suporte_tickets FOR UPDATE TO authenticated
USING (
  public.is_suporte_staff(auth.uid())
  OR public.is_agente_fila(auth.uid(), fila_id)
);

-- ---------- 4. RPC: abrir chamado (cria conversa + ticket + participantes) ----------
CREATE OR REPLACE FUNCTION public.rpc_suporte_abrir_chamado(
  p_fila_id    uuid,
  p_titulo     text,
  p_descricao  text DEFAULT NULL,
  p_prioridade text DEFAULT 'media'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_conversa_id uuid;
  v_ticket_id   uuid;
  v_protocolo   text;
  v_titulo      text;
  v_prio        text := coalesce(p_prioridade,'media');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suporte_filas WHERE id = p_fila_id AND ativo AND aceita_chamados) THEN
    RAISE EXCEPTION 'fila invalida ou nao aceita chamados';
  END IF;
  IF v_prio NOT IN ('baixa','media','alta','critica') THEN v_prio := 'media'; END IF;
  v_titulo := trim(coalesce(p_titulo,''));
  IF v_titulo = '' THEN RAISE EXCEPTION 'titulo obrigatorio'; END IF;
  IF length(v_titulo) > 200 THEN v_titulo := substr(v_titulo,1,200); END IF;

  -- conversa dedicada do chamado
  INSERT INTO public.conversas (nome, tipo, criado_por)
  VALUES (left('Chamado: ' || v_titulo, 120), 'suporte', v_uid)
  RETURNING id INTO v_conversa_id;

  -- participante: solicitante
  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  VALUES (v_conversa_id, v_uid, 'membro')
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  -- participantes: agentes ativos da fila
  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  SELECT v_conversa_id, fa.user_id, 'membro'
  FROM public.suporte_fila_agentes fa
  WHERE fa.fila_id = p_fila_id AND fa.ativo AND fa.user_id <> v_uid
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  -- ticket
  INSERT INTO public.suporte_tickets (conversa_id, owner_id, requester_id, fila_id, canal, status, prioridade, titulo)
  VALUES (v_conversa_id, v_uid, v_uid, p_fila_id, 'chat_interno', 'novo', v_prio, v_titulo)
  RETURNING id INTO v_ticket_id;

  -- protocolo determinístico (mesmo formato do suporte-agente)
  v_protocolo := 'RR-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(v_ticket_id::text,'-',''),1,6));
  UPDATE public.suporte_tickets SET protocolo = v_protocolo WHERE id = v_ticket_id;

  -- primeira mensagem (descrição), se houver
  IF coalesce(trim(p_descricao),'') <> '' THEN
    INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, ticket_id, ticket_owner_id, visibilidade)
    VALUES (v_conversa_id, v_uid, p_descricao, 'texto', v_ticket_id, v_uid, 'broadcast');
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (v_ticket_id, 'abertura', jsonb_build_object('fila_id', p_fila_id, 'canal','chat_interno','prioridade', v_prio));

  RETURN jsonb_build_object('ticket_id', v_ticket_id, 'conversa_id', v_conversa_id, 'protocolo', v_protocolo);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) TO authenticated;

-- ---------- 5. RPC: assumir chamado ----------
CREATE OR REPLACE FUNCTION public.rpc_suporte_assumir(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_fila_id uuid;
  v_conv_id uuid;
  v_status  text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT fila_id, conversa_id, status INTO v_fila_id, v_conv_id, v_status
    FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket nao encontrado'; END IF;
  IF NOT (public.is_suporte_staff(v_uid) OR public.is_agente_fila(v_uid, v_fila_id)) THEN
    RAISE EXCEPTION 'sem permissao nesta fila';
  END IF;

  -- garante participação do agente na conversa
  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  VALUES (v_conv_id, v_uid, 'membro')
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  UPDATE public.suporte_tickets
     SET assignee_id = v_uid,
         status = CASE WHEN status = 'novo' THEN 'em_atendimento' ELSE status END,
         ultima_interacao_em = now()
   WHERE id = p_ticket_id;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'assumir', jsonb_build_object('assignee_id', v_uid));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_assumir(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_assumir(uuid) TO authenticated;

-- ---------- 6. RPC: mudar status ----------
CREATE OR REPLACE FUNCTION public.rpc_suporte_mudar_status(p_ticket_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_fila_id   uuid;
  v_status_at text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_status NOT IN ('novo','em_triagem','em_atendimento','aguardando_usuario','escalado','resolvido') THEN
    RAISE EXCEPTION 'status invalido';
  END IF;
  SELECT fila_id, status INTO v_fila_id, v_status_at
    FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket nao encontrado'; END IF;
  IF NOT (public.is_suporte_staff(v_uid) OR public.is_agente_fila(v_uid, v_fila_id)) THEN
    RAISE EXCEPTION 'sem permissao nesta fila';
  END IF;

  UPDATE public.suporte_tickets
     SET status = p_status,
         resolved_at = CASE WHEN p_status = 'resolvido' THEN now() ELSE resolved_at END,
         reaberto_em = CASE WHEN v_status_at = 'resolvido' AND p_status <> 'resolvido' THEN now() ELSE reaberto_em END,
         escalado_em = CASE WHEN p_status = 'escalado' THEN now() ELSE escalado_em END,
         ultima_interacao_em = now()
   WHERE id = p_ticket_id;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'mudar_status', jsonb_build_object('de', v_status_at, 'para', p_status));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) TO authenticated;
```

## Smoke test (rode e me mande o resultado)

```sql
-- (a) as 3 RPCs existem
SELECT proname FROM pg_proc
WHERE proname IN ('rpc_suporte_abrir_chamado','rpc_suporte_assumir','rpc_suporte_mudar_status')
ORDER BY proname;   -- esperado: 3 linhas

-- (b) o CHECK de conversas aceita 'suporte'
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'conversas_tipo_check';
-- esperado: CHECK ... tipo IN ('privada','grupo','private','group','suporte')

-- (c) policies novas de suporte_tickets
SELECT policyname FROM pg_policies WHERE tablename = 'suporte_tickets' ORDER BY policyname;
-- esperado incluir: suporte_tickets_sel, suporte_tickets_upd

-- (d) teste funcional: abrir um chamado na fila Fiscal como o usuário logado
--     (rode logado no app; deve retornar {ticket_id, conversa_id, protocolo})
SELECT public.rpc_suporte_abrir_chamado(
  (SELECT id FROM public.suporte_filas WHERE slug='fiscal'),
  'Teste de abertura de chamado', 'Descrição de teste', 'media'
);
```

## Depois de aplicar
1. Me confirme os resultados (a)–(d).
2. Rode o **advisor de segurança** e me diga se apontou algo novo.
3. Vou abrir o **PR (draft) com o frontend** desta fase (telas de abrir chamado, meus chamados e o painel do agente por fila, atrás da flag `suporte_v2`).
