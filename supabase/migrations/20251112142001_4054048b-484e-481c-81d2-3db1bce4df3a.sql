-- Adicionar campos de sentimento na tabela de conversas WhatsApp
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative')),
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
ADD COLUMN IF NOT EXISTS sentiment_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para buscar por sentimento
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_sentiment ON whatsapp_conversations(sentiment);

-- Comentários nas colunas
COMMENT ON COLUMN whatsapp_conversations.sentiment IS 'Sentimento da conversa: positive, neutral, negative';
COMMENT ON COLUMN whatsapp_conversations.sentiment_score IS 'Score de sentimento de -1 (negativo) a 1 (positivo)';
COMMENT ON COLUMN whatsapp_conversations.sentiment_analyzed_at IS 'Timestamp da última análise de sentimento';