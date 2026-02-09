
-- Tabela de histórico de alterações de custo de insumos
CREATE TABLE public.fabrica_insumo_custo_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_custo_id UUID REFERENCES public.fabrica_produto_custos(id) ON DELETE SET NULL,
  produto_id UUID NOT NULL,
  mp_id UUID,
  insumo_nome TEXT,
  campo TEXT NOT NULL CHECK (campo IN ('custo_nf', 'custo_servico', 'custo_condicao')),
  valor_anterior NUMERIC NOT NULL DEFAULT 0,
  valor_novo NUMERIC NOT NULL DEFAULT 0,
  motivo TEXT,
  usuario_id UUID,
  usuario_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para consultas por insumo
CREATE INDEX idx_fabrica_insumo_custo_historico_produto_custo ON public.fabrica_insumo_custo_historico(produto_custo_id);
CREATE INDEX idx_fabrica_insumo_custo_historico_produto ON public.fabrica_insumo_custo_historico(produto_id);

-- Enable RLS
ALTER TABLE public.fabrica_insumo_custo_historico ENABLE ROW LEVEL SECURITY;

-- Append-only: authenticated users can SELECT and INSERT
CREATE POLICY "Authenticated users can view cost history"
ON public.fabrica_insumo_custo_historico
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert cost history"
ON public.fabrica_insumo_custo_historico
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Trigger para registrar alterações automaticamente
CREATE OR REPLACE FUNCTION public.log_insumo_custo_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.custo_nf IS DISTINCT FROM NEW.custo_nf THEN
    INSERT INTO public.fabrica_insumo_custo_historico
      (produto_custo_id, produto_id, mp_id, insumo_nome, campo, valor_anterior, valor_novo, usuario_id)
    VALUES
      (NEW.id, NEW.produto_id, NEW.mp_id, NEW.nome, 'custo_nf', COALESCE(OLD.custo_nf, 0), COALESCE(NEW.custo_nf, 0), auth.uid());
  END IF;

  IF OLD.custo_servico IS DISTINCT FROM NEW.custo_servico THEN
    INSERT INTO public.fabrica_insumo_custo_historico
      (produto_custo_id, produto_id, mp_id, insumo_nome, campo, valor_anterior, valor_novo, usuario_id)
    VALUES
      (NEW.id, NEW.produto_id, NEW.mp_id, NEW.nome, 'custo_servico', COALESCE(OLD.custo_servico, 0), COALESCE(NEW.custo_servico, 0), auth.uid());
  END IF;

  IF OLD.custo_condicao IS DISTINCT FROM NEW.custo_condicao THEN
    INSERT INTO public.fabrica_insumo_custo_historico
      (produto_custo_id, produto_id, mp_id, insumo_nome, campo, valor_anterior, valor_novo, usuario_id)
    VALUES
      (NEW.id, NEW.produto_id, NEW.mp_id, NEW.nome, 'custo_condicao', COALESCE(OLD.custo_condicao, 0), COALESCE(NEW.custo_condicao, 0), auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_insumo_custo_change
BEFORE UPDATE ON public.fabrica_produto_custos
FOR EACH ROW
EXECUTE FUNCTION public.log_insumo_custo_change();
