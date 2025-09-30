-- Criar tabela de associação entre usuários e municípios
CREATE TABLE IF NOT EXISTS public.municipios_usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipio_id UUID NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(municipio_id, usuario_id)
);

-- Habilitar RLS
ALTER TABLE public.municipios_usuarios ENABLE ROW LEVEL SECURITY;

-- Política para admins e supervisores verem todos os vínculos
CREATE POLICY "Admins e supervisores podem ver todos os vínculos"
ON public.municipios_usuarios
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tipo_usuario IN ('admin', 'supervisor')
  )
);

-- Política para vendedores verem apenas seus próprios vínculos
CREATE POLICY "Vendedores podem ver seus próprios vínculos"
ON public.municipios_usuarios
FOR SELECT
USING (auth.uid() = usuario_id);

-- Política para admins gerenciarem vínculos
CREATE POLICY "Admins podem gerenciar vínculos"
ON public.municipios_usuarios
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tipo_usuario = 'admin'
  )
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_municipios_usuarios_municipio ON public.municipios_usuarios(municipio_id);
CREATE INDEX IF NOT EXISTS idx_municipios_usuarios_usuario ON public.municipios_usuarios(usuario_id);

-- Migrar dados existentes da tabela municipios (se houver vendedor_id preenchido)
INSERT INTO public.municipios_usuarios (municipio_id, usuario_id)
SELECT id, vendedor_id
FROM public.municipios
WHERE vendedor_id IS NOT NULL
ON CONFLICT (municipio_id, usuario_id) DO NOTHING;