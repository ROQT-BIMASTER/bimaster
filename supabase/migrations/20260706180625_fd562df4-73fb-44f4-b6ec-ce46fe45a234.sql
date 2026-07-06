CREATE OR REPLACE FUNCTION public.fn_despesa_detectar_r10_orcamento()
 RETURNS TABLE(inseridos integer, atualizados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ativa boolean;
  v_sev_default text;
  v_ins int := 0;
  v_upd int := 0;
  v_rec record;
  v_dept_nome text;
  v_severidade text;
  v_chave text;
  v_titulo text;
  v_descricao text;
  v_existed boolean;
  v_alerta_id uuid;
BEGIN
  SELECT ativo, severidade_default INTO v_ativa, v_sev_default
  FROM public.despesa_regras WHERE codigo = 'R10_ORCAMENTO_DEGRAU';
  IF NOT COALESCE(v_ativa, false) THEN
    inseridos := 0; atualizados := 0; RETURN NEXT; RETURN;
  END IF;

  FOR v_rec IN
    SELECT p.id AS period_id, p.nome AS period_nome, p.status::text AS period_status,
           s.department_id, s.valor_alocado, s.valor_comprometido, s.valor_utilizado,
           s.pct_consumido, s.estagio
    FROM public.budget_periods p
    CROSS JOIN LATERAL public.fn_orcamento_saldos(p.id) s
    WHERE (p.status::text = 'ativo'
           OR (p.status::text <> 'ativo'
               AND current_date BETWEEN p.data_inicio AND p.data_fim))
      AND s.distribution_id IS NOT NULL
      AND s.department_id IS NOT NULL
      AND s.estagio <> 'ok'
  LOOP
    v_severidade := CASE v_rec.estagio
      WHEN 'alerta_80'      THEN 'media'
      WHEN 'critico_95'     THEN 'alta'
      WHEN 'estourado_100'  THEN 'critica'
      ELSE COALESCE(v_sev_default, 'alta')
    END;

    v_chave := 'R10|' || v_rec.period_id::text || '|' || v_rec.department_id::text || '|' || v_rec.estagio;

    SELECT nome INTO v_dept_nome FROM public.departamentos WHERE id = v_rec.department_id;

    v_titulo := 'Orçamento ' || COALESCE(v_dept_nome, 'departamento')
                || ' — ' || CASE v_rec.estagio
                              WHEN 'alerta_80'     THEN 'atingiu 80%'
                              WHEN 'critico_95'    THEN 'atingiu 95%'
                              WHEN 'estourado_100' THEN 'estourou 100%'
                              ELSE v_rec.estagio END
                || ' (' || v_rec.period_nome || ')';

    v_descricao := 'Consumo agregado (comprometido + realizado) cruzou o degrau '
                   || CASE v_rec.estagio
                        WHEN 'alerta_80' THEN '80%'
                        WHEN 'critico_95' THEN '95%'
                        WHEN 'estourado_100' THEN '100%'
                        ELSE v_rec.estagio END
                   || ' do valor alocado do período. Considere solicitar suplementação.';

    SELECT true INTO v_existed FROM public.despesa_alertas WHERE chave_dedup = v_chave;

    INSERT INTO public.despesa_alertas (
      regra_codigo, chave_dedup, severidade, status, origem,
      titulo, descricao, departamento_id, valor_impacto,
      evidencia, primeiro_detectado_em, ultimo_detectado_em, ocorrencias
    ) VALUES (
      'R10_ORCAMENTO_DEGRAU',
      v_chave,
      v_severidade,
      'novo',
      'auto',
      v_titulo,
      v_descricao,
      v_rec.department_id,
      CASE WHEN v_rec.estagio = 'estourado_100'
           THEN GREATEST(v_rec.valor_comprometido + v_rec.valor_utilizado - v_rec.valor_alocado, 0)
           ELSE v_rec.valor_comprometido + v_rec.valor_utilizado
      END,
      jsonb_build_object(
        'period_id', v_rec.period_id,
        'period_nome', v_rec.period_nome,
        'valor_alocado', v_rec.valor_alocado,
        'valor_comprometido', v_rec.valor_comprometido,
        'valor_utilizado', v_rec.valor_utilizado,
        'pct_consumido', v_rec.pct_consumido,
        'estagio', v_rec.estagio
      ),
      now(), now(), 1
    )
    ON CONFLICT (chave_dedup) DO UPDATE
      SET ultimo_detectado_em = now(),
          ocorrencias = public.despesa_alertas.ocorrencias + 1,
          severidade = EXCLUDED.severidade,
          evidencia = EXCLUDED.evidencia,
          valor_impacto = EXCLUDED.valor_impacto,
          updated_at = now()
    RETURNING id INTO v_alerta_id;

    IF COALESCE(v_existed, false) THEN
      v_upd := v_upd + 1;
    ELSE
      v_ins := v_ins + 1;

      -- Notifica gestores do departamento (só em alertas realmente novos)
      INSERT INTO public.notifications (user_id, type, title, message, action_url)
      SELECT DISTINCT dmr.user_id,
             'orcamento_degrau',
             v_titulo,
             v_descricao,
             '/dashboard/orcamento?tab=consumo'
      FROM public.department_member_roles dmr
      WHERE dmr.department_id = v_rec.department_id
        AND dmr.perfil::text = 'gestor'
        AND dmr.user_id IS NOT NULL;

      -- Em degrau estourado, notifica também financeiro/admin
      IF v_rec.estagio = 'estourado_100' THEN
        INSERT INTO public.notifications (user_id, type, title, message, action_url)
        SELECT DISTINCT ur.user_id,
               'orcamento_degrau',
               v_titulo,
               v_descricao,
               '/dashboard/orcamento?tab=consumo'
        FROM public.user_roles ur
        WHERE ur.role IN ('admin'::app_role, 'financeiro'::app_role)
          AND ur.user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.department_member_roles dmr2
            WHERE dmr2.department_id = v_rec.department_id
              AND dmr2.perfil::text = 'gestor'
              AND dmr2.user_id = ur.user_id
          );
      END IF;
    END IF;
  END LOOP;

  inseridos := v_ins; atualizados := v_upd; RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_despesa_detectar_r10_orcamento() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_despesa_detectar_r10_orcamento() TO authenticated, service_role;