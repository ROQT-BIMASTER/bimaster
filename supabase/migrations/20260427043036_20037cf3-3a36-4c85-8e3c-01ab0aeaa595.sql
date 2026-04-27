
-- ============================================================
-- COMPRAS INTERNACIONAIS BRASIL ↔ CHINA — GOVERNANÇA COMPLETA
-- ============================================================

-- A. ITENS DE OC ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.china_ordem_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id uuid NOT NULL REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  submissao_id uuid NOT NULL,
  cor_id uuid REFERENCES public.china_produto_cores(id) ON DELETE SET NULL,
  produto_codigo text NOT NULL,
  sku text,
  cor_nome text,
  qty_pedida integer NOT NULL CHECK (qty_pedida >= 0),
  qty_produzida integer NOT NULL DEFAULT 0,
  qty_embarcada integer NOT NULL DEFAULT 0,
  qty_recebida integer NOT NULL DEFAULT 0,
  qty_cancelada integer NOT NULL DEFAULT 0,
  preco_unitario_usd numeric(12,4),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','parcial','fechado','cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_china_ordem_itens_oc ON public.china_ordem_itens(ordem_compra_id);
CREATE INDEX IF NOT EXISTS idx_china_ordem_itens_sub ON public.china_ordem_itens(submissao_id);
ALTER TABLE public.china_ordem_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view china_ordem_itens" ON public.china_ordem_itens FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert china_ordem_itens" ON public.china_ordem_itens FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update china_ordem_itens" ON public.china_ordem_itens FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete china_ordem_itens" ON public.china_ordem_itens FOR DELETE USING (auth.uid() IS NOT NULL);

-- Backfill: gera 1 item por cor para OCs existentes (proporcional)
INSERT INTO public.china_ordem_itens (ordem_compra_id, submissao_id, cor_id, produto_codigo, cor_nome, qty_pedida)
SELECT
  oc.id,
  oc.submissao_id,
  c.id,
  oc.produto_codigo,
  c.cor_nome,
  c.quantidade
FROM public.china_ordens_compra oc
JOIN public.china_produto_cores c ON c.submissao_id = oc.submissao_id
WHERE NOT EXISTS (SELECT 1 FROM public.china_ordem_itens oi WHERE oi.ordem_compra_id = oc.id);

-- Para OCs sem cores cadastradas, cria uma linha única
INSERT INTO public.china_ordem_itens (ordem_compra_id, submissao_id, produto_codigo, cor_nome, qty_pedida)
SELECT
  oc.id,
  oc.submissao_id,
  oc.produto_codigo,
  'Único',
  oc.qty_total
FROM public.china_ordens_compra oc
WHERE NOT EXISTS (SELECT 1 FROM public.china_ordem_itens oi WHERE oi.ordem_compra_id = oc.id);

-- Backfill qty_produzida a partir dos apontamentos existentes
UPDATE public.china_ordem_itens oi
SET qty_produzida = COALESCE(sub.qty, 0)
FROM (
  SELECT a.ordem_compra_id, a.cor_nome, SUM(a.quantidade)::int AS qty
  FROM public.china_producao_apontamentos a
  GROUP BY a.ordem_compra_id, a.cor_nome
) sub
WHERE oi.ordem_compra_id = sub.ordem_compra_id
  AND oi.cor_nome = sub.cor_nome;


-- B. EMBARQUES PARCIAIS ----------------------------------------
ALTER TABLE public.china_embarques
  ADD COLUMN IF NOT EXISTS numero_embarque integer,
  ADD COLUMN IF NOT EXISTS tipo_embarque text DEFAULT 'parcial' CHECK (tipo_embarque IN ('parcial','final','unico'));

CREATE TABLE IF NOT EXISTS public.china_embarque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.china_embarques(id) ON DELETE CASCADE,
  ordem_item_id uuid NOT NULL REFERENCES public.china_ordem_itens(id) ON DELETE RESTRICT,
  qty_embarcada integer NOT NULL CHECK (qty_embarcada > 0),
  lote text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_china_embarque_itens_emb ON public.china_embarque_itens(embarque_id);
CREATE INDEX IF NOT EXISTS idx_china_embarque_itens_oi ON public.china_embarque_itens(ordem_item_id);
ALTER TABLE public.china_embarque_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view china_embarque_itens" ON public.china_embarque_itens FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert china_embarque_itens" ON public.china_embarque_itens FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update china_embarque_itens" ON public.china_embarque_itens FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete china_embarque_itens" ON public.china_embarque_itens FOR DELETE USING (auth.uid() IS NOT NULL);


-- C. RECEBIMENTO FÍSICO BRASIL --------------------------------
CREATE TABLE IF NOT EXISTS public.china_recebimentos_carga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid REFERENCES public.china_embarques(id) ON DELETE SET NULL,
  ordem_compra_id uuid NOT NULL REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  numero_di text,
  data_chegada_porto date,
  data_desembaraco date,
  data_recebimento_cd date,
  conferente_id uuid,
  status text NOT NULL DEFAULT 'em_transito' CHECK (status IN ('em_transito','chegou','conferindo','divergente','recebido','encerrado')),
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_china_receb_oc ON public.china_recebimentos_carga(ordem_compra_id);
CREATE INDEX IF NOT EXISTS idx_china_receb_emb ON public.china_recebimentos_carga(embarque_id);
ALTER TABLE public.china_recebimentos_carga ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view china_recebimentos_carga" ON public.china_recebimentos_carga FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert china_recebimentos_carga" ON public.china_recebimentos_carga FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update china_recebimentos_carga" ON public.china_recebimentos_carga FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete china_recebimentos_carga" ON public.china_recebimentos_carga FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.china_recebimento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id uuid NOT NULL REFERENCES public.china_recebimentos_carga(id) ON DELETE CASCADE,
  embarque_item_id uuid REFERENCES public.china_embarque_itens(id) ON DELETE SET NULL,
  ordem_item_id uuid NOT NULL REFERENCES public.china_ordem_itens(id) ON DELETE RESTRICT,
  qty_esperada integer NOT NULL DEFAULT 0,
  qty_recebida integer NOT NULL DEFAULT 0,
  qty_avariada integer NOT NULL DEFAULT 0,
  qty_faltante integer NOT NULL DEFAULT 0,
  motivo_divergencia text,
  foto_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_china_receb_itens_r ON public.china_recebimento_itens(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_china_receb_itens_oi ON public.china_recebimento_itens(ordem_item_id);
ALTER TABLE public.china_recebimento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view china_recebimento_itens" ON public.china_recebimento_itens FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert china_recebimento_itens" ON public.china_recebimento_itens FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update china_recebimento_itens" ON public.china_recebimento_itens FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete china_recebimento_itens" ON public.china_recebimento_itens FOR DELETE USING (auth.uid() IS NOT NULL);


-- D. NÃO-CONFORMIDADES BILATERAIS -----------------------------
CREATE TABLE IF NOT EXISTS public.china_nao_conformidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nc text NOT NULL,
  ordem_compra_id uuid NOT NULL REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  embarque_id uuid REFERENCES public.china_embarques(id) ON DELETE SET NULL,
  recebimento_id uuid REFERENCES public.china_recebimentos_carga(id) ON DELETE SET NULL,
  ordem_item_id uuid REFERENCES public.china_ordem_itens(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('faltante','avariado','errado','atraso','qualidade','outro')),
  qty_envolvida integer DEFAULT 0,
  descricao text NOT NULL,
  severidade text NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta','critica')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_tratativa','resolvida','cancelada')),
  aberta_por uuid,
  responsavel_china_id uuid,
  responsavel_brasil_id uuid,
  prazo date,
  resolucao text,
  evidencias jsonb DEFAULT '[]'::jsonb,
  origem_automatica boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolvida_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_china_nc_oc ON public.china_nao_conformidades(ordem_compra_id);
CREATE INDEX IF NOT EXISTS idx_china_nc_status ON public.china_nao_conformidades(status);
ALTER TABLE public.china_nao_conformidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view china_nc" ON public.china_nao_conformidades FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert china_nc" ON public.china_nao_conformidades FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update china_nc" ON public.china_nao_conformidades FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete china_nc" ON public.china_nao_conformidades FOR DELETE USING (auth.uid() IS NOT NULL);


-- E. DECISÃO DE SALDO -----------------------------------------
CREATE TABLE IF NOT EXISTS public.china_oc_saldo_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id uuid NOT NULL REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  ordem_item_id uuid REFERENCES public.china_ordem_itens(id) ON DELETE SET NULL,
  qty_remanescente integer NOT NULL,
  decisao text NOT NULL CHECK (decisao IN ('manter_aberta','fechar_parcial','cancelar_saldo','gerar_nova_oc')),
  nova_oc_id uuid REFERENCES public.china_ordens_compra(id) ON DELETE SET NULL,
  justificativa text,
  decidido_por uuid,
  decidido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_china_saldo_oc ON public.china_oc_saldo_decisoes(ordem_compra_id);
ALTER TABLE public.china_oc_saldo_decisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view china_saldo_dec" ON public.china_oc_saldo_decisoes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert china_saldo_dec" ON public.china_oc_saldo_decisoes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update china_saldo_dec" ON public.china_oc_saldo_decisoes FOR UPDATE USING (auth.uid() IS NOT NULL);


-- F. LANDED COST POR OC ---------------------------------------
CREATE TABLE IF NOT EXISTS public.china_oc_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id uuid NOT NULL UNIQUE REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  valor_fob_usd numeric(14,2) NOT NULL DEFAULT 0,
  valor_frete_usd numeric(14,2) NOT NULL DEFAULT 0,
  valor_seguro_usd numeric(14,2) NOT NULL DEFAULT 0,
  taxa_cambio numeric(10,4) NOT NULL DEFAULT 0,
  ii_perc numeric(6,4) NOT NULL DEFAULT 0,
  ipi_perc numeric(6,4) NOT NULL DEFAULT 0,
  icms_perc numeric(6,4) NOT NULL DEFAULT 0,
  pis_cofins_perc numeric(6,4) NOT NULL DEFAULT 0,
  custos_extras_brl numeric(14,2) NOT NULL DEFAULT 0,
  custo_total_brl numeric(14,2),
  custo_unitario_por_item jsonb DEFAULT '{}'::jsonb,
  calculado_em timestamptz,
  calculado_por uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.china_oc_custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view china_oc_custos" ON public.china_oc_custos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert china_oc_custos" ON public.china_oc_custos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update china_oc_custos" ON public.china_oc_custos FOR UPDATE USING (auth.uid() IS NOT NULL);


-- ============================================================
-- TRIGGERS DE AGREGAÇÃO E AUTOMAÇÃO
-- ============================================================

-- Função utilitária: recalcula status de uma linha de OC
CREATE OR REPLACE FUNCTION public.fn_china_oi_recalc_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  efetiva integer;
BEGIN
  efetiva := NEW.qty_pedida - COALESCE(NEW.qty_cancelada, 0);
  IF NEW.qty_recebida >= efetiva AND efetiva > 0 THEN
    NEW.status := 'fechado';
  ELSIF NEW.qty_cancelada >= NEW.qty_pedida AND NEW.qty_pedida > 0 THEN
    NEW.status := 'cancelado';
  ELSIF NEW.qty_produzida > 0 OR NEW.qty_embarcada > 0 OR NEW.qty_recebida > 0 THEN
    NEW.status := 'parcial';
  ELSE
    NEW.status := 'aberto';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_oi_recalc ON public.china_ordem_itens;
CREATE TRIGGER trg_china_oi_recalc
BEFORE UPDATE OF qty_produzida, qty_embarcada, qty_recebida, qty_cancelada
ON public.china_ordem_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_china_oi_recalc_status();


-- Quando todas as linhas fecham, OC vira concluida
CREATE OR REPLACE FUNCTION public.fn_china_oc_recalc_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_fechadas int;
  v_oc uuid;
BEGIN
  v_oc := NEW.ordem_compra_id;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('fechado','cancelado'))
    INTO v_total, v_fechadas
    FROM public.china_ordem_itens WHERE ordem_compra_id = v_oc;

  IF v_total > 0 AND v_total = v_fechadas THEN
    UPDATE public.china_ordens_compra
       SET status = 'concluida', data_entrega_real = COALESCE(data_entrega_real, CURRENT_DATE), updated_at = now()
     WHERE id = v_oc AND status NOT IN ('concluida','cancelada','rejeitada');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_oc_recalc ON public.china_ordem_itens;
CREATE TRIGGER trg_china_oc_recalc
AFTER UPDATE OF status ON public.china_ordem_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_china_oc_recalc_status();


-- Apontamento de produção → atualiza qty_produzida do item correto
CREATE OR REPLACE FUNCTION public.fn_china_apont_to_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oi uuid;
  v_qty int;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_qty := NEW.quantidade;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_qty := COALESCE(NEW.quantidade,0) - COALESCE(OLD.quantidade,0);
  ELSIF (TG_OP = 'DELETE') THEN
    v_qty := -COALESCE(OLD.quantidade,0);
  END IF;

  SELECT id INTO v_oi FROM public.china_ordem_itens
   WHERE ordem_compra_id = COALESCE(NEW.ordem_compra_id, OLD.ordem_compra_id)
     AND cor_nome = COALESCE(NEW.cor_nome, OLD.cor_nome)
   LIMIT 1;

  IF v_oi IS NOT NULL THEN
    UPDATE public.china_ordem_itens
       SET qty_produzida = GREATEST(0, qty_produzida + v_qty)
     WHERE id = v_oi;
  END IF;

  -- Mantém o agregado da OC para retrocompatibilidade
  UPDATE public.china_ordens_compra oc
     SET qty_produzida = COALESCE((SELECT SUM(qty_produzida) FROM public.china_ordem_itens WHERE ordem_compra_id = oc.id), 0),
         updated_at = now()
   WHERE oc.id = COALESCE(NEW.ordem_compra_id, OLD.ordem_compra_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_china_apont_item ON public.china_producao_apontamentos;
CREATE TRIGGER trg_china_apont_item
AFTER INSERT OR UPDATE OR DELETE ON public.china_producao_apontamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_china_apont_to_item();


-- Embarque de item → atualiza qty_embarcada
CREATE OR REPLACE FUNCTION public.fn_china_emb_item_aggr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty int;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_qty := NEW.qty_embarcada;
    UPDATE public.china_ordem_itens SET qty_embarcada = qty_embarcada + v_qty WHERE id = NEW.ordem_item_id;
  ELSIF (TG_OP = 'DELETE') THEN
    v_qty := OLD.qty_embarcada;
    UPDATE public.china_ordem_itens SET qty_embarcada = GREATEST(0, qty_embarcada - v_qty) WHERE id = OLD.ordem_item_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_qty := NEW.qty_embarcada - OLD.qty_embarcada;
    UPDATE public.china_ordem_itens SET qty_embarcada = GREATEST(0, qty_embarcada + v_qty) WHERE id = NEW.ordem_item_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_china_emb_item_aggr ON public.china_embarque_itens;
CREATE TRIGGER trg_china_emb_item_aggr
AFTER INSERT OR UPDATE OR DELETE ON public.china_embarque_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_china_emb_item_aggr();


-- Recebimento → atualiza qty_recebida e gera NC automática se houver divergência
CREATE OR REPLACE FUNCTION public.fn_china_receb_aggr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc uuid;
  v_diff int;
  v_seq int;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.china_ordem_itens SET qty_recebida = qty_recebida + NEW.qty_recebida WHERE id = NEW.ordem_item_id;

    SELECT ordem_compra_id INTO v_oc FROM public.china_recebimentos_carga WHERE id = NEW.recebimento_id;
    v_diff := COALESCE(NEW.qty_esperada,0) - COALESCE(NEW.qty_recebida,0) + COALESCE(NEW.qty_avariada,0);

    IF v_diff > 0 AND v_oc IS NOT NULL THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_nc, '\D','','g'),'')::int),0)+1 INTO v_seq FROM public.china_nao_conformidades;
      INSERT INTO public.china_nao_conformidades (
        numero_nc, ordem_compra_id, recebimento_id, ordem_item_id,
        tipo, qty_envolvida, descricao, severidade, origem_automatica, status
      ) VALUES (
        'NC-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(v_seq::text, 4, '0'),
        v_oc, NEW.recebimento_id, NEW.ordem_item_id,
        CASE WHEN COALESCE(NEW.qty_avariada,0) > 0 THEN 'avariado' ELSE 'faltante' END,
        v_diff,
        format('Divergência automática no recebimento: esperado %s, recebido %s, avariado %s. %s',
               NEW.qty_esperada, NEW.qty_recebida, COALESCE(NEW.qty_avariada,0),
               COALESCE(NEW.motivo_divergencia,'')),
        CASE WHEN v_diff > 100 THEN 'alta' WHEN v_diff > 20 THEN 'media' ELSE 'baixa' END,
        true,
        'aberta'
      );
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.china_ordem_itens SET qty_recebida = GREATEST(0, qty_recebida - OLD.qty_recebida) WHERE id = OLD.ordem_item_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE public.china_ordem_itens
       SET qty_recebida = GREATEST(0, qty_recebida + (NEW.qty_recebida - OLD.qty_recebida))
     WHERE id = NEW.ordem_item_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_china_receb_aggr ON public.china_recebimento_itens;
CREATE TRIGGER trg_china_receb_aggr
AFTER INSERT OR UPDATE OR DELETE ON public.china_recebimento_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_china_receb_aggr();


-- updated_at automatic
CREATE TRIGGER trg_china_oi_uat BEFORE UPDATE ON public.china_ordem_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_china_receb_uat BEFORE UPDATE ON public.china_recebimentos_carga
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_china_nc_uat BEFORE UPDATE ON public.china_nao_conformidades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_china_oc_custos_uat BEFORE UPDATE ON public.china_oc_custos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
