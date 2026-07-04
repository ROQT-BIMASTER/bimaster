# Prompt Lovable — Suporte · Gestão de Membros por Departamento

> **Cole no Lovable.** Adiciona à **Central de Suporte** a gestão de membros por departamento — mesmo conceito do botão "Membros" do módulo de **Projetos** (`ProjetoMembrosDialog`), mas o escopo é a **fila/departamento**: adicionar uma pessoa ao Fiscal dá a ela acesso aos chamados do Fiscal (a RLS via `suporte_fila_agentes` + `is_agente_fila` **já existe** desde a Fase 0 — esta entrega é a UI + a RPC de escrita).
>
> Isso torna o vínculo de agentes **autoadministrável** (hoje só por SQL — o `PROMPT-LOVABLE-SUPORTE-AGENTES.md` vira apenas seed em massa). 2 partes: **PARTE 1 = migration** (RPC de gestão), **PARTE 2 = frontend** (botão + dialog).

## Regras de negócio
1. **Quem gerencia**: `admin` gerencia tudo; **líder da fila** gerencia os *agentes* da própria fila (adicionar/remover/reativar). **Promover/rebaixar/remover líder = só admin** (evita golpe de estado no departamento 🙂).
2. **Proteção**: não é permitido remover o **último líder ativo** de uma fila (nem pelo admin — primeiro promova outro).
3. **Ao adicionar** um membro: além do vínculo, ele entra como **participante das conversas dos chamados abertos** da fila (senão vê o ticket no desk mas o chat aparece vazio — a RLS de `mensagens` exige participação). Reativação limpa `saiu_em`.
4. **Ao remover**: o vínculo é **desativado** (`ativo=false`, preserva histórico); os chamados **abertos** da fila em que ele era `assignee` voltam ao pool (`assignee_id=NULL`, audit `membro_removido`); ele é marcado com `saiu_em` nas conversas de chamados abertos da fila em que **não** é solicitante.

---

## PARTE 1 — Migration (RPC de gestão de membros)

```sql
-- =====================================================================
-- SUPORTE — gestão de membros da fila (RPC SECURITY DEFINER)
-- Escrita na tabela continua restrita (policy admin-only); líderes operam
-- por esta RPC, no padrão do projeto.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_membro(
  p_fila_id uuid,
  p_user_id uuid,
  p_acao    text,               -- 'adicionar' | 'remover' | 'papel'
  p_papel   text DEFAULT 'agente'  -- usado em 'adicionar' e 'papel'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_is_admin  boolean;
  v_is_lider  boolean;
  v_alvo      record;
  v_lideres   int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_acao NOT IN ('adicionar','remover','papel') THEN RAISE EXCEPTION 'acao invalida'; END IF;
  IF p_papel NOT IN ('agente','lider') THEN RAISE EXCEPTION 'papel invalido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suporte_filas WHERE id = p_fila_id AND ativo) THEN
    RAISE EXCEPTION 'fila invalida';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND status = 'ativo') THEN
    RAISE EXCEPTION 'usuario invalido ou inativo';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  v_is_lider := EXISTS (SELECT 1 FROM public.suporte_fila_agentes
                        WHERE fila_id = p_fila_id AND user_id = v_uid AND ativo AND papel = 'lider');
  IF NOT (v_is_admin OR v_is_lider) THEN RAISE EXCEPTION 'sem permissao para gerenciar membros desta fila'; END IF;

  SELECT * INTO v_alvo FROM public.suporte_fila_agentes
   WHERE fila_id = p_fila_id AND user_id = p_user_id;

  -- líder não mexe em líderes (nem cria outro líder) — só admin
  IF NOT v_is_admin THEN
    IF p_papel = 'lider' OR (v_alvo.papel = 'lider' AND coalesce(v_alvo.ativo, false)) THEN
      RAISE EXCEPTION 'apenas admin gerencia lideres';
    END IF;
  END IF;

  IF p_acao = 'adicionar' THEN
    INSERT INTO public.suporte_fila_agentes (fila_id, user_id, papel, ativo)
    VALUES (p_fila_id, p_user_id, p_papel, true)
    ON CONFLICT (fila_id, user_id) DO UPDATE SET ativo = true, papel = EXCLUDED.papel;

    -- entra nas conversas dos chamados ABERTOS da fila (reativa se já esteve)
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT t.conversa_id, p_user_id, 'membro'
    FROM public.suporte_tickets t
    JOIN public.conversas c ON c.id = t.conversa_id AND c.tipo = 'suporte'
    WHERE t.fila_id = p_fila_id AND t.status <> 'resolvido'
    ON CONFLICT (conversa_id, usuario_id) DO UPDATE SET saiu_em = NULL;

    RETURN jsonb_build_object('ok', true, 'acao', 'adicionar', 'papel', p_papel);
  END IF;

  IF v_alvo IS NULL OR NOT v_alvo.ativo THEN RAISE EXCEPTION 'membro nao encontrado nesta fila'; END IF;

  IF p_acao = 'papel' THEN
    -- rebaixar o último líder é bloqueado
    IF v_alvo.papel = 'lider' AND p_papel = 'agente' THEN
      SELECT count(*) INTO v_lideres FROM public.suporte_fila_agentes
       WHERE fila_id = p_fila_id AND ativo AND papel = 'lider';
      IF v_lideres <= 1 THEN RAISE EXCEPTION 'promova outro lider antes de rebaixar o ultimo'; END IF;
    END IF;
    UPDATE public.suporte_fila_agentes SET papel = p_papel
     WHERE fila_id = p_fila_id AND user_id = p_user_id;
    RETURN jsonb_build_object('ok', true, 'acao', 'papel', 'papel', p_papel);
  END IF;

  -- p_acao = 'remover'
  IF v_alvo.papel = 'lider' THEN
    SELECT count(*) INTO v_lideres FROM public.suporte_fila_agentes
     WHERE fila_id = p_fila_id AND ativo AND papel = 'lider';
    IF v_lideres <= 1 THEN RAISE EXCEPTION 'promova outro lider antes de remover o ultimo'; END IF;
  END IF;

  UPDATE public.suporte_fila_agentes SET ativo = false
   WHERE fila_id = p_fila_id AND user_id = p_user_id;

  -- chamados abertos que ele atendia voltam ao pool (com trilha)
  WITH devolvidos AS (
    UPDATE public.suporte_tickets t
       SET assignee_id = NULL, ultima_interacao_em = now()
     WHERE t.fila_id = p_fila_id AND t.assignee_id = p_user_id AND t.status <> 'resolvido'
     RETURNING t.id
  )
  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  SELECT id, 'membro_removido', jsonb_build_object('user_id', p_user_id, 'por', v_uid)
  FROM devolvidos;

  -- sai das conversas de chamados abertos da fila (exceto onde é o solicitante)
  UPDATE public.conversas_participantes cp
     SET saiu_em = now()
    FROM public.suporte_tickets t
   WHERE t.conversa_id = cp.conversa_id
     AND t.fila_id = p_fila_id
     AND t.status <> 'resolvido'
     AND cp.usuario_id = p_user_id
     AND COALESCE(t.requester_id, t.owner_id) <> p_user_id;

  RETURN jsonb_build_object('ok', true, 'acao', 'remover');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_membro(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_membro(uuid, uuid, text, text) TO authenticated;
```

### Smoke test da PARTE 1
```sql
-- (a) RPC existe
SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'rpc_suporte_fila_membro';
-- (b) ACL sem PUBLIC/anon
SELECT proacl FROM pg_proc WHERE proname = 'rpc_suporte_fila_membro';
```

---

## PARTE 2 — Frontend (botão + dialog, espelho de Projetos)

### 2.1 Botão "Membros" na Central de Suporte
No header da Central (`SuporteDesk.tsx`), ao lado do Select de departamento: botão **"Membros"** (ícone `Users`, com badge da contagem de membros ativos da fila selecionada). Visível quando: usuário é **admin** OU **líder da fila selecionada** (checar em `useMinhasFilasAgente().vinculos` papel `lider`). Oculto quando o seletor está em "Todos" (gestão é por departamento).

### 2.2 `MembrosFilaDialog` (`src/components/suporte/MembrosFilaDialog.tsx`)
Espelho **simplificado** do `ProjetoMembrosDialog` de Projetos (sem convites/wizard/seções):
- **Lista de membros ativos** da fila: Avatar + nome (resolver via `get_chat_directory()` — padrão do projeto), badge de papel (`Crown` líder / `User` agente), Select de papel (só admin) e botão remover (com `AlertDialog` de confirmação, mensagem: "Os chamados abertos que ele atende voltam para o pool do departamento").
- **Adicionar**: busca com `Input` sobre o diretório (`get_chat_directory()`, excluindo quem já é membro ativo), lista com checkbox/click para adicionar como agente (admin pode escolher papel). Feedback otimista + toast.
- Todas as ações via `(supabase.rpc as any)("rpc_suporte_fila_membro", { p_fila_id, p_user_id, p_acao, p_papel })`; invalidar `["suporte","minhas-filas"]` e uma nova query `["suporte","fila-membros", filaId]`.
- Erros da RPC (ex.: "promova outro lider antes de remover o ultimo", "apenas admin gerencia lideres") exibidos no toast — são mensagens de negócio, não bugs.

### 2.3 Hook `useFilaMembros(filaId)` (`src/hooks/suporte/useFilaMembros.ts`)
Query em `suporte_fila_agentes` (`.eq("fila_id", filaId).eq("ativo", true)`) + resolução de nomes via `get_chat_directory()`; mutations `adicionar/remover/mudarPapel` chamando a RPC.

## Aceite
1. Admin abre a Central no **Fiscal** → "Membros" → adiciona um colaborador como agente → ele passa a ver os chamados do Fiscal no desk **e consegue abrir as conversas dos chamados já existentes**.
2. Esse agente NÃO consegue (via UI nem via RPC direto) promover ninguém a líder nem remover o líder — erro de negócio no toast.
3. Líder da fila adiciona/remove agentes da própria fila; não vê o botão em outras filas.
4. Remover um agente que atendia 2 chamados abertos → os 2 voltam a "sem responsável" no pool, com evento `membro_removido` na audit.
5. Tentar remover o único líder → bloqueado com mensagem clara.
6. Re-adicionar alguém removido → volta com histórico preservado e reentra nas conversas abertas.

## Nota
O `docs/PROMPT-LOVABLE-SUPORTE-AGENTES.md` (vínculo por SQL) continua válido apenas como **seed em massa**; o caminho padrão de administração passa a ser esta UI.
