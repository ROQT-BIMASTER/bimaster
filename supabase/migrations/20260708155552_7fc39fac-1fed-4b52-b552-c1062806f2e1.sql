-- Integração iPaper: tabela de-para produto iPaper <-> código HB
CREATE TABLE IF NOT EXISTS public.ipaper_produtos (
  ipaper_id integer PRIMARY KEY,
  nome text NOT NULL,
  codhb text,
  preco numeric(18,4),
  package_size integer,
  preco_fixo boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ipaper_produtos TO authenticated;
GRANT ALL ON public.ipaper_produtos TO service_role;

CREATE INDEX IF NOT EXISTS idx_ipaper_produtos_codhb ON public.ipaper_produtos(codhb);

ALTER TABLE public.ipaper_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read ipaper_produtos" ON public.ipaper_produtos;
CREATE POLICY "Auth can read ipaper_produtos"
  ON public.ipaper_produtos FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'estoque'));

DROP TRIGGER IF EXISTS trg_ipaper_produtos_updated ON public.ipaper_produtos;
CREATE TRIGGER trg_ipaper_produtos_updated
  BEFORE UPDATE ON public.ipaper_produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();