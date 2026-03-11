

## Diagnóstico: Falhas de Isolamento Hierárquico nas Equipes

### Problemas Encontrados

**1. RLS da tabela `team_member_details` — Gerentes veem TUDO (CRÍTICO)**
A policy `admin_gerente_full_access` concede acesso total (SELECT/INSERT/UPDATE/DELETE) a **todos os gerentes** sem filtro hierárquico. Qualquer gerente pode ver CPF, WhatsApp e dados cadastrais de todos os membros, independente de serem sua equipe.

**2. Função `can_view_profile` — Gerentes não enxergam subordinados (CRÍTICO)**  
A função usa a coluna `gerente_id` da tabela `profiles` para verificar subordinados de gerentes, mas essa coluna tem **0 registros preenchidos**. Resultado: gerentes não conseguem ver perfis via RLS. O frontend contorna isso usando `get_subordinados` (security definer), criando uma inconsistência entre proteção de dados e visibilidade.

**3. Rota "Minha Equipe" sem proteção de role (MÉDIO)**  
A rota `/dashboard/trade/minha-equipe` exige apenas permissão ao módulo `trade` (`ModuleRoute`), sem validar se o usuário é admin/supervisor/gerente. Vendedores podem acessar via URL direta.

---

### Plano de Correção

#### 1. Corrigir RLS de `team_member_details`
- **Remover** a policy `admin_gerente_full_access` (permissiva demais)
- **Criar** nova policy de SELECT que permite:
  - Admin: acesso total
  - Gerente/Supervisor: acesso via `get_subordinados` (hierarquia recursiva)
  - Próprio usuário: acesso ao próprio registro
- **Criar** policies de UPDATE/INSERT/DELETE igualmente restritas

```sql
-- Remover policy antiga
DROP POLICY "admin_gerente_full_access" ON public.team_member_details;

-- Novo SELECT: admin full, gerente/supervisor via hierarquia, ou próprio
CREATE POLICY "team_details_select_hierarchy" ON public.team_member_details
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor'))
    AND user_id IN (SELECT subordinado_id FROM get_subordinados(auth.uid()))
  )
);
```
- Remover policies duplicadas redundantes (`team_details_select_strict`, `own_record_select`, `own_record_update`, `team_details_update_strict`) e consolidar

#### 2. Corrigir função `can_view_profile`
- Atualizar para usar `get_subordinados` (recursivo) ao invés de checagem direta por `gerente_id`/`supervisor_id`
- Isso garante que gerentes e supervisores enxerguem toda sua árvore hierárquica, não apenas diretos

```sql
CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, target_profile_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF viewer_id = target_profile_id THEN RETURN true; END IF;
  IF has_role(viewer_id, 'admin') THEN RETURN true; END IF;
  
  -- Gerentes e supervisores: verificar via hierarquia recursiva
  RETURN EXISTS (
    SELECT 1 FROM get_subordinados(viewer_id) WHERE subordinado_id = target_profile_id
  );
END;
$$;
```

#### 3. Proteger rota "Minha Equipe" no frontend
- No `TradeSupervisorDashboard.tsx`: adicionar guard para permitir apenas admin, gerente, ou supervisor
- Exibir mensagem de acesso negado para vendedores/promotores

#### 4. Limpar policies duplicadas em `team_member_details`
- Consolidar as 9 policies atuais (muitas redundantes/conflitantes) em 4 políticas limpas: SELECT, INSERT, UPDATE, DELETE

### Arquivos Modificados
- **Migration SQL**: 1 novo arquivo para corrigir RLS + `can_view_profile`
- **`src/pages/TradeSupervisorDashboard.tsx`**: Guard de role no componente

