
-- Trigger: when a new profile is created, auto-link team_form_submissions by email
CREATE OR REPLACE FUNCTION public.link_submission_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Match submission email_pessoal with profile email
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    UPDATE public.team_form_submissions
    SET vinculado = true,
        vinculado_user_id = NEW.id
    WHERE LOWER(email_pessoal) = LOWER(NEW.email)
      AND vinculado = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fire on insert and update of profiles
DROP TRIGGER IF EXISTS trg_link_submission_on_profile ON public.profiles;
CREATE TRIGGER trg_link_submission_on_profile
AFTER INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.link_submission_to_profile();
