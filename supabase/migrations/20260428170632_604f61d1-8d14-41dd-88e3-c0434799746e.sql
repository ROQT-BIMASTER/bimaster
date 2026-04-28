
-- Função estável para checar acesso à tela marketing_social (semi-join sem recursão)
CREATE OR REPLACE FUNCTION public.has_marketing_social_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_permissoes_telas upt
    JOIN public.telas_sistema t ON t.id = upt.tela_id
    WHERE upt.usuario_id = _user_id
      AND t.codigo = 'marketing_social'
  ) OR public.has_role(_user_id, 'admin'::app_role);
$$;

-- influencers: leitura compartilhada para equipe Marketing
CREATE POLICY "Marketing team can view all influencers"
ON public.influencers FOR SELECT TO authenticated
USING (public.has_marketing_social_access(auth.uid()));

-- influencer_suggestions: leitura compartilhada para equipe Marketing
CREATE POLICY "Marketing team can view all suggestions"
ON public.influencer_suggestions FOR SELECT TO authenticated
USING (public.has_marketing_social_access(auth.uid()));

-- influencer_opportunities: leitura compartilhada para equipe Marketing
CREATE POLICY "Marketing team can view all opportunities"
ON public.influencer_opportunities FOR SELECT TO authenticated
USING (public.has_marketing_social_access(auth.uid()));

-- influencer_company_profile: leitura compartilhada para equipe Marketing
CREATE POLICY "Marketing team can view company profile"
ON public.influencer_company_profile FOR SELECT TO authenticated
USING (public.has_marketing_social_access(auth.uid()));

-- influencer_analyses: leitura compartilhada para equipe Marketing
CREATE POLICY "Marketing team can view all analyses"
ON public.influencer_analyses FOR SELECT TO authenticated
USING (public.has_marketing_social_access(auth.uid()));

-- influencer_posts: leitura compartilhada para equipe Marketing
CREATE POLICY "Marketing team can view all posts"
ON public.influencer_posts FOR SELECT TO authenticated
USING (public.has_marketing_social_access(auth.uid()));

-- influencer_comments: leitura compartilhada para equipe Marketing
CREATE POLICY "Marketing team can view all comments"
ON public.influencer_comments FOR SELECT TO authenticated
USING (public.has_marketing_social_access(auth.uid()));

-- influencer_campaigns: leitura compartilhada para equipe Marketing
CREATE POLICY "Marketing team can view all campaigns"
ON public.influencer_campaigns FOR SELECT TO authenticated
USING (public.has_marketing_social_access(auth.uid()));

-- influencer_income: leitura compartilhada para equipe Marketing
CREATE POLICY "Marketing team can view all income"
ON public.influencer_income FOR SELECT TO authenticated
USING (public.has_marketing_social_access(auth.uid()));
