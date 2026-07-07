
-- Fase 1: Projeto obrigatório por departamento
-- 1) rpc_suporte_fila_criar passa a criar automaticamente o projeto de kanban
-- 2) Backfill: criar projeto para departamentos existentes sem projeto vinculado

CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_criar(
  p_nome text, p_slug text,
  p_descricao text DEFAULT NULL::text,
  p_cor text DEFAULT NULL::text,
  p_icone text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'apenas admin cria departamentos';
  END IF;
  IF coalesce(trim(p_nome),'') = '' OR coalesce(trim(p_slug),'') = '' THEN
    RAISE EXCEPTION 'nome e slug obrigatorios';
  END IF;

  INSERT INTO public.suporte_filas (nome, slug, descricao, cor, icone, ordem, calendario_id)
  VALUES (trim(p_nome), lower(trim(p_slug)), p_descricao, p_cor, p_icone,
          (SELECT coalesce(max(ordem),0)+1 FROM public.suporte_filas),
          (SELECT id FROM public.suporte_calendarios WHERE is_default AND ativo LIMIT 1))
  RETURNING id INTO v_id;

  INSERT INTO public.suporte_sla_policies (fila_id, prioridade, primeira_resposta_horas, resolucao_horas)
  VALUES (v_id,'critica',1,4), (v_id,'alta',2,8), (v_id,'media',4,24), (v_id,'baixa',8,40)
  ON CONFLICT (fila_id, prioridade) DO NOTHING;

  -- Cria projeto de kanban obrigatório do departamento
  BEGIN
    PERFORM public.rpc_suporte_fila_criar_projeto(v_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Falha ao criar projeto para fila %: %', v_id, SQLERRM;
  END;

  RETURN v_id;
END;
$function$;

-- Backfill dos departamentos existentes que ainda não possuem projeto
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, nome FROM public.suporte_filas WHERE projeto_id IS NULL AND ativo LOOP
    BEGIN
      PERFORM public.rpc_suporte_fila_criar_projeto(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill projeto falhou para fila % (%): %', r.nome, r.id, SQLERRM;
    END;
  END LOOP;
END $$;
