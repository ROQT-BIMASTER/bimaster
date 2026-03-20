-- SEG-2: API Key hashing for erp_config
-- Enable pgcrypto if not already
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add hash column
ALTER TABLE public.erp_config ADD COLUMN IF NOT EXISTS api_key_hash TEXT;

-- Create hash function
CREATE OR REPLACE FUNCTION public.hash_api_key(key TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(digest(key, 'sha256'), 'hex');
$$;

-- Trigger to auto-hash on insert/update
CREATE OR REPLACE FUNCTION public.trg_hash_api_key()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.api_key IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.api_key IS DISTINCT FROM OLD.api_key) THEN
    NEW.api_key_hash := encode(digest(NEW.api_key, 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hash_api_key_trigger ON public.erp_config;
CREATE TRIGGER hash_api_key_trigger
  BEFORE INSERT OR UPDATE ON public.erp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_hash_api_key();

-- Backfill existing keys
UPDATE public.erp_config
SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
WHERE api_key IS NOT NULL AND api_key_hash IS NULL;