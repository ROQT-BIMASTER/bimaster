-- ============================================
-- CORREÇÕES DE SEGURANÇA
-- ============================================

-- 1. Habilitar RLS na tabela fabrica_cst_referencia
ALTER TABLE fabrica_cst_referencia ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de acesso para fabrica_cst_referencia
CREATE POLICY "Usuários com permissão fabrica podem ver CSTs"
ON fabrica_cst_referencia
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM usuario_permissoes_modulos upm
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE ms.codigo = 'fabrica'
    AND upm.usuario_id = auth.uid()
  )
);

CREATE POLICY "Admins e supervisores gerenciam CSTs"
ON fabrica_cst_referencia
FOR ALL
USING (is_admin_or_supervisor(auth.uid()))
WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- 3. Corrigir search_path das funções criadas
CREATE OR REPLACE FUNCTION public.icms_gera_credito(p_cst text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  CASE p_cst
    WHEN '00' THEN RETURN true;
    WHEN '10' THEN RETURN false;
    WHEN '20' THEN RETURN true;
    WHEN '30' THEN RETURN false;
    WHEN '40', '41', '50' THEN RETURN false;
    WHEN '51' THEN RETURN false;
    WHEN '60' THEN RETURN false;
    WHEN '70' THEN RETURN false;
    WHEN '90' THEN RETURN true;
    ELSE RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.icms_tipo_credito(p_cst text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  CASE p_cst
    WHEN '00' THEN RETURN 'integral';
    WHEN '20' THEN RETURN 'proporcional';
    WHEN '90' THEN RETURN 'parcial';
    WHEN '10', '30', '40', '41', '50', '51', '60', '70' THEN RETURN 'sem_credito';
    ELSE RETURN 'sem_credito';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.pis_cofins_gera_credito(p_cst text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  CASE p_cst
    WHEN '01', '02' THEN RETURN true;
    WHEN '03' THEN RETURN false;
    WHEN '04', '05', '06' THEN RETURN false;
    WHEN '07', '08', '09' THEN RETURN false;
    WHEN '50', '51', '52', '53', '54', '55', '56' THEN RETURN true;
    WHEN '60' THEN RETURN false;
    WHEN '70', '71', '72', '73', '74' THEN RETURN false;
    ELSE RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.pis_cofins_tipo_credito(p_cst text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  CASE p_cst
    WHEN '01', '02' THEN RETURN 'integral';
    WHEN '50', '51', '52', '53', '54', '55', '56' THEN RETURN 'nao_cumulativo';
    WHEN '03' THEN RETURN 'monofasico_sem_credito';
    WHEN '60' THEN RETURN 'st_sem_credito';
    WHEN '04', '05', '06', '07', '08', '09', '70', '71', '72', '73', '74' THEN RETURN 'sem_credito';
    ELSE RETURN 'sem_credito';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_creditos_nota_fiscal(p_nota_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_result jsonb := '[]'::jsonb;
  v_icms_credito boolean;
  v_pis_credito boolean;
  v_cofins_credito boolean;
  v_item_result jsonb;
BEGIN
  FOR v_item IN 
    SELECT 
      id,
      produto_codigo,
      produto_descricao,
      cst_icms,
      cst_pis,
      cst_cofins,
      valor_icms,
      valor_pis,
      valor_cofins,
      tem_icms_st
    FROM fabrica_itens_nf
    WHERE nota_id = p_nota_id
  LOOP
    v_icms_credito := public.icms_gera_credito(v_item.cst_icms);
    
    IF v_item.tem_icms_st THEN
      v_icms_credito := false;
    END IF;
    
    v_pis_credito := public.pis_cofins_gera_credito(v_item.cst_pis);
    v_cofins_credito := public.pis_cofins_gera_credito(v_item.cst_cofins);
    
    v_item_result := jsonb_build_object(
      'item_id', v_item.id,
      'produto_codigo', v_item.produto_codigo,
      'produto_descricao', v_item.produto_descricao,
      'icms', jsonb_build_object(
        'cst', v_item.cst_icms,
        'gera_credito', v_icms_credito,
        'valor', v_item.valor_icms,
        'tipo_credito', public.icms_tipo_credito(v_item.cst_icms),
        'tem_st', v_item.tem_icms_st
      ),
      'pis', jsonb_build_object(
        'cst', v_item.cst_pis,
        'gera_credito', v_pis_credito,
        'valor', v_item.valor_pis,
        'tipo_credito', public.pis_cofins_tipo_credito(v_item.cst_pis)
      ),
      'cofins', jsonb_build_object(
        'cst', v_item.cst_cofins,
        'gera_credito', v_cofins_credito,
        'valor', v_item.valor_cofins,
        'tipo_credito', public.pis_cofins_tipo_credito(v_item.cst_cofins)
      )
    );
    
    v_result := v_result || v_item_result;
  END LOOP;
  
  RETURN v_result;
END;
$$;