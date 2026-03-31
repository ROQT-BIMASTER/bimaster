
-- RPC para executar a migração atômica do plano de contas
CREATE OR REPLACE FUNCTION public.executar_migracao_plano_contas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backup_count integer;
  v_update_count integer;
BEGIN
  -- Verificar se o usuário é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar a migração';
  END IF;

  -- Verificar se todos os mapeamentos estão confirmados
  IF EXISTS (SELECT 1 FROM plano_contas_migracao WHERE confirmado = false) THEN
    RAISE EXCEPTION 'Existem mapeamentos não confirmados. Confirme todos antes de executar.';
  END IF;

  -- Step 1: Backup
  INSERT INTO contas_pagar_backup_plano (id, plano_contas_id, plano_contas_codigo, plano_contas_nome)
  SELECT id, plano_contas_id, plano_contas_codigo, plano_contas_nome
  FROM contas_pagar
  WHERE plano_contas_id IS NOT NULL
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_backup_count = ROW_COUNT;
  RAISE NOTICE 'Backup: % registros salvos', v_backup_count;

  -- Step 2: Update contas_pagar com novo mapeamento
  UPDATE contas_pagar cp
  SET plano_contas_id = m.new_account_id,
      plano_contas_codigo = m.new_code,
      plano_contas_nome = m.new_name
  FROM plano_contas_migracao m
  WHERE cp.plano_contas_id = m.old_account_id
    AND m.confirmado = true;

  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  RAISE NOTICE 'Update: % títulos reclassificados', v_update_count;

  -- Step 3: Desativar contas v1
  UPDATE trade_chart_of_accounts 
  SET is_active = false 
  WHERE versao = 'v1';

  -- Step 4: Ativar contas v2
  UPDATE trade_chart_of_accounts 
  SET is_active = true 
  WHERE versao = 'v2';

  RAISE NOTICE 'Migração concluída: % títulos reclassificados', v_update_count;
END;
$$;
