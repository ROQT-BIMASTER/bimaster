

# Filtrar Projetos: Apenas Criados ou Membros

## Problema

A política RLS da tabela `projetos` usa `USING(true)` para SELECT, permitindo que todos os usuários autenticados vejam todos os projetos. O correto é que cada usuário veja apenas projetos que criou ou nos quais é membro.

## Solução

### 1. Migration — Atualizar política RLS de SELECT

Substituir a política permissiva por uma que verifica se o usuário é criador ou membro:

```sql
DROP POLICY "Authenticated users can view projetos" ON public.projetos;

CREATE POLICY "Users view own or member projetos" ON public.projetos
  FOR SELECT TO authenticated
  USING (
    criador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
```

Também restringir o UPDATE para apenas criador/membro:

```sql
DROP POLICY "Authenticated users can update projetos" ON public.projetos;

CREATE POLICY "Members can update projetos" ON public.projetos
  FOR UPDATE TO authenticated
  USING (
    criador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
```

### 2. Nenhuma alteração no código frontend

O hook `useProjetos` já faz `select("*")` — com a RLS corrigida, o banco retornará automaticamente apenas os projetos visíveis ao usuário.

## Arquivo

| Recurso | Ação |
|---------|------|
| Migration SQL | DROP + CREATE policies em `projetos` |

## Resultado

- Usuário vê apenas projetos que criou (`criador_id`) ou onde é membro (`projeto_membros`)
- Admins continuam vendo todos
- Zero alteração no frontend

