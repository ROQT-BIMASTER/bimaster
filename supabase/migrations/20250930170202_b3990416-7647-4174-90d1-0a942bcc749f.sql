-- Criar função para distribuição automática de prospects
CREATE OR REPLACE FUNCTION public.distribuir_prospect_automaticamente()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o prospect já tem vendedor, não faz nada
  IF NEW.vendedor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Se o prospect tem município_id, busca o vendedor do município
  IF NEW.municipio_id IS NOT NULL THEN
    SELECT vendedor_id INTO NEW.vendedor_id
    FROM public.municipios
    WHERE id = NEW.municipio_id
    AND vendedor_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para distribuição automática na inserção
CREATE TRIGGER trigger_distribuir_prospect_insert
  BEFORE INSERT ON public.prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.distribuir_prospect_automaticamente();

-- Criar trigger para distribuição automática na atualização
CREATE TRIGGER trigger_distribuir_prospect_update
  BEFORE UPDATE OF municipio_id ON public.prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.distribuir_prospect_automaticamente();

-- Criar tabela de auditoria para mudanças de atribuição
CREATE TABLE IF NOT EXISTS public.auditoria_atribuicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('municipio_vendedor', 'prospect_vendedor', 'importacao')),
  entidade_id UUID NOT NULL,
  entidade_tipo TEXT NOT NULL,
  vendedor_antigo_id UUID,
  vendedor_novo_id UUID,
  usuario_id UUID REFERENCES auth.users(id),
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.auditoria_atribuicoes ENABLE ROW LEVEL SECURITY;

-- Política para admins e supervisores visualizarem auditoria
CREATE POLICY "Admins e supervisores podem ver auditoria"
  ON public.auditoria_atribuicoes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_usuario IN ('admin', 'supervisor')
    )
  );

-- Função para registrar mudanças de vendedor em município
CREATE OR REPLACE FUNCTION public.auditar_mudanca_municipio_vendedor()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.vendedor_id IS DISTINCT FROM NEW.vendedor_id THEN
    INSERT INTO public.auditoria_atribuicoes (
      tipo,
      entidade_id,
      entidade_tipo,
      vendedor_antigo_id,
      vendedor_novo_id,
      usuario_id,
      detalhes
    ) VALUES (
      'municipio_vendedor',
      NEW.id,
      'municipio',
      OLD.vendedor_id,
      NEW.vendedor_id,
      auth.uid(),
      jsonb_build_object(
        'municipio_nome', NEW.nome,
        'municipio_uf', NEW.uf
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para auditar mudanças em municípios
CREATE TRIGGER trigger_auditar_municipio
  AFTER UPDATE OF vendedor_id ON public.municipios
  FOR EACH ROW
  EXECUTE FUNCTION public.auditar_mudanca_municipio_vendedor();