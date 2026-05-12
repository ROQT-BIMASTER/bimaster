
-- Liberar upload/edição/exclusão de fotos de produtos acabados para qualquer usuário com acesso ao módulo Fábrica
-- Mantém a auditoria via fabrica_produtos_historico (já existente) e via storage.objects (owner/created_at).

DROP POLICY IF EXISTS fabrica_fotos_insert_owned ON storage.objects;
DROP POLICY IF EXISTS fabrica_fotos_update_owned ON storage.objects;
DROP POLICY IF EXISTS fabrica_fotos_delete_owned ON storage.objects;
DROP POLICY IF EXISTS fabrica_fotos_select_scoped ON storage.objects;

CREATE POLICY fabrica_fotos_select_scoped
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
    OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica')
  )
);

CREATE POLICY fabrica_fotos_insert_module
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
    OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica')
  )
);

CREATE POLICY fabrica_fotos_update_module
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
    OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica')
  )
)
WITH CHECK (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
    OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica')
  )
);

CREATE POLICY fabrica_fotos_delete_module
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
    OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica')
  )
);

-- Trilha de auditoria explícita para uploads/exclusões de fotos
CREATE OR REPLACE FUNCTION public.log_fabrica_foto_storage_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_produto_id uuid;
  v_first_folder text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.bucket_id <> 'fabrica-produto-fotos' THEN RETURN OLD; END IF;
    v_first_folder := (storage.foldername(OLD.name))[1];
  ELSE
    IF NEW.bucket_id <> 'fabrica-produto-fotos' THEN RETURN NEW; END IF;
    v_first_folder := (storage.foldername(NEW.name))[1];
  END IF;

  BEGIN
    v_produto_id := v_first_folder::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_produto_id := NULL;
  END;

  IF v_produto_id IS NOT NULL THEN
    INSERT INTO public.fabrica_produtos_historico
      (produto_id, acao, campos_alterados, dados_anteriores, dados_novos, usuario_id)
    VALUES (
      v_produto_id,
      CASE TG_OP
        WHEN 'INSERT' THEN 'foto_upload'
        WHEN 'UPDATE' THEN 'foto_update'
        WHEN 'DELETE' THEN 'foto_delete'
      END,
      ARRAY['foto'],
      CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('path', OLD.name) ELSE NULL END,
      CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('path', NEW.name) ELSE NULL END,
      auth.uid()
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_fabrica_foto_storage_audit_ins ON storage.objects;
DROP TRIGGER IF EXISTS trg_fabrica_foto_storage_audit_upd ON storage.objects;
DROP TRIGGER IF EXISTS trg_fabrica_foto_storage_audit_del ON storage.objects;

CREATE TRIGGER trg_fabrica_foto_storage_audit_ins
AFTER INSERT ON storage.objects
FOR EACH ROW
WHEN (NEW.bucket_id = 'fabrica-produto-fotos')
EXECUTE FUNCTION public.log_fabrica_foto_storage_event();

CREATE TRIGGER trg_fabrica_foto_storage_audit_upd
AFTER UPDATE ON storage.objects
FOR EACH ROW
WHEN (NEW.bucket_id = 'fabrica-produto-fotos')
EXECUTE FUNCTION public.log_fabrica_foto_storage_event();

CREATE TRIGGER trg_fabrica_foto_storage_audit_del
AFTER DELETE ON storage.objects
FOR EACH ROW
WHEN (OLD.bucket_id = 'fabrica-produto-fotos')
EXECUTE FUNCTION public.log_fabrica_foto_storage_event();
