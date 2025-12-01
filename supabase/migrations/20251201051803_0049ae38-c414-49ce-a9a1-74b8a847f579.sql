-- Corrigir função criar_versao_tabela_preco para usar coluna correta margem_lucro_percentual
CREATE OR REPLACE FUNCTION public.criar_versao_tabela_preco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_versao integer;
  v_precos jsonb;
BEGIN
  -- Só criar versão quando mudar para pending_approval
  IF NEW.status = 'pending_approval' AND (OLD.status IS NULL OR OLD.status != 'pending_approval') THEN
    -- Buscar última versão
    SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
    FROM fabrica_tabelas_preco_versoes
    WHERE tabela_id = NEW.id;
    
    -- Buscar snapshot dos preços atuais (usando coluna margem_lucro_percentual existente)
    SELECT jsonb_agg(
      jsonb_build_object(
        'produto_id', produto_id,
        'custo_base', custo_base,
        'preco_final', preco_final,
        'margem_lucro_percentual', margem_lucro_percentual
      )
    ) INTO v_precos
    FROM fabrica_precos_produtos
    WHERE tabela_id = NEW.id;
    
    -- Criar nova versão
    INSERT INTO fabrica_tabelas_preco_versoes (
      tabela_id,
      versao,
      precos_snapshot,
      created_by
    ) VALUES (
      NEW.id,
      v_versao,
      COALESCE(v_precos, '[]'::jsonb),
      auth.uid()
    );
    
    -- Registrar na auditoria
    INSERT INTO fabrica_tabelas_preco_auditoria (
      tabela_id,
      user_id,
      acao,
      mensagem
    ) VALUES (
      NEW.id,
      auth.uid(),
      'pending_approval',
      'Tabela enviada para aprovação - Versão ' || v_versao
    );
  END IF;
  
  RETURN NEW;
END;
$function$;