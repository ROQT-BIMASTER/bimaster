
-- Tabela para dados pessoais dos membros da equipe comercial
CREATE TABLE public.team_member_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome_completo text,
  cpf text,
  rg text,
  data_nascimento date,
  email_pessoal text,
  whatsapp text,
  tamanho_camiseta text,
  equipe_comercial text,
  supervisor_nome text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_team_member_details_updated_at
  BEFORE UPDATE ON public.team_member_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.team_member_details ENABLE ROW LEVEL SECURITY;

-- Admin/Gerente: leitura e escrita de todos os registros
CREATE POLICY "admin_gerente_full_access"
  ON public.team_member_details
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente'::app_role)
  );

-- Supervisor: leitura e escrita dos membros da sua equipe
CREATE POLICY "supervisor_team_access"
  ON public.team_member_details
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'supervisor'::app_role)
    AND public.is_supervisor_of(auth.uid(), user_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'supervisor'::app_role)
    AND public.is_supervisor_of(auth.uid(), user_id)
  );

-- Vendedor/Promotor: leitura e edicao apenas do proprio registro
CREATE POLICY "own_record_access"
  ON public.team_member_details
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
