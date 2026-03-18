
-- Tabela de tipos de documento dinâmicos
CREATE TABLE public.process_tipos_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor text NOT NULL,
  label text NOT NULL,
  modulo text,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'manual',
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(valor)
);

ALTER TABLE public.process_tipos_documento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tipos_documento"
  ON public.process_tipos_documento FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tipos_documento"
  ON public.process_tipos_documento FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tipos_documento"
  ON public.process_tipos_documento FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Seed com os tipos hardcoded atuais
INSERT INTO public.process_tipos_documento (valor, label, origem) VALUES
  ('embalagem', 'Embalagem', 'sistema'),
  ('rotulo', 'Rótulo', 'sistema'),
  ('arte', 'Arte', 'sistema'),
  ('ficha_tecnica', 'Ficha Técnica', 'sistema'),
  ('regulatorio', 'Regulatório', 'sistema'),
  ('outro', 'Outro', 'sistema');

-- Trigger: ao criar item custom na china, replicar como tipo de documento
CREATE OR REPLACE FUNCTION public.sync_china_custom_item_to_tipo_documento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.process_tipos_documento (valor, label, origem, created_by)
  VALUES (NEW.tipo_key, NEW.label_pt, 'china_checklist', NEW.created_by)
  ON CONFLICT (valor) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_china_custom_to_tipo_doc
  AFTER INSERT ON public.china_checklist_custom_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_china_custom_item_to_tipo_documento();
