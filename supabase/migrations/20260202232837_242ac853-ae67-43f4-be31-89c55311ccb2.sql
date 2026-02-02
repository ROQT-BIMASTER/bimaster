-- Criar tabela para cenários de simulação de preços
CREATE TABLE public.simulacao_cenarios_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tabela_base_id UUID REFERENCES public.fabrica_tabelas_preco(id) ON DELETE SET NULL,
  tipo_markup TEXT NOT NULL DEFAULT 'percentual' CHECK (tipo_markup IN ('percentual', 'multiplicador', 'valor_fixo')),
  valor_markup NUMERIC(10,4) NOT NULL DEFAULT 0,
  origem TEXT CHECK (origem IS NULL OR origem IN ('nacional', 'importado', 'ambos')),
  produtos_ids UUID[] NOT NULL DEFAULT '{}',
  resultados JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comentários para documentação
COMMENT ON TABLE public.simulacao_cenarios_preco IS 'Cenários de simulação de preços para análise antes de criar tabelas reais';
COMMENT ON COLUMN public.simulacao_cenarios_preco.tipo_markup IS 'Tipo de markup: percentual, multiplicador ou valor_fixo';
COMMENT ON COLUMN public.simulacao_cenarios_preco.resultados IS 'Cache dos resultados calculados em JSON';

-- Habilitar RLS
ALTER TABLE public.simulacao_cenarios_preco ENABLE ROW LEVEL SECURITY;

-- Política para administradores (acesso total)
CREATE POLICY "Admins have full access to simulacao_cenarios_preco"
ON public.simulacao_cenarios_preco
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
);

-- Política para usuários com permissão à tela
CREATE POLICY "Users with screen permission can access simulacao_cenarios_preco"
ON public.simulacao_cenarios_preco
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_all_user_permissions(auth.uid()) p
    WHERE 'precos_simulador' = ANY(p.screens)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.get_all_user_permissions(auth.uid()) p
    WHERE 'precos_simulador' = ANY(p.screens)
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_simulacao_cenarios_preco_updated_at
  BEFORE UPDATE ON public.simulacao_cenarios_preco
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Registrar nova tela no sistema
INSERT INTO public.telas_sistema (codigo, nome, modulo_codigo, rota, icone, ordem, ativo)
VALUES ('precos_simulador', 'Simulador de Preços', 'precos', '/dashboard/precos/simulador', 'FlaskConical', 0, true)
ON CONFLICT (codigo) DO NOTHING;