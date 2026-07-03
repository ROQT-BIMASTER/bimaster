# Prompt Lovable — Suporte Help Desk · FASE 0 (Fundação de schema)

> **Cole este prompt no Lovable.** É uma migration **100% aditiva**: só cria tabelas novas, adiciona colunas novas (nullable/com default) em `suporte_tickets`, cria RLS **nas tabelas novas**, semeia dados de configuração e faz backfill. **Não altera nenhuma política, função, edge function ou comportamento existente.** O help desk de TI atual continua funcionando idêntico. Nada aparece para o usuário nesta fase (sem UI).
>
> Arquitetura completa: `docs/ARQUITETURA-SUPORTE-HELPDESK-MULTIDEPARTAMENTO.md`.

## Contexto para o Lovable
Estamos generalizando o desk de suporte de TI existente (`suporte_tickets`) para um **help desk multi‑departamento omnichannel**. Esta Fase 0 só monta a fundação de dados. Reaproveita: `suporte_tickets`, `departamentos`, `user_roles`/`app_role`/`has_role()`, `conversas`/`mensagens`, `notifications`. Não crie UI, não crie edge functions, não altere RLS de `mensagens` nem o fluxo do `suporte-agente` — isso vem nas próximas fases.

## Instruções
Crie **uma migration** com o SQL abaixo. Ele é idempotente (`IF NOT EXISTS` / `ON CONFLICT`). Depois de aplicar, rode o smoke test do final e me diga o resultado.

```sql
-- =====================================================================
-- SUPORTE HELP DESK — FASE 0 (fundação, aditiva)
-- =====================================================================

-- ---------- 1. FILAS (departamentos-desk) ----------
CREATE TABLE IF NOT EXISTS public.suporte_filas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  slug               text NOT NULL UNIQUE,
  departamento_id    uuid REFERENCES public.departamentos(id),
  descricao          text,
  cor                text,
  icone              text,
  ativo              boolean NOT NULL DEFAULT true,
  aceita_chamados    boolean NOT NULL DEFAULT true,
  ordem              int NOT NULL DEFAULT 0,
  ia_habilitada      boolean NOT NULL DEFAULT false,
  ia_prompt          text,
  ia_pode_transferir boolean NOT NULL DEFAULT true,
  sla_primeira_resposta_horas int NOT NULL DEFAULT 8,
  sla_resolucao_horas         int NOT NULL DEFAULT 24,
  calendario_id      uuid,   -- FK definida após criar suporte_calendarios
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------- 2. AGENTES POR FILA ----------
CREATE TABLE IF NOT EXISTS public.suporte_fila_agentes (
  fila_id    uuid NOT NULL REFERENCES public.suporte_filas(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  papel      text NOT NULL DEFAULT 'agente' CHECK (papel IN ('agente','lider')),
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fila_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_suporte_fila_agentes_user ON public.suporte_fila_agentes(user_id) WHERE ativo;

-- ---------- 3. CALENDÁRIO COMERCIAL ----------
CREATE TABLE IF NOT EXISTS public.suporte_calendarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  timezone    text NOT NULL DEFAULT 'America/Sao_Paulo',
  intervalos  jsonb NOT NULL DEFAULT '[
    {"dow":1,"inicio":"08:30","fim":"17:30"},
    {"dow":2,"inicio":"08:30","fim":"17:30"},
    {"dow":3,"inicio":"08:30","fim":"17:30"},
    {"dow":4,"inicio":"08:30","fim":"17:30"},
    {"dow":5,"inicio":"08:30","fim":"17:30"}
  ]'::jsonb,
  feriados    date[] NOT NULL DEFAULT '{}',
  is_default  boolean NOT NULL DEFAULT false,
  ativo       boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- FK de filas -> calendarios (agora que a tabela existe)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suporte_filas_calendario_fk') THEN
    ALTER TABLE public.suporte_filas
      ADD CONSTRAINT suporte_filas_calendario_fk
      FOREIGN KEY (calendario_id) REFERENCES public.suporte_calendarios(id);
  END IF;
END $$;

-- ---------- 4. POLÍTICAS DE SLA (por fila x prioridade) ----------
CREATE TABLE IF NOT EXISTS public.suporte_sla_policies (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fila_id                  uuid NOT NULL REFERENCES public.suporte_filas(id) ON DELETE CASCADE,
  prioridade               text NOT NULL CHECK (prioridade IN ('baixa','media','alta','critica')),
  primeira_resposta_horas  int NOT NULL,
  resolucao_horas          int NOT NULL,
  usa_horario_comercial    boolean NOT NULL DEFAULT true,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fila_id, prioridade)
);

-- ---------- 5. CANAIS (contas conectadas: WhatsApp único e/ou por área) ----------
CREATE TABLE IF NOT EXISTS public.suporte_canal_contas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal           text NOT NULL CHECK (canal IN ('whatsapp','email','chat_interno')),
  provedor        text,
  identificador   text NOT NULL,          -- phone_number_id (WhatsApp)
  display_number  text,
  fila_padrao_id  uuid REFERENCES public.suporte_filas(id),
  ativo           boolean NOT NULL DEFAULT true,
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- NUNCA guardar token aqui (usar Secrets)
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canal, identificador)
);

-- ---------- 6. CONTATOS EXTERNOS (requester de WhatsApp) ----------
CREATE TABLE IF NOT EXISTS public.suporte_contatos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal        text NOT NULL,
  external_id  text NOT NULL,             -- wa_id
  telefone     text,
  nome         text,
  profile_id   uuid,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canal, external_id)
);

-- ---------- 7. FILA DE EVENTOS CRUS (idempotência de webhook) ----------
CREATE TABLE IF NOT EXISTS public.suporte_canal_eventos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal           text NOT NULL,
  external_msg_id text NOT NULL,          -- wamid...
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','processado','erro')),
  erro            text,
  recebido_em     timestamptz NOT NULL DEFAULT now(),
  processado_em   timestamptz,
  UNIQUE (canal, external_msg_id)
);

-- ---------- 8. TRANSFERÊNCIAS ENTRE FILAS ----------
CREATE TABLE IF NOT EXISTS public.suporte_transferencias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  de_fila_id       uuid REFERENCES public.suporte_filas(id),
  para_fila_id     uuid NOT NULL REFERENCES public.suporte_filas(id),
  de_assignee_id   uuid,
  para_assignee_id uuid,
  motivo           text,
  via_ia           boolean NOT NULL DEFAULT false,
  transferido_por  uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suporte_transf_ticket ON public.suporte_transferencias(ticket_id, created_at DESC);

-- ---------- 9. EXTENSÃO DE suporte_tickets ----------
ALTER TABLE public.suporte_tickets
  ADD COLUMN IF NOT EXISTS fila_id        uuid REFERENCES public.suporte_filas(id),
  ADD COLUMN IF NOT EXISTS canal          text NOT NULL DEFAULT 'chat_interno',
  ADD COLUMN IF NOT EXISTS canal_conta_id uuid REFERENCES public.suporte_canal_contas(id),
  ADD COLUMN IF NOT EXISTS requester_id   uuid,
  ADD COLUMN IF NOT EXISTS contato_id     uuid REFERENCES public.suporte_contatos(id),
  ADD COLUMN IF NOT EXISTS assignee_id    uuid,
  ADD COLUMN IF NOT EXISTS protocolo      text,
  ADD COLUMN IF NOT EXISTS prazo_primeira_resposta_em timestamptz,
  ADD COLUMN IF NOT EXISTS primeira_resposta_em       timestamptz,
  ADD COLUMN IF NOT EXISTS prazo_resolucao_em         timestamptz,
  ADD COLUMN IF NOT EXISTS sla_status     text DEFAULT 'dentro'
      CHECK (sla_status IN ('dentro','em_risco','violado','pausado','cumprido')),
  ADD COLUMN IF NOT EXISTS reaberto_em    timestamptz,
  ADD COLUMN IF NOT EXISTS tags           text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_suporte_tickets_fila ON public.suporte_tickets(fila_id);
-- (índice único de protocolo é criado DEPOIS do backfill, na seção 16, para não falhar caso backfill precise ajustar)

-- ---------- 10. HELPERS DE RLS (SECURITY DEFINER) ----------
CREATE OR REPLACE FUNCTION public.is_suporte_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
      OR public.has_role(_uid, 'suporte'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_agente_fila(_uid uuid, _fila_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.suporte_fila_agentes fa
    WHERE fa.fila_id = _fila_id AND fa.user_id = _uid AND fa.ativo
  ) OR public.has_role(_uid, 'admin'::app_role);
$$;

-- ---------- 11. RLS DAS TABELAS NOVAS ----------
-- Config legível por todos autenticados; escrita só admin.
ALTER TABLE public.suporte_filas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_sla_policies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_calendarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_fila_agentes  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sup_filas_sel ON public.suporte_filas;
CREATE POLICY sup_filas_sel ON public.suporte_filas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sup_filas_adm ON public.suporte_filas;
CREATE POLICY sup_filas_adm ON public.suporte_filas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS sup_sla_sel ON public.suporte_sla_policies;
CREATE POLICY sup_sla_sel ON public.suporte_sla_policies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sup_sla_adm ON public.suporte_sla_policies;
CREATE POLICY sup_sla_adm ON public.suporte_sla_policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS sup_cal_sel ON public.suporte_calendarios;
CREATE POLICY sup_cal_sel ON public.suporte_calendarios FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sup_cal_adm ON public.suporte_calendarios;
CREATE POLICY sup_cal_adm ON public.suporte_calendarios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS sup_fa_sel ON public.suporte_fila_agentes;
CREATE POLICY sup_fa_sel ON public.suporte_fila_agentes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sup_fa_adm ON public.suporte_fila_agentes;
CREATE POLICY sup_fa_adm ON public.suporte_fila_agentes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Dados sensíveis: só staff de suporte lê; escrita via service_role/RPC (sem policy de client).
ALTER TABLE public.suporte_canal_contas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_contatos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_transferencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_canal_eventos   ENABLE ROW LEVEL SECURITY;  -- sem policy => só service_role

DROP POLICY IF EXISTS sup_contas_sel ON public.suporte_canal_contas;
CREATE POLICY sup_contas_sel ON public.suporte_canal_contas FOR SELECT TO authenticated
  USING (public.is_suporte_staff(auth.uid()));
DROP POLICY IF EXISTS sup_contas_adm ON public.suporte_canal_contas;
CREATE POLICY sup_contas_adm ON public.suporte_canal_contas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS sup_contatos_sel ON public.suporte_contatos;
CREATE POLICY sup_contatos_sel ON public.suporte_contatos FOR SELECT TO authenticated
  USING (public.is_suporte_staff(auth.uid()));

DROP POLICY IF EXISTS sup_transf_sel ON public.suporte_transferencias;
CREATE POLICY sup_transf_sel ON public.suporte_transferencias FOR SELECT TO authenticated
  USING (
    public.is_suporte_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.suporte_tickets t
               WHERE t.id = suporte_transferencias.ticket_id
                 AND (t.requester_id = auth.uid() OR t.owner_id = auth.uid()))
  );

-- ---------- 12. TRIGGERS updated_at (reusa função existente do projeto) ----------
DROP TRIGGER IF EXISTS trg_suporte_filas_updated_at ON public.suporte_filas;
CREATE TRIGGER trg_suporte_filas_updated_at BEFORE UPDATE ON public.suporte_filas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 13. SEED: calendário default (SP 08:30-17:30) ----------
INSERT INTO public.suporte_calendarios (nome, is_default, ativo)
SELECT 'Comercial Brasil (São Paulo)', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.suporte_calendarios WHERE is_default);

-- ---------- 14. SEED: filas iniciais (editáveis; líderes atribuídos depois na UI) ----------
INSERT INTO public.suporte_filas (nome, slug, cor, icone, ordem, calendario_id)
SELECT v.nome, v.slug, v.cor, v.icone, v.ordem,
       (SELECT id FROM public.suporte_calendarios WHERE is_default LIMIT 1)
FROM (VALUES
  ('TI / Sistema',        'ti',            '#E91E78', 'life-buoy', 1),
  ('Transporte',          'transporte',    '#0EA5E9', 'truck',     2),
  ('Fiscal',              'fiscal',        '#F59E0B', 'file-text', 3),
  ('Logística',           'logistica',     '#10B981', 'package',   4),
  ('Central ADM CSO',     'adm-cso',       '#8B5CF6', 'building',  5),
  ('Compras',             'compras',       '#EF4444', 'shopping-cart', 6),
  ('Recursos Humanos',    'rh',            '#EC4899', 'users',     7)
) AS v(nome, slug, cor, icone, ordem)
ON CONFLICT (slug) DO NOTHING;

-- ---------- 15. SEED: SLA de mercado (todas as filas x 4 prioridades) ----------
INSERT INTO public.suporte_sla_policies (fila_id, prioridade, primeira_resposta_horas, resolucao_horas)
SELECT f.id, p.prioridade, p.fr, p.res
FROM public.suporte_filas f
CROSS JOIN (VALUES
  ('critica', 1, 4),
  ('alta',    2, 8),
  ('media',   4, 24),
  ('baixa',   8, 40)
) AS p(prioridade, fr, res)
ON CONFLICT (fila_id, prioridade) DO NOTHING;

-- ---------- 16. BACKFILL: tickets existentes -> fila TI + requester + protocolo ----------
UPDATE public.suporte_tickets t
SET fila_id = (SELECT id FROM public.suporte_filas WHERE slug = 'ti' LIMIT 1)
WHERE t.fila_id IS NULL;

UPDATE public.suporte_tickets t
SET requester_id = t.owner_id
WHERE t.requester_id IS NULL AND t.owner_id IS NOT NULL;

UPDATE public.suporte_tickets t
SET protocolo = 'RR-' || to_char(t.created_at,'YYYYMMDD') || '-' ||
                upper(substr(replace(t.id::text,'-',''),1,6))
WHERE t.protocolo IS NULL;

-- índice único de protocolo criado agora, já com os dados preenchidos
CREATE UNIQUE INDEX IF NOT EXISTS idx_suporte_tickets_protocolo
  ON public.suporte_tickets(protocolo) WHERE protocolo IS NOT NULL;
```

## Smoke test (rode e me mande o resultado)

```sql
-- Deve retornar 7 filas, 28 policies, 1 calendário default, e 0 tickets sem fila.
SELECT
  (SELECT count(*) FROM public.suporte_filas)                              AS filas,
  (SELECT count(*) FROM public.suporte_sla_policies)                       AS sla_policies,
  (SELECT count(*) FROM public.suporte_calendarios WHERE is_default)       AS calendario_default,
  (SELECT count(*) FROM public.suporte_tickets WHERE fila_id IS NULL)      AS tickets_sem_fila,
  (SELECT count(*) FROM public.suporte_tickets WHERE protocolo IS NULL)    AS tickets_sem_protocolo;
```

**Esperado:** `filas=7`, `sla_policies=28`, `calendario_default=1`, `tickets_sem_fila=0`, `tickets_sem_protocolo=0`.

## Depois de aplicar
1. Confirme os números do smoke test aqui comigo.
2. Rode o **advisor de segurança** do Supabase e me diga se apontou algo nas tabelas `suporte_*` (esperado: RLS habilitado em todas; `suporte_canal_eventos` sem policy é intencional — só service_role acessa).
3. Nada muda para o usuário nesta fase. Seguimos para a **Fase 1** (conversa por chamado + tela de abertura + painel do agente por fila).
