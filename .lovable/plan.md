

# Isolamento de Equipes: Projetos não aparece no Trade Marketing

## Problema

Quando admin ou usuários com visão total acessam o Trade Marketing (Minha Equipe, Mapa, Performance), o sistema busca **todos os perfis ativos** sem filtrar por departamento. Ao cadastrar as 12 usuárias de Projetos, elas apareceriam indevidamente no painel do Trade.

## Solução

Filtrar por `departamento_id` nos hooks e componentes do Trade Marketing, excluindo usuários do departamento "Projetos". A abordagem mais robusta é criar uma lista de departamentos excluídos (ou incluídos) para cada módulo.

### Estratégia de filtragem

Nos 3 pontos onde o admin/full-visibility busca "todos os perfis", adicionar um filtro que exclui profiles cujo `departamento_id` pertence ao departamento "Projetos":

```text
Query atual:   .from("profiles").select("...").eq("status", "ativo")
Query nova:    .from("profiles").select("...").eq("status", "ativo")
               .not("departamento_id", "eq", PROJETOS_DEPT_ID)
```

### Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Criar departamento "Projetos" + inserir as 12 usuárias |
| `src/hooks/useTradeSupervisorDashboard.ts` | Excluir dept Projetos na query admin (linha ~84-88) |
| `src/hooks/useMapTeamData.ts` | Excluir dept Projetos na query admin (linha ~41-44) |
| `src/components/trade/TeamHierarchyFilter.tsx` | Excluir dept Projetos na query admin (linha ~50-54) |
| `src/components/trade/TeamPerformanceChart.tsx` | Excluir dept Projetos na query admin |

### Cadastro das 12 usuárias

Após criar o departamento "Projetos", chamar a edge function `create-admin-users` em batch:
- **Luana** (l.bazilio) → role