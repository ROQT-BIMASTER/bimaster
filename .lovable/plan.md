
# Isolamento de Projetos por Departamento via RLS

## Objetivo
Adicionar coluna `departamento_id` na tabela `projetos` e atualizar a função `user_can_access_projeto` para restringir visibilidade por departamento, mantendo tudo no mesmo workspace.

## Lógica de Acesso Atualizada

```text
Quem pode ver um projeto:
1. Admin → vê tudo (sem restrição)
2. Criador do projeto → sempre vê
3. Membro registrado (projeto_membros) → sempre vê
4. NOVO: Se projeto tem departamento_id → usuários do mesmo departamento podem ver
5. Se projeto NÃO tem departamento_id → comportamento atual (visível a membros/criador/admin)
```

## Implementação

### 1. Migração SQL

- `ALTER TABLE projetos ADD COLUMN departamento_id UUID REFERENCES departamentos(id)`
- Recriar função `user_can_access_projeto` com a nova regra:

```sql
CREATE OR REPLACE FUNCTION user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    -- Admin vê tudo
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
    -- Criador
    OR EXISTS (SELECT 1 FROM projetos WHERE id = _projeto_id AND criador_id = _user_id)
    -- Membro
    OR EXISTS (SELECT 1 FROM projeto_membros WHERE projeto_id = _projeto_id AND user_id = _user_id)
    -- Mesmo departamento (se projeto tem departamento)
    OR EXISTS (
      SELECT 1 FROM projetos p
      JOIN profiles pr ON pr.departamento_id = p.departamento_id
      WHERE p.id = _projeto_id AND pr.id = _user_id AND p.departamento_id IS NOT NULL
    )
$$;
```

### 2. Frontend — Seletor de Departamento no Projeto

**`NovoProjetoDialog`**: Adicionar campo opcional "Departamento" (Select com lista de departamentos) ao criar projeto.

**`useProjetos.ts`**: Incluir `departamento_id` no insert da mutation e na interface `Projeto`.

**`Projetos.tsx`**: Adicionar filtro por departamento na barra de filtros existente. Exibir badge do departamento na listagem.

### 3. Detalhe do Projeto — Edição

No header/configurações do projeto, permitir que coordenadores/admin alterem o departamento vinculado.

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | ADD COLUMN + recriar `user_can_access_projeto` |
| `src/hooks/useProjetos.ts` | Incluir `departamento_id` na interface e mutation |
| `src/components/projetos/NovoProjetoDialog.tsx` | Campo de seleção de departamento |
| `src/pages/Projetos.tsx` | Filtro por departamento + badge na listagem |
