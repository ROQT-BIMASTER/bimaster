
-- Kill-switch contra DELETE em massa em tabelas críticas Fábrica BR.
-- Motivado pelo incidente 2026-05-16 (perda total Fábrica Brasil).
-- Para liberar bulk delete legítimo em uma sessão:
--   SET LOCAL app.allow_bulk_delete = 'on';
--   DELETE FROM fabrica_produtos WHERE ...;

CREATE OR REPLACE FUNCTION public.guard_bulk_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
  v_allow text;
  v_threshold int := 50;
BEGIN
  SELECT count(*) INTO v_count FROM deleted_rows;

  IF v_count <= v_threshold THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_allow := current_setting('app.allow_bulk_delete', true);
  EXCEPTION WHEN OTHERS THEN
    v_allow := NULL;
  END;

  IF v_allow IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      'guard_bulk_delete: tentativa de apagar % linhas de % bloqueada. Para autorizar, execute na mesma transação: SET LOCAL app.allow_bulk_delete = ''on''.',
      v_count, TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_bulk_delete() FROM public, anon, authenticated;

-- Aplica trigger em tabelas críticas. Statement-level com tabela de transição.
DO $$
DECLARE
  t text;
  critical_tables text[] := ARRAY[
    'fabrica_produtos',
    'fabrica_produtos_historico',
    'fabrica_materias_primas',
    'fabrica_formulas',
    'fabrica_formula_itens',
    'fabrica_formula_versoes',
    'fabrica_tabelas_preco',
    'fabrica_precos_produtos',
    'fabrica_notas_fiscais',
    'fabrica_notas_fiscais_saida',
    'fabrica_itens_nf',
    'fabrica_itens_nf_saida',
    'fabrica_ordens_producao',
    'fabrica_produto_custos',
    'fabrica_compras',
    'fabrica_compra_itens'
  ];
BEGIN
  FOREACH t IN ARRAY critical_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_guard_bulk_delete ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_guard_bulk_delete
           AFTER DELETE ON public.%I
           REFERENCING OLD TABLE AS deleted_rows
           FOR EACH STATEMENT
           EXECUTE FUNCTION public.guard_bulk_delete()',
        t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.guard_bulk_delete() IS
'Bloqueia DELETE em massa (>50 linhas) em tabelas Fabrica BR. Liberar com SET LOCAL app.allow_bulk_delete = ''on''. Ref: docs/incidents/2026-05-16-fabrica-br-data-loss.md';
