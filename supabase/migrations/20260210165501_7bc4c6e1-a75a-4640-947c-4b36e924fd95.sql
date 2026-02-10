
-- Update the trigger to also copy submission data into team_member_details on link
CREATE OR REPLACE FUNCTION public.link_submission_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    -- Link submission
    UPDATE public.team_form_submissions
    SET vinculado = true,
        vinculado_user_id = NEW.id
    WHERE LOWER(email_pessoal) = LOWER(NEW.email)
      AND vinculado = false;

    -- Copy submission data to team_member_details (upsert)
    INSERT INTO public.team_member_details (
      user_id, nome_completo, cpf, rg, data_nascimento,
      email_pessoal, whatsapp, tamanho_camiseta,
      equipe_comercial, supervisor_nome, observacoes
    )
    SELECT
      NEW.id,
      s.nome_completo,
      s.cpf,
      s.rg,
      s.data_nascimento,
      s.email_pessoal,
      s.whatsapp,
      s.tamanho_camiseta,
      s.equipe_comercial,
      s.supervisor_nome,
      s.observacoes
    FROM public.team_form_submissions s
    WHERE LOWER(s.email_pessoal) = LOWER(NEW.email)
    ORDER BY s.created_at DESC
    LIMIT 1
    ON CONFLICT (user_id) DO UPDATE SET
      nome_completo = EXCLUDED.nome_completo,
      cpf = EXCLUDED.cpf,
      rg = EXCLUDED.rg,
      data_nascimento = EXCLUDED.data_nascimento,
      email_pessoal = EXCLUDED.email_pessoal,
      whatsapp = EXCLUDED.whatsapp,
      tamanho_camiseta = EXCLUDED.tamanho_camiseta,
      equipe_comercial = EXCLUDED.equipe_comercial,
      supervisor_nome = EXCLUDED.supervisor_nome,
      observacoes = EXCLUDED.observacoes,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
