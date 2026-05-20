-- 1) Trigger melhorado: deriva ticket_owner_id quando bot envia sem informar
CREATE OR REPLACE FUNCTION public.tg_mensagens_suporte_privacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suporte_conv uuid := '3daf9772-404f-42f4-adbf-8a2566d91870';
  v_bot uuid := '1ee5b9de-4864-475f-9602-ee039197e46e';
  v_derived uuid;
BEGIN
  IF NEW.conversa_id = v_suporte_conv THEN
    IF NEW.remetente_id = v_bot THEN
      -- Se bot está respondendo em modo privado mas esqueceu o owner,
      -- tenta deduzir pela última mensagem de usuário (não-bot) na conversa.
      IF NEW.ticket_owner_id IS NULL
         AND (NEW.visibilidade IS NULL OR NEW.visibilidade = 'privada_suporte') THEN
        SELECT m.remetente_id INTO v_derived
        FROM public.mensagens m
        WHERE m.conversa_id = v_suporte_conv
          AND m.remetente_id <> v_bot
        ORDER BY m.created_at DESC
        LIMIT 1;
        IF v_derived IS NOT NULL THEN
          NEW.ticket_owner_id := v_derived;
          NEW.visibilidade := 'privada_suporte';
        END IF;
      END IF;

      IF NEW.ticket_owner_id IS NOT NULL
         AND (NEW.visibilidade IS NULL OR NEW.visibilidade = 'broadcast') THEN
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

-- 2) Backfill: corrige a mensagem do bot que ficou sem ticket_owner_id
UPDATE public.mensagens m
SET ticket_owner_id = (
  SELECT m2.remetente_id
  FROM public.mensagens m2
  WHERE m2.conversa_id = m.conversa_id
    AND m2.remetente_id <> '1ee5b9de-4864-475f-9602-ee039197e46e'
    AND m2.created_at < m.created_at
  ORDER BY m2.created_at DESC
  LIMIT 1
)
WHERE m.conversa_id = '3daf9772-404f-42f4-adbf-8a2566d91870'
  AND m.remetente_id = '1ee5b9de-4864-475f-9602-ee039197e46e'
  AND m.visibilidade = 'privada_suporte'
  AND m.ticket_owner_id IS NULL;