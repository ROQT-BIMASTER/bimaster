-- Adicionar coluna para registrar quem atribuiu a visita
ALTER TABLE visits ADD COLUMN IF NOT EXISTS atribuido_por uuid REFERENCES profiles(id);

-- Comentário explicativo
COMMENT ON COLUMN visits.atribuido_por IS 'ID do usuário (supervisor/admin) que atribuiu a visita';
