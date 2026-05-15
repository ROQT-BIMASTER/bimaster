
-- 1) Permite ao criador atualizar sua própria versão enquanto ainda não foi aprovada.
DROP POLICY IF EXISTS "Criador atualiza propria versao pendente" ON public.fabrica_tabelas_preco_versoes;
CREATE POLICY "Criador atualiza propria versao pendente"
ON public.fabrica_tabelas_preco_versoes
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() AND aprovado_em IS NULL)
WITH CHECK (created_by = auth.uid() AND aprovado_em IS NULL);

-- 2) Trigger atualizada: snapshot E escopo respeitam o GUC app.escopo_submissao quando definido.
CREATE OR REPLACE FUNCTION public.criar_versao_tabela_preco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_versao integer;
  v_precos jsonb;
  v_escopo_raw text;
  v_escopo uuid[];
BEGIN
  IF NEW.status = 'pending_approval' AND (OLD.status IS NULL OR OLD.status != 'pending_approval') THEN
    SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
    FROM fabrica_tabelas_preco_versoes
    WHERE tabela_id = NEW.id;

    -- Lê escopo opcional definido via SET LOCAL pelo app.
    v_escopo_raw := current_setting('app.escopo_submissao', true);
    IF v_escopo_raw IS NOT NULL AND length(trim(v_escopo_raw)) > 0 THEN
      BEGIN
        v_escopo := string_to_array(v_escopo_raw, ',')::uuid[];
      EXCEPTION WHEN others THEN
        v_escopo := NULL;
      END;
    END IF;

    -- Snapshot filtrado pelo escopo quando informado; senão snapshot completo (legado).
    SELECT jsonb_agg(
      jsonb_build_object(
        'produto_id', produto_id,
        'custo_base', custo_base,
        'preco_final', preco_final,
        'margem_lucro_percentual', margem_lucro_percentual
      )
    ) INTO v_precos
    FROM fabrica_precos_produtos
    WHERE tabela_id = NEW.id
      AND (v_escopo IS NULL OR produto_id = ANY(v_escopo));

    INSERT INTO fabrica_tabelas_preco_versoes (
      tabela_id, versao, precos_snapshot, created_by, produto_ids_escopo
    ) VALUES (
      NEW.id, v_versao, COALESCE(v_precos, '[]'::jsonb), auth.uid(),
      CASE WHEN v_escopo IS NOT NULL THEN (SELECT array_agg(x::text) FROM unnest(v_escopo) x) ELSE NULL END
    );

    INSERT INTO fabrica_tabelas_preco_auditoria (
      tabela_id, user_id, acao, mensagem
    ) VALUES (
      NEW.id, auth.uid(), 'pending_approval',
      'Tabela enviada para aprovação - Versão ' || v_versao
    );
  END IF;

  RETURN NEW;
END;
$function$;
