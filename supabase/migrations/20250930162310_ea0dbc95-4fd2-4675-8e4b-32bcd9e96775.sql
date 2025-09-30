-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_type AS ENUM ('vendedor', 'supervisor', 'admin');
CREATE TYPE prospect_status AS ENUM ('novo', 'em_contato', 'proposta_enviada', 'negociacao', 'ganho', 'perdido');
CREATE TYPE client_category AS ENUM ('A', 'B', 'C', 'D');
CREATE TYPE activity_type AS ENUM ('ligacao', 'email', 'reuniao', 'visita', 'proposta');
CREATE TYPE activity_result AS ENUM ('positivo', 'neutro', 'negativo');
CREATE TYPE region_type AS ENUM ('Norte', 'Sul', 'Leste', 'Oeste', 'Centro');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  tipo_usuario user_type NOT NULL DEFAULT 'vendedor',
  supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create municipalities table
CREATE TABLE public.municipios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  uf TEXT NOT NULL,
  regiao region_type NOT NULL,
  vendedor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(nome, uf)
);

-- Create prospects table
CREATE TABLE public.prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_empresa TEXT NOT NULL,
  cnpj TEXT,
  contato_principal TEXT,
  telefone TEXT,
  email TEXT,
  municipio_id UUID REFERENCES public.municipios(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status prospect_status NOT NULL DEFAULT 'novo',
  categoria client_category,
  ultimo_contato DATE,
  proxima_acao DATE,
  observacoes TEXT,
  importado_planilha BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activities table
CREATE TABLE public.atividades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo activity_type NOT NULL,
  data_atividade TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  descricao TEXT NOT NULL,
  resultado activity_result,
  proximo_followup DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Supervisors can view their team"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE tipo_usuario IN ('supervisor', 'admin')
    )
  );

-- RLS Policies for municipios
CREATE POLICY "Everyone can view municipalities"
  ON public.municipios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Supervisors and admins can manage municipalities"
  ON public.municipios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo_usuario IN ('supervisor', 'admin')
    )
  );

-- RLS Policies for prospects
CREATE POLICY "Vendedores can view their own prospects"
  ON public.prospects FOR SELECT
  USING (
    vendedor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo_usuario IN ('supervisor', 'admin')
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.id = p2.supervisor_id
      WHERE p1.id = auth.uid() AND p2.id = prospects.vendedor_id
    )
  );

CREATE POLICY "Vendedores can create prospects"
  ON public.prospects FOR INSERT
  WITH CHECK (
    vendedor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo_usuario IN ('supervisor', 'admin')
    )
  );

CREATE POLICY "Vendedores can update their own prospects"
  ON public.prospects FOR UPDATE
  USING (
    vendedor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo_usuario IN ('supervisor', 'admin')
    )
  );

CREATE POLICY "Only supervisors and admins can delete prospects"
  ON public.prospects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo_usuario IN ('supervisor', 'admin')
    )
  );

-- RLS Policies for atividades
CREATE POLICY "Users can view activities for their prospects"
  ON public.atividades FOR SELECT
  USING (
    vendedor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.prospects
      WHERE id = atividades.prospect_id AND vendedor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo_usuario IN ('supervisor', 'admin')
    )
  );

CREATE POLICY "Users can create activities"
  ON public.atividades FOR INSERT
  WITH CHECK (
    vendedor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo_usuario IN ('supervisor', 'admin')
    )
  );

CREATE POLICY "Users can update their own activities"
  ON public.atividades FOR UPDATE
  USING (
    vendedor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo_usuario IN ('supervisor', 'admin')
    )
  );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, tipo_usuario)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'tipo_usuario')::user_type, 'vendedor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_municipios_updated_at
  BEFORE UPDATE ON public.municipios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_profiles_tipo_usuario ON public.profiles(tipo_usuario);
CREATE INDEX idx_profiles_supervisor ON public.profiles(supervisor_id);
CREATE INDEX idx_municipios_vendedor ON public.municipios(vendedor_id);
CREATE INDEX idx_prospects_vendedor ON public.prospects(vendedor_id);
CREATE INDEX idx_prospects_municipio ON public.prospects(municipio_id);
CREATE INDEX idx_prospects_status ON public.prospects(status);
CREATE INDEX idx_atividades_prospect ON public.atividades(prospect_id);
CREATE INDEX idx_atividades_vendedor ON public.atividades(vendedor_id);