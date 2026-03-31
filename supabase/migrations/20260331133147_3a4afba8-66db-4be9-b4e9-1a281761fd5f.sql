
-- Remover tabelas sensíveis do Realtime (sem IF EXISTS)
DO $$
BEGIN
  -- china_chat_mensagens
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.china_chat_mensagens;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- fabrica_ficha_custo_revisoes
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.fabrica_ficha_custo_revisoes;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- fabrica_revisao_mensagens
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.fabrica_revisao_mensagens;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- china_doc_revisoes
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.china_doc_revisoes;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
