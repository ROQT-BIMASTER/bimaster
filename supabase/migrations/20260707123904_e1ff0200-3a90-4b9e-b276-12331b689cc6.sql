
-- ========== Fase 2: modelagem de processos operacionais (ordem corrigida) ==========

-- Enums
CREATE TYPE public.processo_ligacao_condicao AS ENUM ('sempre','se_concluida','em_excecao');
CREATE TYPE public.processo_parecer_tipo AS ENUM ('parecer','decisao','adaptacao','observacao');
CREATE TYPE public.processo_execucao_status AS ENUM ('pendente','em_execucao','concluida','atrasada','cancelada');

-- 1) Cabeçalho
CREATE TABLE public.processos_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  fila_dona_id uuid NOT NULL REFERENCES public.suporte_filas(id) ON DELETE RESTRICT,
  versao integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  criador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos_operacionais TO authenticated;
GRANT ALL ON public.processos_operacionais TO service_role;
ALTER TABLE public.processos_operacionais ENABLE ROW LEVEL SECURITY;

-- 2) Etapas
CREATE TABLE public.processo_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos_operacionais(id) ON DELETE CASCADE,
  rotina_fixa_id uuid NOT NULL REFERENCES public.suporte_rotinas_fixas(id) ON DELETE RESTRICT,
  nome_override text,
  ordem integer NOT NULL DEFAULT 0,
  sla_minutos integer,
  horario_corte time,
  posicao_x numeric NOT NULL DEFAULT 0,
  posicao_y numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (processo_id, rotina_fixa_id)
);
CREATE INDEX processo_etapas_processo_ordem_idx ON public.processo_etapas(processo_id, ordem);
CREATE INDEX processo_etapas_rotina_idx ON public.processo_etapas(rotina_fixa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_etapas TO authenticated;
GRANT ALL ON public.processo_etapas TO service_role;
ALTER TABLE public.processo_etapas ENABLE ROW LEVEL SECURITY;

-- 3) Ligações
CREATE TABLE public.processo_ligacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos_operacionais(id) ON DELETE CASCADE,
  de_etapa_id uuid NOT NULL REFERENCES public.processo_etapas(id) ON DELETE CASCADE,
  para_etapa_id uuid NOT NULL REFERENCES public.processo_etapas(id) ON DELETE CASCADE,
  condicao public.processo_ligacao_condicao NOT NULL DEFAULT 'se_concluida',
  sla_handoff_minutos integer,
  rotulo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (de_etapa_id <> para_etapa_id),
  UNIQUE (de_etapa_id, para_etapa_id, condicao)
);
CREATE INDEX processo_ligacoes_processo_idx ON public.processo_ligacoes(processo_id);
CREATE INDEX processo_ligacoes_de_idx ON public.processo_ligacoes(de_etapa_id);
CREATE INDEX processo_ligacoes_para_idx ON public.processo_ligacoes(para_etapa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_ligacoes TO authenticated;
GRANT ALL ON public.processo_ligacoes TO service_role;
ALTER TABLE public.processo_ligacoes ENABLE ROW LEVEL SECURITY;

-- 4) Pareceres
CREATE TABLE public.processo_etapa_pareceres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.processo_etapas(id) ON DELETE CASCADE,
  processo_id uuid NOT NULL REFERENCES public.processos_operacionais(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo public.processo_parecer_tipo NOT NULL DEFAULT 'parecer',
  versao_processo integer NOT NULL DEFAULT 1,
  texto text NOT NULL,
  anexos jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX processo_pareceres_etapa_idx ON public.processo_etapa_pareceres(etapa_id, created_at DESC);
CREATE INDEX processo_pareceres_processo_idx ON public.processo_etapa_pareceres(processo_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_etapa_pareceres TO authenticated;
GRANT ALL ON public.processo_etapa_pareceres TO service_role;
ALTER TABLE public.processo_etapa_pareceres ENABLE ROW LEVEL SECURITY;

-- 5) Execuções
CREATE TABLE public.processo_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos_operacionais(id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  status public.processo_execucao_status NOT NULL DEFAULT 'pendente',
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (processo_id, data_ref)
);
CREATE INDEX processo_execucoes_data_idx ON public.processo_execucoes(data_ref DESC);
GRANT SELECT ON public.processo_execucoes TO authenticated;
GRANT ALL ON public.processo_execucoes TO service_role;
ALTER TABLE public.processo_execucoes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.processo_execucao_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.processo_execucoes(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.processo_etapas(id) ON DELETE CASCADE,
  rotina_execucao_id uuid REFERENCES public.suporte_rotina_execucoes(id) ON DELETE SET NULL,
  status public.processo_execucao_status NOT NULL DEFAULT 'pendente',
  iniciado_em timestamptz,
  concluido_em timestamptz,
  sla_estourado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (execucao_id, etapa_id)
);
CREATE INDEX processo_execucao_etapas_status_idx ON public.processo_execucao_etapas(execucao_id, status);
GRANT SELECT ON public.processo_execucao_etapas TO authenticated;
GRANT ALL ON public.processo_execucao_etapas TO service_role;
ALTER TABLE public.processo_execucao_etapas ENABLE ROW LEVEL SECURITY;

-- Helpers (após tabelas)
CREATE OR REPLACE FUNCTION public._processo_usuario_envolvido(_processo_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.processos_operacionais p
     WHERE p.id = _processo_id
       AND (
         public.has_role(_uid, 'admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
                     WHERE fa.fila_id = p.fila_dona_id AND fa.user_id = _uid AND fa.ativo)
         OR EXISTS (
           SELECT 1 FROM public.processo_etapas pe
             JOIN public.suporte_rotinas_fixas rf ON rf.id = pe.rotina_fixa_id
             JOIN public.suporte_fila_agentes fa2 ON fa2.fila_id = rf.fila_id AND fa2.user_id = _uid AND fa2.ativo
            WHERE pe.processo_id = p.id
         )
       )
  );
$$;

CREATE OR REPLACE FUNCTION public._processo_usuario_edita(_processo_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.processos_operacionais p
     WHERE p.id = _processo_id
       AND (
         public.has_role(_uid, 'admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
                     WHERE fa.fila_id = p.fila_dona_id AND fa.user_id = _uid AND fa.ativo AND fa.papel='lider')
       )
  );
$$;

-- Policies
CREATE POLICY "processos_select" ON public.processos_operacionais FOR SELECT TO authenticated
  USING (public._processo_usuario_envolvido(id, auth.uid()));
CREATE POLICY "processos_insert" ON public.processos_operacionais FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
                WHERE fa.fila_id = fila_dona_id AND fa.user_id = auth.uid() AND fa.ativo AND fa.papel='lider')
  );
CREATE POLICY "processos_update" ON public.processos_operacionais FOR UPDATE TO authenticated
  USING (public._processo_usuario_edita(id, auth.uid()))
  WITH CHECK (public._processo_usuario_edita(id, auth.uid()));
CREATE POLICY "processos_delete" ON public.processos_operacionais FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "processo_etapas_select" ON public.processo_etapas FOR SELECT TO authenticated
  USING (public._processo_usuario_envolvido(processo_id, auth.uid()));
CREATE POLICY "processo_etapas_write" ON public.processo_etapas FOR ALL TO authenticated
  USING (public._processo_usuario_edita(processo_id, auth.uid()))
  WITH CHECK (public._processo_usuario_edita(processo_id, auth.uid()));

CREATE POLICY "processo_ligacoes_select" ON public.processo_ligacoes FOR SELECT TO authenticated
  USING (public._processo_usuario_envolvido(processo_id, auth.uid()));
CREATE POLICY "processo_ligacoes_write" ON public.processo_ligacoes FOR ALL TO authenticated
  USING (public._processo_usuario_edita(processo_id, auth.uid()))
  WITH CHECK (public._processo_usuario_edita(processo_id, auth.uid()));

CREATE POLICY "processo_pareceres_select" ON public.processo_etapa_pareceres FOR SELECT TO authenticated
  USING (public._processo_usuario_envolvido(processo_id, auth.uid()));
CREATE POLICY "processo_pareceres_insert" ON public.processo_etapa_pareceres FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND public._processo_usuario_envolvido(processo_id, auth.uid()));
CREATE POLICY "processo_pareceres_update_autor" ON public.processo_etapa_pareceres FOR UPDATE TO authenticated
  USING (autor_id = auth.uid()) WITH CHECK (autor_id = auth.uid());
CREATE POLICY "processo_pareceres_delete_autor" ON public.processo_etapa_pareceres FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "processo_execucoes_select" ON public.processo_execucoes FOR SELECT TO authenticated
  USING (public._processo_usuario_envolvido(processo_id, auth.uid()));

CREATE POLICY "processo_execucao_etapas_select" ON public.processo_execucao_etapas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.processo_execucoes pe
     WHERE pe.id = execucao_id AND public._processo_usuario_envolvido(pe.processo_id, auth.uid())
  ));

-- Triggers updated_at
CREATE TRIGGER trg_processos_updated BEFORE UPDATE ON public.processos_operacionais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_processo_etapas_updated BEFORE UPDATE ON public.processo_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_processo_execucoes_updated BEFORE UPDATE ON public.processo_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_processo_execucao_etapas_updated BEFORE UPDATE ON public.processo_execucao_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
