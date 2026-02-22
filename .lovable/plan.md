
# Corrigir hierarquia na tela "Minha Equipe" - Cadastro Equipe

## Problema

A tela "Cadastro Equipe" tem um codigo hardcoded que atribui TODOS os supervisores a Milene:

```text
const mainManager = trees.find(t =>
  t.manager.profile_nome.toLowerCase().includes("milene")
) || trees[0];
```

Isso ignora os vinculos reais do banco de dados, onde os 4 supervisores (Nathalia, Douglas, Juliana Moura, Monique) estao vinculados a **Michele** via `supervisor_id`.

Alem disso, Michele e Milene sao ambas "gerente", mas Milene esta num nivel mais alto (ADM). A solucao precisa usar os vinculos reais do banco em vez de hardcoding por nome.

## Solucao

### 1. Incluir `supervisor_id` nos dados dos membros

**Arquivo: `src/hooks/useTeamMemberDetails.ts`**

- Adicionar campo `profile_supervisor_id` na interface `TeamMemberWithProfile`
- Na query de profiles, incluir o campo `supervisor_id`
- Passar esse campo para os membros retornados

### 2. Usar vinculos reais para construir a arvore

**Arquivo: `src/components/trade/supervisor/TeamMemberRegistration.tsx`**

Substituir a logica hardcoded (linhas 286-333) por uma que:

- Para cada gerente, busca supervisores cujo `profile_supervisor_id` aponta para esse gerente
- Para cada supervisor, busca vendedores cujo `profile_supervisor_id` aponta para ele (mantendo o fallback por `supervisor_nome` do `team_member_details` para compatibilidade)
- Supervisores sem vinculo ficam em "Sem equipe definida"

**Resultado esperado:**
- Michele aparece com seus 4 supervisores abaixo
- Milene aparece como gerente separada (com seus proprios subordinados diretos, se houver)
- Cada gerente ve apenas seus supervisores

### Detalhes tecnicos

**`useTeamMemberDetails.ts`** - Mudancas:
```text
interface TeamMemberWithProfile {
  ...campos existentes...
  profile_supervisor_id: string | null;  // NOVO
}

// Na query de profiles, adicionar supervisor_id:
.select("id, nome, email, avatar_url, supervisor_id")

// No mapeamento, incluir:
profile_supervisor_id: profile.supervisor_id || null,
```

**`TeamMemberRegistration.tsx`** - Mudancas na construcao da hierarquia (linhas 286-333):
```text
// Para cada gerente, buscar supervisores cujo supervisor_id aponta para ele
for (const mgr of gerentes) {
  const mgrSupervisors: SupervisorGroup[] = [];
  
  for (const [supId, group] of supervisorMap.entries()) {
    if (group.supervisor.profile_supervisor_id === mgr.user_id) {
      mgrSupervisors.push(group);
      assignedSupervisorIds.add(supId);
    }
  }
  
  // Membros diretos do gerente que nao sao supervisores
  const directVends = vendedores.filter(v => 
    v.profile_supervisor_id === mgr.user_id && !assignedVendedorIds.has(v.user_id)
  );
  
  trees.push({
    manager: mgr,
    supervisorGroups: mgrSupervisors,
    directMembers: directVends,
  });
}
```

### Impacto

- Michele vera seus 4 supervisores (Nathalia, Douglas, Juliana, Monique) e os vendedores de cada um
- Milene vera seus proprios subordinados diretos (se houver)
- Outros gerentes (Ahmad, Jessika, Juliana G.) verao seus respectivos subordinados
- Nenhum hardcoding por nome - tudo baseado nos vinculos do banco
