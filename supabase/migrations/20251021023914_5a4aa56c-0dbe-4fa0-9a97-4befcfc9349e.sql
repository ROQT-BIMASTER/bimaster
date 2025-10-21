-- Create chart of accounts table (only if doesn't exist)
CREATE TABLE IF NOT EXISTS public.trade_chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) NOT NULL,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  description TEXT,
  parent_account_id UUID REFERENCES public.trade_chart_of_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trade_chart_of_accounts_code_key'
  ) THEN
    ALTER TABLE public.trade_chart_of_accounts ADD CONSTRAINT trade_chart_of_accounts_code_key UNIQUE (code);
  END IF;
END $$;

-- Create indexes only if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_trade_chart_of_accounts_active') THEN
    CREATE INDEX idx_trade_chart_of_accounts_active ON public.trade_chart_of_accounts(is_active);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_trade_chart_of_accounts_type') THEN
    CREATE INDEX idx_trade_chart_of_accounts_type ON public.trade_chart_of_accounts(account_type);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.trade_chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view chart of accounts" ON public.trade_chart_of_accounts;
DROP POLICY IF EXISTS "Admins can manage chart of accounts" ON public.trade_chart_of_accounts;

-- RLS Policies for trade_chart_of_accounts
CREATE POLICY "Authenticated users can view chart of accounts"
  ON public.trade_chart_of_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage chart of accounts"
  ON public.trade_chart_of_accounts FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- Create or replace the timestamp trigger
DROP TRIGGER IF EXISTS update_trade_chart_of_accounts_timestamp ON public.trade_chart_of_accounts;
CREATE TRIGGER update_trade_chart_of_accounts_timestamp
  BEFORE UPDATE ON public.trade_chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();