# Prompt Lovable — Suporte · Departamentos configuráveis + Fluxo Kanban (integração com Projetos)

> **Cole no Lovable.** Depende das Fases 0–3B (e idealmente das specs Central/Analytics/Membros já construídas — todas mexem no header da Central; aplicar esta por último). Entrega duas capacidades pedidas pelo usuário:
>
> **(A) Departamentos configuráveis** — criar novos departamentos (filas) pela UI, sem SQL.
> **(B) Fluxo de chamado via Kanban de Projetos** — vincular um departamento a um **projeto**; as **seções do kanban** do projeto viram as etapas do fluxo do chamado, e **cada etapa tem mensagem automática configurável** enviada ao solicitante quando o card se move (ex.: mover para "Em análise" → o solicitante recebe "já tem alguém trabalhando no seu chamado").
>
> A ponte já existe no schema: `suporte_tickets.projeto_tarefa_id` (o desk de TI legado já cria tarefas em projeto). Esta spec generaliza: **chamado novo vira card** no projeto do departamento, e o **card dirige a comunicação**.
>
> **Direção do fluxo (v1): kanban → chamado** (mover card atualiza chamado/mensagem/notificação). Mudar status pelo desk NÃO move o card (evita loop de sincronização; bidirecional é evolução futura documentada).

## PARTE 1 — Migration

```sql
-- =====================================================================
-- SUPORTE — fluxo kanban por departamento (integração com Projetos)
-- =====================================================================

-- ---------- 1. Vínculo fila ↔ projeto ----------
ALTER TABLE public.suporte_filas
  ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_criar_tarefa boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_suporte_tickets_tarefa
  ON public.suporte_tickets(projeto_tarefa_id) WHERE projeto_tarefa_id IS NOT NULL;

-- ---------- 2. Mensagens automáticas por etapa do kanban ----------
CREATE TABLE IF NOT EXISTS public.suporte_etapa_mensagens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fila_id    uuid NOT NULL REFERENCES public.suporte_filas(id) ON DELETE CASCADE,
  secao_id   uuid NOT NULL REFERENCES public.projeto_secoes(id) ON DELETE CASCADE,
  mensagem   text CHECK (length(coalesce(mensagem,'')) <= 1000),
  -- placeholders suportados: {protocolo} {titulo} {etapa} {departamento}
  status_map text CHECK (status_map IN ('novo','em_triagem','em_atendimento','aguardando_usuario','escalado','resolvido')),
  notificar  boolean NOT NULL DEFAULT true,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fila_id, secao_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suporte_etapa_mensagens TO authenticated;
GRANT ALL ON public.suporte_etapa_mensagens TO service_role;

ALTER TABLE public.suporte_etapa_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sup_etapa_msg_sel ON public.suporte_etapa_mensagens;
CREATE POLICY sup_etapa_msg_sel ON public.suporte_etapa_mensagens FOR SELECT TO authenticated USING (true);
-- escrita: admin OU líder ativo da fila
DROP POLICY IF EXISTS sup_etapa_msg_write ON public.suporte_etapa_mensagens;
CREATE POLICY sup_etapa_msg_write ON public.suporte_etapa_mensagens FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
             WHERE fa.fila_id = suporte_etapa_mensagens.fila_id
               AND fa.user_id = auth.uid() AND fa.ativo AND fa.papel = 'lider')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
             WHERE fa.fila_id = suporte_etapa_mensagens.fila_id
               AND fa.user_id = auth.uid() AND fa.ativo AND fa.papel = 'lider')
);

DROP TRIGGER IF EXISTS trg_sup_etapa_msg_updated ON public.suporte_etapa_mensagens;
CREATE TRIGGER trg_sup_etapa_msg_updated BEFORE UPDATE ON public.suporte_etapa_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 3. Efeitos de status extraídos (RPC e trigger usam a MESMA lógica) ----------
CREATE OR REPLACE FUNCTION public.suporte_aplicar_status(
  p_ticket_id uuid, p_status text, p_ator uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status_at text;
BEGIN
  IF p_status NOT IN ('novo','em_triagem','em_atendimento','aguardando_usuario','escalado','resolvido') THEN
    RAISE EXCEPTION 'status invalido';
  END IF;
  SELECT status INTO v_status_at FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF NOT FOUND OR v_status_at = p_status THEN RETURN; END IF;

  IF v_status_at = 'aguardando_usuario' AND p_status <> 'aguardando_usuario' THEN
    PERFORM public.suporte_retomar_sla(p_ticket_id);
  END IF;

  UPDATE public.suporte_tickets
     SET status = p_status,
         resolved_at = CASE WHEN p_status = 'resolvido' THEN now() ELSE resolved_at END,
         reaberto_em = CASE WHEN v_status_at = 'resolvido' AND p_status <> 'resolvido' THEN now() ELSE reaberto_em END,
         escalado_em = CASE WHEN p_status = 'escalado' THEN now() ELSE escalado_em END,
         ultima_interacao_em = now()
   WHERE id = p_ticket_id;

  IF p_status = 'aguardando_usuario' AND v_status_at <> 'aguardando_usuario' THEN
    UPDATE public.suporte_tickets SET sla_status = 'pausado', sla_pausado_em = now() WHERE id = p_ticket_id;
  ELSIF p_status = 'resolvido' THEN
    UPDATE public.suporte_tickets
       SET sla_status = CASE WHEN prazo_resolucao_em IS NULL OR now() <= prazo_resolucao_em THEN 'cumprido' ELSE 'violado' END
     WHERE id = p_ticket_id;
  ELSIF v_status_at = 'resolvido' THEN
    UPDATE public.suporte_tickets SET sla_status = 'dentro' WHERE id = p_ticket_id;
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'mudar_status', jsonb_build_object('de', v_status_at, 'para', p_status, 'ator', p_ator));
END;
$$;
REVOKE ALL ON FUNCTION public.suporte_aplicar_status(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

-- rpc_suporte_mudar_status passa a delegar (mesma assinatura/permissões)
CREATE OR REPLACE FUNCTION public.rpc_suporte_mudar_status(p_ticket_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_fila_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT fila_id INTO v_fila_id FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket nao encontrado'; END IF;
  IF NOT (public.is_suporte_staff(v_uid) OR public.is_agente_fila(v_uid, v_fila_id)) THEN
    RAISE EXCEPTION 'sem permissao nesta fila';
  END IF;
  PERFORM public.suporte_aplicar_status(p_ticket_id, p_status, v_uid);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) TO authenticated;

-- ---------- 4. Chamado novo vira card no kanban do departamento ----------
-- Recria rpc_suporte_abrir_chamado (mesma assinatura/retorno) acrescentando,
-- após o cálculo de SLA: se a fila tem projeto vinculado e auto_criar_tarefa,
-- cria a tarefa na PRIMEIRA seção (menor ordem) e grava projeto_tarefa_id.
-- >>> Reaplicar o corpo vigente da função (Fase 3B: bot participante +
-- primeira_mensagem_id no retorno) inserindo o bloco abaixo logo após
-- "PERFORM public.suporte_recalcular_sla(v_ticket_id, now());":
--
--   DECLARE adicionais: v_projeto uuid; v_secao uuid; v_tarefa uuid;
--
--   SELECT f.projeto_id INTO v_projeto FROM public.suporte_filas f
--    WHERE f.id = p_fila_id AND f.auto_criar_tarefa AND f.projeto_id IS NOT NULL;
--   IF v_projeto IS NOT NULL THEN
--     SELECT id INTO v_secao FROM public.projeto_secoes
--      WHERE projeto_id = v_projeto ORDER BY ordem ASC, created_at ASC LIMIT 1;
--     IF v_secao IS NOT NULL THEN
--       INSERT INTO public.projeto_tarefas (projeto_id, secao_id, titulo, descricao, prioridade, criador_id, canal_criacao)
--       VALUES (v_projeto, v_secao,
--               '[' || v_protocolo || '] ' || v_titulo,
--               left(coalesce(p_descricao,''), 2000),
--               CASE v_prio WHEN 'critica' THEN 'urgente' ELSE v_prio END,
--               v_uid, 'suporte_fila')
--       RETURNING id INTO v_tarefa;
--       UPDATE public.suporte_tickets SET projeto_tarefa_id = v_tarefa WHERE id = v_ticket_id;
--     END IF;
--   END IF;

-- ---------- 5. Trigger: mover card no kanban → mensagem/notificação/status ----------
CREATE OR REPLACE FUNCTION public.suporte_on_tarefa_secao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bot   uuid := '1ee5b9de-4864-475f-9602-ee039197e46e';
  v_t     record;
  v_cfg   record;
  v_etapa text;
  v_fila  text;
  v_msg   text;
BEGIN
  -- early-exit barato: só age em card vinculado a chamado
  SELECT t.id, t.conversa_id, t.fila_id, t.protocolo, t.titulo,
         COALESCE(t.requester_id, t.owner_id) AS requester_id, t.status
    INTO v_t
  FROM public.suporte_tickets t
  WHERE t.projeto_tarefa_id = NEW.id
  LIMIT 1;
  IF v_t.id IS NULL THEN RETURN NEW; END IF;

  SELECT nome INTO v_etapa FROM public.projeto_secoes WHERE id = NEW.secao_id;
  SELECT nome INTO v_fila  FROM public.suporte_filas  WHERE id = v_t.fila_id;

  SELECT * INTO v_cfg FROM public.suporte_etapa_mensagens
   WHERE fila_id = v_t.fila_id AND secao_id = NEW.secao_id AND ativo;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (v_t.id, 'etapa_kanban', jsonb_build_object('secao_id', NEW.secao_id, 'etapa', v_etapa));

  IF v_cfg.id IS NULL THEN RETURN NEW; END IF;  -- etapa sem config = só audit

  -- mensagem automática na thread (tipo sistema: não conta como 1ª resposta
  -- nem dispara retomada de SLA — o trigger de mensagens ignora 'sistema')
  IF coalesce(trim(v_cfg.mensagem),'') <> '' THEN
    v_msg := v_cfg.mensagem;
    v_msg := replace(v_msg, '{protocolo}',    coalesce(v_t.protocolo,''));
    v_msg := replace(v_msg, '{titulo}',       coalesce(v_t.titulo,''));
    v_msg := replace(v_msg, '{etapa}',        coalesce(v_etapa,''));
    v_msg := replace(v_msg, '{departamento}', coalesce(v_fila,''));
    INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, ticket_id, ticket_owner_id, visibilidade, metadata)
    VALUES (v_t.conversa_id, v_bot, v_msg, 'sistema', v_t.id, v_t.requester_id, 'broadcast',
            jsonb_build_object('etapa_kanban', v_etapa, 'secao_id', NEW.secao_id));
  END IF;

  IF v_cfg.notificar AND v_t.requester_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_t.requester_id, 'suporte_etapa',
            'Atualização do chamado ' || coalesce(v_t.protocolo,''),
            coalesce(v_t.titulo,'') || ' — etapa: ' || coalesce(v_etapa,''),
            '/dashboard/suporte');
  END IF;

  IF v_cfg.status_map IS NOT NULL AND v_cfg.status_map <> v_t.status THEN
    PERFORM public.suporte_aplicar_status(v_t.id, v_cfg.status_map, NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suporte_tarefa_secao ON public.projeto_tarefas;
CREATE TRIGGER trg_suporte_tarefa_secao
AFTER UPDATE OF secao_id ON public.projeto_tarefas
FOR EACH ROW
WHEN (OLD.secao_id IS DISTINCT FROM NEW.secao_id)
EXECUTE FUNCTION public.suporte_on_tarefa_secao();

-- ---------- 6. RPC: criar novo departamento pela UI (fila + SLA default) ----------
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_criar(
  p_nome text, p_slug text, p_descricao text DEFAULT NULL,
  p_cor text DEFAULT NULL, p_icone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'apenas admin cria departamentos';
  END IF;
  IF coalesce(trim(p_nome),'') = '' OR coalesce(trim(p_slug),'') = '' THEN
    RAISE EXCEPTION 'nome e slug obrigatorios';
  END IF;

  INSERT INTO public.suporte_filas (nome, slug, descricao, cor, icone, ordem, calendario_id)
  VALUES (trim(p_nome), lower(trim(p_slug)), p_descricao, p_cor, p_icone,
          (SELECT coalesce(max(ordem),0)+1 FROM public.suporte_filas),
          (SELECT id FROM public.suporte_calendarios WHERE is_default AND ativo LIMIT 1))
  RETURNING id INTO v_id;

  INSERT INTO public.suporte_sla_policies (fila_id, prioridade, primeira_resposta_horas, resolucao_horas)
  VALUES (v_id,'critica',1,4), (v_id,'alta',2,8), (v_id,'media',4,24), (v_id,'baixa',8,40)
  ON CONFLICT (fila_id, prioridade) DO NOTHING;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_criar(text,text,text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_criar(text,text,text,text,text) TO authenticated;

-- ---------- 7. RPC: criar/vincular projeto do departamento ----------
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_criar_projeto(p_fila_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_fila    record;
  v_projeto uuid;
  v_secao_espera uuid; v_secao_analise uuid; v_secao_fim uuid; v_secao_rej uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_fila FROM public.suporte_filas WHERE id = p_fila_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'fila invalida'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.suporte_fila_agentes WHERE fila_id = p_fila_id AND user_id = v_uid AND ativo AND papel='lider'
  )) THEN RAISE EXCEPTION 'sem permissao'; END IF;
  IF v_fila.projeto_id IS NOT NULL THEN RAISE EXCEPTION 'fila ja tem projeto vinculado'; END IF;

  INSERT INTO public.projetos (nome, descricao, cor, icone, criador_id, status, tipo, visibilidade)
  VALUES ('Suporte — ' || v_fila.nome, 'Fluxo de chamados do departamento ' || v_fila.nome || '.',
          coalesce(v_fila.cor, '#185FA5'), 'life-buoy', v_uid, 'ativo', 'generico', 'equipe')
  RETURNING id INTO v_projeto;

  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Em espera',1)  RETURNING id INTO v_secao_espera;
  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Em análise',2) RETURNING id INTO v_secao_analise;
  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Finalizado',3) RETURNING id INTO v_secao_fim;
  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Rejeitado',4)  RETURNING id INTO v_secao_rej;

  -- membros do projeto = membros da fila (líder vira coordenador)
  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
  SELECT v_projeto, fa.user_id, CASE fa.papel WHEN 'lider' THEN 'coordenador' ELSE 'membro' END
  FROM public.suporte_fila_agentes fa WHERE fa.fila_id = p_fila_id AND fa.ativo
  ON CONFLICT DO NOTHING;

  UPDATE public.suporte_filas SET projeto_id = v_projeto WHERE id = p_fila_id;

  -- mensagens automáticas default (editáveis na UI)
  INSERT INTO public.suporte_etapa_mensagens (fila_id, secao_id, mensagem, status_map, notificar) VALUES
    (p_fila_id, v_secao_espera,  'Seu chamado {protocolo} foi recebido pela equipe de {departamento} e está na fila de trabalho.', 'em_triagem', true),
    (p_fila_id, v_secao_analise, 'Boa notícia: o chamado {protocolo} está em análise — já tem alguém trabalhando no assunto.', 'em_atendimento', true),
    (p_fila_id, v_secao_fim,     'O chamado {protocolo} — {titulo} — foi concluído pela equipe de {departamento}. Se o problema persistir, basta responder por aqui.', 'resolvido', true),
    (p_fila_id, v_secao_rej,     'O chamado {protocolo} foi analisado e não seguirá adiante. A equipe de {departamento} registrou o motivo na conversa.', 'resolvido', true)
  ON CONFLICT (fila_id, secao_id) DO NOTHING;

  RETURN v_projeto;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_criar_projeto(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_criar_projeto(uuid) TO authenticated;

-- ---------- 8. RPC: vincular projeto EXISTENTE ----------
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_vincular_projeto(p_fila_id uuid, p_projeto_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.suporte_fila_agentes WHERE fila_id = p_fila_id AND user_id = v_uid AND ativo AND papel='lider'
  )) THEN RAISE EXCEPTION 'sem permissao'; END IF;
  IF p_projeto_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.projetos WHERE id = p_projeto_id) THEN
    RAISE EXCEPTION 'projeto invalido';
  END IF;
  UPDATE public.suporte_filas SET projeto_id = p_projeto_id WHERE id = p_fila_id; -- NULL desvincula
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_vincular_projeto(uuid,uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_vincular_projeto(uuid,uuid) TO authenticated;
```

### Smoke test da PARTE 1
```sql
-- (a) objetos criados
SELECT proname FROM pg_proc WHERE proname IN
 ('suporte_aplicar_status','suporte_on_tarefa_secao','rpc_suporte_fila_criar',
  'rpc_suporte_fila_criar_projeto','rpc_suporte_fila_vincular_projeto') ORDER BY 1;
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_suporte_tarefa_secao';
-- (b) colunas novas
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'suporte_filas' AND column_name IN ('projeto_id','auto_criar_tarefa');
-- (c) rpc_suporte_abrir_chamado recriada mantém retorno com primeira_mensagem_id
--     (teste funcional: abrir chamado numa fila COM projeto vinculado → card criado na 1ª seção)
```

## PARTE 2 — Frontend

### 2.1 Novo departamento (admin)
Na Central: botão **"Novo departamento"** (só admin) → dialog nome/slug (auto-gerado do nome, editável)/descrição/cor/ícone → `rpc_suporte_fila_criar`. Toast com lembrete: "Adicione os membros e configure o fluxo".

### 2.2 Dialog "Fluxo do departamento" (admin + líder da fila)
Botão engrenagem **"Fluxo"** ao lado de "Membros" na Central (oculto em "Todos"):
- **Sem projeto vinculado**: duas opções — **"Criar projeto padrão"** (`rpc_suporte_fila_criar_projeto` — cria "Suporte — {Depto}" com Em espera → Em análise → Finalizado → Rejeitado + membros da fila + mensagens default) ou **"Vincular projeto existente"** (Select dos projetos visíveis; `rpc_suporte_fila_vincular_projeto`). Switch "Criar card no kanban a cada chamado" (`auto_criar_tarefa`, update direto — policy admin; para líder expor só leitura).
- **Com projeto vinculado**: lista as **seções do kanban** (query em `projeto_secoes` por `projeto_id`, ordem asc). Para cada seção: `Textarea` da **mensagem automática** (nota dos placeholders `{protocolo} {titulo} {etapa} {departamento}`), `Select` opcional "Também mudar status para…" (6 status ou "não mudar"), `Switch` notificar, `Switch` ativo. Upsert em `suporte_etapa_mensagens` (client direto — policy cobre admin/líder). Botão "Abrir projeto" → rota do projeto.

### 2.3 Na tela do chamado (desk)
Quando o ticket tem `projeto_tarefa_id`: badge **"Etapa: {nome da seção}"** na barra de ações (query leve `projeto_tarefas.secao_id` → `projeto_secoes.nome`) + link "ver no projeto". A movimentação é feita **no kanban de Projetos** (central de trabalho da equipe) — o desk mostra o reflexo.

## Aceite
1. Admin cria departamento "Transporte 2" pela UI → aparece no seletor com SLA default; adiciona membros; cria o projeto padrão pelo dialog Fluxo.
2. Abrir chamado no departamento → **card nasce em "Em espera"** no kanban do projeto (título `[RR-...] assunto`) e a mensagem default de "Em espera" chega na thread + sino do solicitante (com status indo a `em_triagem`).
3. Arrastar o card para **"Em análise"** → solicitante recebe "já tem alguém trabalhando" na conversa + notificação; status vira `em_atendimento`.
4. Arrastar para **"Finalizado"** → mensagem de conclusão + status `resolvido` + SLA `cumprido/violado` conforme prazo + CsatPrompt aparece para o solicitante.
5. Editar a mensagem de uma etapa no dialog Fluxo → próxima movimentação usa o texto novo.
6. Mensagens automáticas são `tipo='sistema'`: **não** carimbam 1ª resposta nem retomam SLA pausado (conferir).
7. Etapa sem mensagem configurada → mover o card só registra audit (sem spam ao usuário).

## Notas de arquitetura
- **Direção única (v1)**: kanban → chamado. Mudar status no desk não move o card (evolução futura: sync bidirecional com guarda de loop).
- O bloco da seção 4 é **patch sobre o corpo vigente** de `rpc_suporte_abrir_chamado` (Fase 3B) — reaplicar a função COMPLETA vigente + o bloco, mantendo assinatura e retorno (`primeira_mensagem_id` incluso).
- O desk de TI legado (projeto "Suporte" antigo + `suporte-agente`) não é afetado: o trigger só age em tickets com `projeto_tarefa_id` apontando para o card movido, e a config por etapa é por fila.
