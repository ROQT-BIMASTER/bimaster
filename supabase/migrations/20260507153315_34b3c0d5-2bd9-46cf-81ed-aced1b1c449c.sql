
-- Extensão para distância de Levenshtein
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- ============================================================
-- 1. Candidatos de deduplicação de perfis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_dedupe_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_canonical_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_duplicate_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','merged','rejected')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  notes text,
  CONSTRAINT no_self_dupe CHECK (profile_canonical_id <> profile_duplicate_id),
  CONSTRAINT uniq_pair UNIQUE (profile_canonical_id, profile_duplicate_id)
);

ALTER TABLE public.profile_dedupe_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_dedupe" ON public.profile_dedupe_candidates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_write_dedupe" ON public.profile_dedupe_candidates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. Auditoria de merges
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_merge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid NOT NULL,
  duplicate_id uuid NOT NULL,
  duplicate_email_before text,
  duplicate_nome_before text,
  executed_by uuid,
  executed_at timestamptz NOT NULL DEFAULT now(),
  records_moved jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_id uuid REFERENCES public.profile_dedupe_candidates(id)
);

ALTER TABLE public.profile_merge_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_merge_audit" ON public.profile_merge_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3. Função: detectar duplicidades
-- ============================================================
CREATE OR REPLACE FUNCTION public.detect_duplicate_profiles()
RETURNS TABLE(canonical_id uuid, duplicate_id uuid, score numeric, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem detectar duplicidades';
  END IF;

  -- Limpar candidatos pendentes antigos (mantém histórico de resolvidos)
  DELETE FROM public.profile_dedupe_candidates WHERE status = 'pending';

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id,
      p.email,
      lower(trim(split_part(p.email, '@', 1))) AS local_part,
      lower(trim(split_part(p.email, '@', 2))) AS domain,
      lower(public.unaccent(coalesce(p.nome, ''))) AS nome_norm,
      coalesce(p.status, 'ativo') AS status_atual,
      coalesce(p.aprovado, false) AS aprovado_atual
    FROM public.profiles p
    WHERE p.email IS NOT NULL AND p.email <> ''
  ),
  pares AS (
    -- Email muito parecido (mesmo domínio, levenshtein<=2 na local-part, diferença real)
    SELECT a.id AS id_a, b.id AS id_b,
           (3 - levenshtein(a.local_part, b.local_part))::numeric AS score,
           'email_typo' AS reason
    FROM base a JOIN base b
      ON a.id < b.id
     AND a.domain = b.domain
     AND levenshtein(a.local_part, b.local_part) BETWEEN 1 AND 2
     AND length(a.local_part) >= 4 AND length(b.local_part) >= 4
    UNION
    -- Mesmo nome canonicalizado e domínio igual
    SELECT a.id, b.id, 2.5::numeric, 'nome_dominio_iguais'
    FROM base a JOIN base b
      ON a.id < b.id
     AND a.nome_norm = b.nome_norm
     AND a.nome_norm <> ''
     AND length(a.nome_norm) >= 5
     AND a.domain = b.domain
     AND a.email <> b.email
    UNION
    -- Mesmo nome canonicalizado em domínios diferentes (sinal mais fraco)
    SELECT a.id, b.id, 1.5::numeric, 'nome_iguais_dominios_diferentes'
    FROM base a JOIN base b
      ON a.id < b.id
     AND a.nome_norm = b.nome_norm
     AND a.nome_norm <> ''
     AND length(a.nome_norm) >= 5
     AND a.domain <> b.domain
  ),
  -- Escolher canônico: preferir status ativo + aprovado, depois o que tem auth.users
  ranqueado AS (
    SELECT
      p.*,
      CASE WHEN ba.aprovado_atual AND ba.status_atual = 'ativo' THEN 1 ELSE 0 END AS a_score,
      CASE WHEN bb.aprovado_atual AND bb.status_atual = 'ativo' THEN 1 ELSE 0 END AS b_score,
      EXISTS(SELECT 1 FROM auth.users u WHERE u.id = p.id_a) AS a_has_auth,
      EXISTS(SELECT 1 FROM auth.users u WHERE u.id = p.id_b) AS b_has_auth
    FROM pares p
    JOIN base ba ON ba.id = p.id_a
    JOIN base bb ON bb.id = p.id_b
  ),
  decididos AS (
    SELECT
      CASE
        WHEN (a_has_auth AND NOT b_has_auth) THEN id_a
        WHEN (b_has_auth AND NOT a_has_auth) THEN id_b
        WHEN a_score > b_score THEN id_a
        WHEN b_score > a_score THEN id_b
        ELSE id_a
      END AS canonical_id,
      CASE
        WHEN (a_has_auth AND NOT b_has_auth) THEN id_b
        WHEN (b_has_auth AND NOT a_has_auth) THEN id_a
        WHEN a_score > b_score THEN id_b
        WHEN b_score > a_score THEN id_a
        ELSE id_b
      END AS duplicate_id,
      score, reason
    FROM ranqueado
  )
  INSERT INTO public.profile_dedupe_candidates(profile_canonical_id, profile_duplicate_id, score, reason, status)
  SELECT d.canonical_id, d.duplicate_id, d.score, d.reason, 'pending'
  FROM decididos d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profile_dedupe_candidates c
    WHERE c.status IN ('merged','rejected')
      AND ((c.profile_canonical_id = d.canonical_id AND c.profile_duplicate_id = d.duplicate_id)
        OR (c.profile_canonical_id = d.duplicate_id AND c.profile_duplicate_id = d.canonical_id))
  )
  ON CONFLICT (profile_canonical_id, profile_duplicate_id) DO NOTHING
  RETURNING profile_canonical_id, profile_duplicate_id, profile_dedupe_candidates.score, profile_dedupe_candidates.reason;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_duplicate_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_duplicate_profiles() TO authenticated;

-- ============================================================
-- 4. Função: consolidar perfis (merge)
-- ============================================================
CREATE OR REPLACE FUNCTION public.consolidate_profiles(
  p_canonical_id uuid,
  p_duplicate_id uuid,
  p_candidate_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup_email text;
  v_dup_nome text;
  v_moved jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem consolidar perfis';
  END IF;

  IF p_canonical_id = p_duplicate_id THEN
    RAISE EXCEPTION 'IDs canônico e duplicado não podem ser iguais';
  END IF;

  SELECT email, nome INTO v_dup_email, v_dup_nome
  FROM public.profiles WHERE id = p_duplicate_id FOR UPDATE;

  IF v_dup_email IS NULL THEN
    RAISE EXCEPTION 'Perfil duplicado não encontrado';
  END IF;

  -- Reatribuições principais
  UPDATE public.projeto_tarefas SET responsavel_id = p_canonical_id
    WHERE responsavel_id = p_duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('tarefas_responsavel', v_count);

  UPDATE public.projeto_tarefas SET criador_id = p_canonical_id
    WHERE criador_id = p_duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('tarefas_criador', v_count);

  -- Seguidores: pular se já existir conflito
  DELETE FROM public.projeto_tarefa_seguidores s
   WHERE s.user_id = p_duplicate_id
     AND EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s2
                 WHERE s2.tarefa_id = s.tarefa_id AND s2.user_id = p_canonical_id);
  UPDATE public.projeto_tarefa_seguidores SET user_id = p_canonical_id
    WHERE user_id = p_duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('seguidores', v_count);

  -- Colaboradores
  DELETE FROM public.projeto_tarefa_colaboradores c
   WHERE c.user_id = p_duplicate_id
     AND EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c2
                 WHERE c2.tarefa_id = c.tarefa_id AND c2.user_id = p_canonical_id);
  UPDATE public.projeto_tarefa_colaboradores SET user_id = p_canonical_id
    WHERE user_id = p_duplicate_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('colaboradores', v_count);

  -- Mapeamentos Asana
  UPDATE public.asana_sync_mappings SET local_id = p_canonical_id
    WHERE local_id = p_duplicate_id AND entity_type = 'user'
      AND NOT EXISTS (SELECT 1 FROM public.asana_sync_mappings m2
                      WHERE m2.local_id = p_canonical_id AND m2.entity_type = 'user' AND m2.asana_gid = asana_sync_mappings.asana_gid);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('asana_mappings', v_count);

  -- Membros de projeto
  BEGIN
    DELETE FROM public.projeto_membros m
     WHERE m.user_id = p_duplicate_id
       AND EXISTS (SELECT 1 FROM public.projeto_membros m2
                   WHERE m2.projeto_id = m.projeto_id AND m2.user_id = p_canonical_id);
    UPDATE public.projeto_membros SET user_id = p_canonical_id
      WHERE user_id = p_duplicate_id;
    GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('projeto_membros', v_count);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- Marcar duplicado como inativo
  UPDATE public.profiles
     SET status = 'inativo',
         aprovado = false,
         email = 'merged_' || extract(epoch from now())::bigint || '_' || email
   WHERE id = p_duplicate_id;

  -- Auditoria
  INSERT INTO public.profile_merge_audit(canonical_id, duplicate_id, duplicate_email_before, duplicate_nome_before, executed_by, records_moved, candidate_id)
  VALUES (p_canonical_id, p_duplicate_id, v_dup_email, v_dup_nome, auth.uid(), v_moved, p_candidate_id);

  -- Marcar candidato como mesclado
  IF p_candidate_id IS NOT NULL THEN
    UPDATE public.profile_dedupe_candidates
       SET status = 'merged', resolved_at = now(), resolved_by = auth.uid()
     WHERE id = p_candidate_id;
  ELSE
    UPDATE public.profile_dedupe_candidates
       SET status = 'merged', resolved_at = now(), resolved_by = auth.uid()
     WHERE (profile_canonical_id = p_canonical_id AND profile_duplicate_id = p_duplicate_id)
        OR (profile_canonical_id = p_duplicate_id AND profile_duplicate_id = p_canonical_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'canonical_id', p_canonical_id,
    'duplicate_id', p_duplicate_id,
    'records_moved', v_moved
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consolidate_profiles(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consolidate_profiles(uuid,uuid,uuid) TO authenticated;

-- ============================================================
-- 5. Testes pgTAP-like para get_minhas_tarefas_central
-- ============================================================
CREATE OR REPLACE FUNCTION public.test_get_minhas_tarefas_central()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_user_c uuid := gen_random_uuid();
  v_user_d uuid := gen_random_uuid();
  v_proj uuid;
  v_secao uuid;
  v_t_resp uuid;
  v_t_seg uuid;
  v_t_colab uuid;
  v_t_none uuid;
  v_count int;
  v_results jsonb := '[]'::jsonb;
  v_pass boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem rodar os testes';
  END IF;

  -- Setup fixtures
  INSERT INTO public.profiles(id, nome, email, status, aprovado)
    VALUES (v_user_a, 'Test A', 'test_a_'||v_user_a||'@test.local', 'ativo', true),
           (v_user_b, 'Test B', 'test_b_'||v_user_b||'@test.local', 'ativo', true),
           (v_user_c, 'Test C', 'test_c_'||v_user_c||'@test.local', 'ativo', true),
           (v_user_d, 'Test D', 'test_d_'||v_user_d||'@test.local', 'ativo', true);

  INSERT INTO public.projetos(nome, criador_id, status)
    VALUES ('__test_minhas_tarefas__', v_user_a, 'ativo')
    RETURNING id INTO v_proj;

  INSERT INTO public.projeto_secoes(projeto_id, nome, ordem)
    VALUES (v_proj, 'Default', 0) RETURNING id INTO v_secao;

  INSERT INTO public.projeto_tarefas(projeto_id, secao_id, titulo, status, criador_id, responsavel_id)
    VALUES (v_proj, v_secao, 'T-RESP', 'a_fazer', v_user_a, v_user_a) RETURNING id INTO v_t_resp;
  INSERT INTO public.projeto_tarefas(projeto_id, secao_id, titulo, status, criador_id)
    VALUES (v_proj, v_secao, 'T-SEG', 'a_fazer', v_user_a) RETURNING id INTO v_t_seg;
  INSERT INTO public.projeto_tarefas(projeto_id, secao_id, titulo, status, criador_id)
    VALUES (v_proj, v_secao, 'T-COLAB', 'a_fazer', v_user_a) RETURNING id INTO v_t_colab;
  INSERT INTO public.projeto_tarefas(projeto_id, secao_id, titulo, status, criador_id)
    VALUES (v_proj, v_secao, 'T-NONE', 'a_fazer', v_user_a) RETURNING id INTO v_t_none;

  INSERT INTO public.projeto_tarefa_seguidores(tarefa_id, user_id)
    VALUES (v_t_seg, v_user_b) ON CONFLICT DO NOTHING;
  INSERT INTO public.projeto_tarefa_colaboradores(tarefa_id, user_id)
    VALUES (v_t_colab, v_user_c) ON CONFLICT DO NOTHING;

  -- Caso A: responsável vê T-RESP
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  SELECT count(*) INTO v_count FROM public.get_minhas_tarefas_central() WHERE id = v_t_resp;
  v_pass := v_count = 1;
  v_results := v_results || jsonb_build_object('case','responsavel','passed',v_pass);

  -- Caso B: seguidor vê T-SEG
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  SELECT count(*) INTO v_count FROM public.get_minhas_tarefas_central() WHERE id = v_t_seg;
  v_pass := v_count = 1;
  v_results := v_results || jsonb_build_object('case','seguidor','passed',v_pass);

  -- Caso C: colaborador vê T-COLAB
  PERFORM set_config('request.jwt.claim.sub', v_user_c::text, true);
  SELECT count(*) INTO v_count FROM public.get_minhas_tarefas_central() WHERE id = v_t_colab;
  v_pass := v_count = 1;
  v_results := v_results || jsonb_build_object('case','colaborador','passed',v_pass);

  -- Caso D: usuário sem vínculo NÃO vê T-NONE
  PERFORM set_config('request.jwt.claim.sub', v_user_d::text, true);
  SELECT count(*) INTO v_count FROM public.get_minhas_tarefas_central() WHERE id = v_t_none;
  v_pass := v_count = 0;
  v_results := v_results || jsonb_build_object('case','sem_vinculo','passed',v_pass);

  -- Cleanup
  DELETE FROM public.projeto_tarefas WHERE projeto_id = v_proj;
  DELETE FROM public.projeto_secoes WHERE projeto_id = v_proj;
  DELETE FROM public.projetos WHERE id = v_proj;
  DELETE FROM public.profiles WHERE id IN (v_user_a, v_user_b, v_user_c, v_user_d);

  RETURN jsonb_build_object(
    'all_passed', NOT v_results::text LIKE '%"passed": false%',
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.test_get_minhas_tarefas_central() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_get_minhas_tarefas_central() TO authenticated;
