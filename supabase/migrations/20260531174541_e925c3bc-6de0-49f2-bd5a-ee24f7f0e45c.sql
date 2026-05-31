
-- 1. Renomear grupo
UPDATE public.conversas
SET nome = 'Comunicados do Sistema / Suporte',
    updated_at = now()
WHERE id = '3daf9772-404f-42f4-adbf-8a2566d91870';

-- 2. Função idempotente: adiciona usuário ao grupo + envia boas-vindas se acabou de entrar
CREATE OR REPLACE FUNCTION public.rpc_garantir_usuario_em_comunicados(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo_id uuid := '3daf9772-404f-42f4-adbf-8a2566d91870';
  v_remetente uuid;
  v_inserido boolean := false;
  v_conteudo text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Garante que o usuário existe em auth.users (FK do participante)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN;
  END IF;

  -- Remetente da mensagem = criador do grupo
  SELECT criado_por INTO v_remetente FROM public.conversas WHERE id = v_grupo_id;
  IF v_remetente IS NULL THEN
    v_remetente := p_user_id; -- fallback
  END IF;

  -- Tenta inserir participante
  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  VALUES (v_grupo_id, p_user_id, 'membro')
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  GET DIAGNOSTICS v_inserido = ROW_COUNT;

  IF v_inserido THEN
    v_conteudo :=
'Bem-vindo(a) ao sistema.

Este grupo é o canal oficial de **Comunicados do Sistema** e de **Suporte ao Usuário**. Aqui você receberá avisos sobre manutenções programadas, novas versões, mudanças de política e demais comunicados oficiais.

**Como abrir um chamado de suporte**
- Envie uma mensagem neste grupo descrevendo o que está acontecendo.
- Informe em qual módulo/tela ocorreu (ex.: Projetos, Financeiro, Trade, Fábrica).
- Sempre que possível, anexe prints, vídeos curtos ou arquivos relacionados.
- Evite enviar senhas ou dados sensíveis no corpo da mensagem.

**Prazo de atendimento (SLA)**
- Resposta inicial: até **1 dia útil** após o envio.
- Resolução: conforme a criticidade do chamado, alinhada na primeira resposta.

Qualquer dúvida, basta enviar sua mensagem por aqui que a equipe de suporte irá atendê-lo.';

    INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, metadata)
    VALUES (
      v_grupo_id,
      v_remetente,
      v_conteudo,
      'texto',
      jsonb_build_object(
        'sistema', true,
        'tipo_evento', 'boas_vindas_novo_usuario',
        'destinatario_id', p_user_id
      )
    );

    UPDATE public.conversas
    SET ultima_mensagem_em = now(),
        updated_at = now()
    WHERE id = v_grupo_id;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'rpc_garantir_usuario_em_comunicados error for %: % %', p_user_id, SQLERRM, SQLSTATE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_garantir_usuario_em_comunicados(uuid) TO authenticated, service_role;

-- 3. Estende handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, email, aprovado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'tipo_usuario', 'vendedor')::public.app_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Aplicar pacote de acesso padrão a todo novo usuário
  BEGIN
    PERFORM public.aplicar_acesso_padrao(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'aplicar_acesso_padrao on signup failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
  END;

  -- Adicionar ao grupo "Comunicados do Sistema / Suporte" e enviar boas-vindas
  BEGIN
    PERFORM public.rpc_garantir_usuario_em_comunicados(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'rpc_garantir_usuario_em_comunicados on signup failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- 4. Backfill: usuários existentes que ainda não estão no grupo
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id
    FROM public.profiles p
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.conversas_participantes cp
        WHERE cp.conversa_id = '3daf9772-404f-42f4-adbf-8a2566d91870'
          AND cp.usuario_id = p.id
      )
  LOOP
    PERFORM public.rpc_garantir_usuario_em_comunicados(r.id);
  END LOOP;
END $$;
