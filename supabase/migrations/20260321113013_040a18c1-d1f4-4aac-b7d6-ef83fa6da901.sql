-- 1) dim_empresa
CREATE TABLE public.dim_empresa (
  id_empresa INTEGER PRIMARY KEY,
  nome_empresa TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.dim_empresa (id_empresa, nome_empresa)
SELECT DISTINCT id_empresa, empresa FROM public.vendas_union
WHERE id_empresa IS NOT NULL
ON CONFLICT (id_empresa) DO NOTHING;

-- 2) user_empresa_access
CREATE TABLE IF NOT EXISTS public.user_empresa_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_empresa INTEGER NOT NULL REFERENCES public.dim_empresa(id_empresa) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, id_empresa)
);

-- 3) dim_vendedor
CREATE TABLE public.dim_vendedor (
  cod_vend INTEGER PRIMARY KEY,
  nome_vendedor TEXT NOT NULL,
  cod_equipe INTEGER,
  nome_equipe TEXT,
  supervisor TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.dim_vendedor (cod_vend, nome_vendedor, cod_equipe, nome_equipe, supervisor)
SELECT DISTINCT ON (cod_vend) cod_vend, vendedor, cod_equipe, nome_equipe, supervisor
FROM public.vendas_union WHERE cod_vend IS NOT NULL
ORDER BY cod_vend, data DESC
ON CONFLICT (cod_vend) DO NOTHING;

-- 4) dim_supervisor
CREATE TABLE public.dim_supervisor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_supervisor TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.dim_supervisor (nome_supervisor)
SELECT DISTINCT supervisor FROM public.vendas_union
WHERE supervisor IS NOT NULL AND supervisor != ''
ON CONFLICT (nome_supervisor) DO NOTHING;

-- 5) Habilitar RLS
ALTER TABLE public.dim_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_empresa_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_vendedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_supervisor ENABLE ROW LEVEL SECURITY;