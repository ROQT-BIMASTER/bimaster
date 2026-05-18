-- =========================================================================
-- mensagens_traducoes — cache de tradução do chat corporativo
-- =========================================================================
--
-- Tradução é sob demanda (usuário clica "Traduzir" numa mensagem específica).
-- Para evitar pagar IA toda vez que alguém abre a mesma mensagem, o
-- resultado é cacheado nesta tabela. Chave composta (mensagem_id, idioma)
-- garante 1 tradução por idioma por mensagem.
--
-- Idiomas suportados: pt, en, cn (decisão de produto 2026-05-18).
-- Se precisar de outro idioma no futuro, basta expandir o CHECK.

CREATE TABLE IF NOT EXISTS public.mensagens_traducoes (
  mensagem_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  idioma text NOT NULL CHECK (idioma IN ('pt', 'en', 'cn')),
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mensagem_id, idioma)
);

CREATE INDEX IF NOT EXISTS idx_mensagens_traducoes_mensagem
  ON public.mensagens_traducoes (mensagem_id);

ALTER TABLE public.mensagens_traducoes ENABLE ROW LEVEL SECURITY;

-- SELECT: quem é participante ativo da conversa da mensagem pode ler.
DROP POLICY IF EXISTS chat_traducoes_select ON public.mensagens_traducoes;
CREATE POLICY chat_traducoes_select ON public.mensagens_traducoes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mensagens m
    JOIN public.conversas_participantes cp ON cp.conversa_id = m.conversa_id
    WHERE m.id = mensagens_traducoes.mensagem_id
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

-- INSERT/UPDATE só via edge function (service_role bypassa RLS).
-- Não criamos policy para clientes autenticados — evita gravação direta
-- que driblaria o cache + IA.

COMMENT ON TABLE public.mensagens_traducoes IS
  'Cache de traduções sob demanda do chat corporativo. Populado pela
  edge function chat-traducao. RLS de leitura espelha conversas_participantes.';
