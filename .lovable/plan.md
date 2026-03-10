

# Corrigir tela "Minha Equipe — Projetos"

## Problemas identificados

1. **77 membros exibidos** — o hook `useProjetosTeamData` busca TODOS os perfis aprovados para admin, sem filtrar por departamento
2. **Sem botão de voltar** na página

## Solução

### 1. Filtrar apenas equipe de Projetos no hook

No `src/hooks/useProjetosTeamData.ts`, na branch `isAdmin` (linha 35-39), adicionar filtro pelo departamento "Projetos" (`departamento_id = '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'`). Aplicar o mesmo filtro para gerente/supervisor.

### 2. Botão de voltar na página

No `src/components/projetos/ProjetosMinhaEquipe.tsx`, adicionar um `<Button variant="ghost">` com ícone `ArrowLeft` que navega para `/dashboard/projetos`.

### 3. Habilitar permissão do módulo projetos para todos os usuários cadastrados no departamento

Conceder acesso ao módulo "projetos" para todos os perfis vinculados ao departamento Projetos via migration SQL (inserir em `role_permissoes_modulos` ou similar, conforme padrão existente).

### Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useProjetosTeamData.ts` | Filtrar por `departamento_id` do dept Projetos |
| `src/pages/ProjetosMinhaEquipe.tsx` | Adicionar botão voltar |
| Migration SQL | Habilitar módulo projetos para usuários do departamento |

