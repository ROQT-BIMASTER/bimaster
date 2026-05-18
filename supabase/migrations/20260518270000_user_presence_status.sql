-- =========================================================================
-- user_presence_status — status declarado (Disponível/Ocupado/...)
-- =========================================================================
--
-- Hoje o chat só sabe online/offline via Realtime Presence (tab aberta).
-- Esta tabela acrescenta status DECLARADO pelo usuário, persistido entre
-- sessões. Estilo Teams: Disponível / Ocupado / Em reunião / Ausente /
-- Não perturbe. Quando o user fecha tab, presence (real-time) cai mas
-- status declarado persiste — fonte da verdade pro UI.
--
-- A bolinha no avatar reflete primeiro o status declarado; se não houver,
-- cai pro online/offline do Realtime Presence.

CREATE TABLE IF NOT EXISTS public.user_presence_status (
  user_id     uuid PRIMARY KEY,
  status      text NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'ocupado', 'em_reuniao', 'ausente', 'nao_perturbe')),
  mensagem    text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence_status ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer authenticated pode ler (mesma lógica de chat_directory —
-- saber o status do colega não é PII sensível).
DROP POLICY IF EXISTS presence_status_select ON public.user_presence_status;
CREATE POLICY presence_status_select ON public.user_presence_status
FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE: só o próprio user
DROP POLICY IF EXISTS presence_status_upsert ON public.user_presence_status;
CREATE POLICY presence_status_upsert ON public.user_presence_status
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS presence_status_update ON public.user_presence_status;
CREATE POLICY presence_status_update ON public.user_presence_status
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Realtime — outros usuários veem mudança de status em tempo real
ALTER TABLE public.user_presence_status REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence_status;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Trigger pra atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.tg_presence_status_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_presence_status_updated_at ON public.user_presence_status;
CREATE TRIGGER trg_presence_status_updated_at
BEFORE UPDATE ON public.user_presence_status
FOR EACH ROW EXECUTE FUNCTION public.tg_presence_status_updated_at();

COMMENT ON TABLE public.user_presence_status IS
  'Status declarado de presenca por usuario (disponivel/ocupado/em_reuniao/
   ausente/nao_perturbe). Realtime habilitado. Persiste entre sessoes
   diferente do online/offline do Realtime Presence.';
