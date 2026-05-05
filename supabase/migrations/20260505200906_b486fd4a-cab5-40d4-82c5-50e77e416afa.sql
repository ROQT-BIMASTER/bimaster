
-- Templates de resposta rápida (Aprovar / Pedir ajuste)
CREATE TABLE IF NOT EXISTS public.china_response_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NULL, -- NULL = template global (visível a todos)
  tipo text NOT NULL CHECK (tipo IN ('aprovar', 'rejeitar')),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  conteudo_cn text NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.china_response_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crt_select" ON public.china_response_templates
  FOR SELECT TO authenticated
  USING (usuario_id IS NULL OR usuario_id = auth.uid());

CREATE POLICY "crt_insert" ON public.china_response_templates
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR (usuario_id IS NULL AND public.has_role(auth.uid(), 'admin'::public.app_role)));

CREATE POLICY "crt_update" ON public.china_response_templates
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR (usuario_id IS NULL AND public.has_role(auth.uid(), 'admin'::public.app_role)));

CREATE POLICY "crt_delete" ON public.china_response_templates
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() OR (usuario_id IS NULL AND public.has_role(auth.uid(), 'admin'::public.app_role)));

CREATE TRIGGER set_updated_at_china_response_templates
  BEFORE UPDATE ON public.china_response_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Snooze: adiar uma submissão para voltar à caixa de entrada do usuário em data/hora
CREATE TABLE IF NOT EXISTS public.china_inbox_snooze (
  usuario_id uuid NOT NULL,
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  snooze_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, submissao_id)
);

ALTER TABLE public.china_inbox_snooze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cis_select" ON public.china_inbox_snooze
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "cis_insert" ON public.china_inbox_snooze
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "cis_update" ON public.china_inbox_snooze
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "cis_delete" ON public.china_inbox_snooze
  FOR DELETE TO authenticated USING (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_china_inbox_snooze_until ON public.china_inbox_snooze(snooze_until);

-- Templates iniciais globais
INSERT INTO public.china_response_templates (usuario_id, tipo, titulo, conteudo, conteudo_cn, ordem) VALUES
  (NULL, 'aprovar', 'Aprovado conforme padrão', 'Aprovado conforme padrão. Pode prosseguir com a produção.', '已根据标准批准。可以继续生产。', 1),
  (NULL, 'aprovar', 'Aprovado com ressalva', 'Aprovado. Atenção a manter o mesmo padrão de qualidade nas próximas peças.', '已批准。请在后续产品中保持相同质量标准。', 2),
  (NULL, 'rejeitar', 'Foto sem nitidez', 'Foto borrada. Por favor reenviar com boa iluminação e foco no produto.', '照片模糊。请在良好光线下重新拍摄并对焦产品。', 1),
  (NULL, 'rejeitar', 'Cor divergente', 'Cor divergente do aprovado. Ajustar conforme amostra de referência.', '颜色与批准的不符。请按参考样品调整。', 2),
  (NULL, 'rejeitar', 'Falta informação', 'Falta informação no documento. Incluir todos os dados solicitados antes de reenviar.', '文件信息缺失。请补充所有要求的数据后重新提交。', 3),
  (NULL, 'rejeitar', 'Especificação errada', 'Especificação não confere com a ficha técnica. Corrigir e reenviar.', '规格与技术资料不符。请修正后重新提交。', 4)
ON CONFLICT DO NOTHING;
