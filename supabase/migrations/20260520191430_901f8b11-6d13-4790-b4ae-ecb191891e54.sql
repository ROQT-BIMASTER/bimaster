
CREATE OR REPLACE FUNCTION public.tg_mensagens_suporte_privacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suporte_conv uuid := '3daf9772-404f-42f4-adbf-8a2566d91870';
  v_bot uuid := '1ee5b9de-4864-475f-9602-ee039197e46e';
BEGIN
  IF NEW.conversa_id = v_suporte_conv THEN
    -- Mensagens do bot/admin: respeita visibilidade do payload (default broadcast).
    IF NEW.remetente_id = v_bot THEN
      -- Se já veio com ticket_owner_id setado pelo agente, marca como privada.
      IF NEW.ticket_owner_id IS NOT NULL AND (NEW.visibilidade IS NULL OR NEW.visibilidade = 'broadcast') THEN
        NEW.visibilidade := 'privada_suporte';
      END IF;
    ELSE
      -- Mensagens de usuário: sempre privadas, owner = ele mesmo.
      NEW.visibilidade := 'privada_suporte';
      NEW.ticket_owner_id := NEW.remetente_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensagens_suporte_privacy ON public.mensagens;
CREATE TRIGGER trg_mensagens_suporte_privacy
  BEFORE INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.tg_mensagens_suporte_privacy();
