-- Tabela de mapeamento de usuários Phyllo
CREATE TABLE public.phyllo_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phyllo_user_id TEXT NOT NULL UNIQUE,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phyllo_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own phyllo_users" ON public.phyllo_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own phyllo_users" ON public.phyllo_users FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own phyllo_users" ON public.phyllo_users FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_phyllo_users_user_id ON public.phyllo_users(user_id);
CREATE INDEX idx_phyllo_users_phyllo_user_id ON public.phyllo_users(phyllo_user_id);

-- Tabela de contas conectadas via Phyllo
CREATE TABLE public.phyllo_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phyllo_user_id TEXT NOT NULL,
  phyllo_account_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  username TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  follower_count BIGINT DEFAULT 0,
  following_count BIGINT DEFAULT 0,
  status TEXT DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phyllo_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own phyllo_accounts" ON public.phyllo_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own phyllo_accounts" ON public.phyllo_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own phyllo_accounts" ON public.phyllo_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own phyllo_accounts" ON public.phyllo_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_phyllo_accounts_user_id ON public.phyllo_accounts(user_id);
CREATE INDEX idx_phyllo_accounts_phyllo_account_id ON public.phyllo_accounts(phyllo_account_id);

-- Tabela de perfis detalhados do Phyllo
CREATE TABLE public.phyllo_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phyllo_account_id TEXT NOT NULL REFERENCES public.phyllo_accounts(phyllo_account_id) ON DELETE CASCADE,
  full_name TEXT,
  bio TEXT,
  website TEXT,
  is_verified BOOLEAN DEFAULT false,
  engagement_rate NUMERIC(6,4),
  media_count BIGINT DEFAULT 0,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.phyllo_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own phyllo_profiles" ON public.phyllo_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own phyllo_profiles" ON public.phyllo_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own phyllo_profiles" ON public.phyllo_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_phyllo_profiles_account ON public.phyllo_profiles(phyllo_account_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_phyllo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_phyllo_users_updated_at BEFORE UPDATE ON public.phyllo_users FOR EACH ROW EXECUTE FUNCTION public.update_phyllo_updated_at();
CREATE TRIGGER trg_phyllo_accounts_updated_at BEFORE UPDATE ON public.phyllo_accounts FOR EACH ROW EXECUTE FUNCTION public.update_phyllo_updated_at();
CREATE TRIGGER trg_phyllo_profiles_updated_at BEFORE UPDATE ON public.phyllo_profiles FOR EACH ROW EXECUTE FUNCTION public.update_phyllo_updated_at();