-- Criar schema dedicado para extensões
CREATE SCHEMA IF NOT EXISTS extensions;

-- Conceder permissões necessárias
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Mover extensões comuns para o schema extensions
-- Nota: Extensões existentes não podem ser movidas, mas novas extensões serão criadas no schema correto

-- Recriar extensão uuid-ossp no schema extensions (se existir)
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Recriar extensão pgcrypto no schema extensions (se existir)
DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Atualizar search_path para incluir extensions
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Comentário de documentação
COMMENT ON SCHEMA extensions IS 'Schema dedicado para extensões PostgreSQL - melhor prática de segurança';