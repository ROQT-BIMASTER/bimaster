
CREATE TABLE IF NOT EXISTS public.suporte_respostas_rapidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo text NOT NULL CHECK (escopo IN ('global','fila','usuario')),
  fila_id uuid REFERENCES public.suporte_filas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  atalho text,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (escopo = 'global' AND fila_id IS NULL AND user_id IS NULL) OR
    (escopo = 'fila' AND fila_id IS NOT NULL AND user_id IS NULL) OR
    (escopo = 'usuario' AND user_id IS NOT NULL AND fila_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS ix_sup_macros_fila ON public.suporte_respostas_rapidas(fila_id) WHERE fila_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_sup_macros_user ON public.suporte_respostas_rapidas(user_id) WHERE user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suporte_respostas_rapidas TO authenticated;
GRANT ALL ON public.suporte_respostas_rapidas TO service_role;

ALTER TABLE public.suporte_respostas_rapidas ENABLE ROW LEVEL SECURITY;

-- SELECT: globais para todos autenticados; de fila para agente da fila; pessoais só do dono
CREATE POLICY sup_macros_sel ON public.suporte_respostas_rapidas
FOR SELECT TO authenticated
USING (
  escopo = 'global'
  OR (escopo = 'usuario' AND user_id = auth.uid())
  OR (escopo = 'fila' AND EXISTS (
        SELECT 1 FROM public.suporte_fila_agentes fa
        WHERE fa.fila_id = suporte_respostas_rapidas.fila_id
          AND fa.user_id = auth.uid()
          AND COALESCE(fa.ativo, true)
      ))
  OR (escopo = 'fila' AND has_role(auth.uid(), 'admin'::app_role))
);

-- INSERT: admin em qualquer escopo; usuário só em escopo pessoal
CREATE POLICY sup_macros_ins ON public.suporte_respostas_rapidas
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (escopo = 'usuario' AND user_id = auth.uid())
);

-- UPDATE: admin global/fila; dono da pessoal
CREATE POLICY sup_macros_upd ON public.suporte_respostas_rapidas
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (escopo = 'usuario' AND user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (escopo = 'usuario' AND user_id = auth.uid())
);

-- DELETE: idem
CREATE POLICY sup_macros_del ON public.suporte_respostas_rapidas
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (escopo = 'usuario' AND user_id = auth.uid())
);
