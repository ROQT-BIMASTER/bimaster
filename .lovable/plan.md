

## Corrigir função `get_subordinados` — search_path vazio

### Diagnóstico

A Michele (Gerente) tem 4 supervisores diretos vinculados a ela no banco, mas a função `get_subordinados` está falhando com o erro:

```
relation "profiles" does not exist
```

**Causa raiz:** A função tem `search_path=""` (vazio) mas referencia a tabela `profiles` sem o prefixo `public.`. Isso é o mesmo problema que corrigimos anteriormente em `is_admin_or_supervisor` e `user_has_empresa_access`.

### Correção

Uma migração SQL para recriar a função com referências explícitas ao schema `public`:

```sql
CREATE OR REPLACE FUNCTION public.get_subordinados(_user_id uuid)
RETURNS TABLE(subordinado_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE hierarchy AS (
    SELECT id
    FROM public.profiles
    WHERE supervisor_id = _user_id
    
    UNION ALL
    
    SELECT p.id
    FROM public.profiles p
    INNER JOIN hierarchy h ON p.supervisor_id = h.id
  )
  SELECT id FROM hierarchy;
END;
$$;
```

### Impacto

Isso restaura a hierarquia para **todos** os hooks que dependem de `get_subordinados`:
- `useTradeSupervisorDashboard` — Minha Equipe (Trade)
- `useMapTeamData` — Painel de equipe no Mapa
- `useProjetosTeamData` — Minha Equipe (Projetos)
- `useFilteredStores` — Filtro de lojas por equipe
- `TeamPerformanceChart` — Gráfico de performance
- `TeamHierarchyFilter` — Filtro de hierarquia

A Michele e qualquer outro Gerente/Supervisor passarão a ver seus subordinados novamente.

