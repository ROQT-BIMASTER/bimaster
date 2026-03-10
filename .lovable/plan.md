

# Hierarquia de Equipe no Módulo de Desenvolvimento (Projetos)

## Contexto

Hoje o módulo de Projetos opera com isolamento por **membership** (só vê quem foi adicionado ao projeto). Não existe visão de equipe hierárquica como no Trade Marketing. O pedido é:

1. **Gerente/Coordenação** controla quem visualiza módulos (já existe via `projeto_membro_secoes`)
2. **Nova funcionalidade**: Tela "Minha Equipe" dentro de Projetos, mostrando a hierarquia organizacional (Gerente > Supervisor > Membros) com métricas de produtividade em projetos

## Arquitetura Proposta

```text
┌──────────────────────────────────────────────────────┐
│            /dashboard/projetos/minha-equipe           │
│                                                      │
│  ┌─ Filtro hierárquico (reutiliza TeamHierarchy) ──┐ │
│  │  Admin: vê todos                                │ │
│  │  Gerente: vê sua árvore de subordinados         │ │
│  │  Supervisor: vê seus vendedores/promotores      │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ KPIs por membro ──────────────────────────────┐ │
│  │  • Projetos ativos (como membro/coordenador)   │ │
│  │  • Tarefas atribuídas / concluídas             │ │
│  │  • Taxa de conclusão (%)                        │ │
│  │  • Tarefas atrasadas                            │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Lista de membros com ranking ─────────────────┐ │
│  │  Agrupado por supervisor (hierarquia real)      │ │
│  │  Click → ver projetos desse membro              │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Implementação

### 1. Nova página: `src/pages/ProjetosMinhaEquipe.tsx`
- Reutiliza a lógica do `TeamHierarchyFilter` (já existente no Trade) adaptada para o contexto de Projetos
- Busca métricas de cada membro da equipe:
  - Total de projetos em que participa (`projeto_membros`)
  - Tarefas atribuídas e concluídas (`projeto_tarefas` onde `responsavel_id = user_id`)
  - Tarefas atrasadas (data_fim < hoje e não concluída)
- Exibe cards por membro com KPIs e ranking por produtividade
- Respeita hierarquia: admin vê todos, gerente/supervisor vêem apenas sua árvore via `get_subordinados`

### 2. Hook: `src/hooks/useProjetosTeamData.ts`
- Similar ao `useMapTeamData` mas com métricas de projetos
- Busca: profiles da hierarquia → roles → contagem de projetos/tarefas por membro
- Calcula ranking: tarefas concluídas * 3 + projetos ativos * 2

### 3. Sidebar: `src/components/dashboard/AppSidebar.tsx`
- Adicionar link "Minha Equipe" no menu de Projetos (visível apenas para admin/gerente/supervisor)

### 4. Rota: `App.tsx`
- Adicionar rota `/dashboard/projetos/minha-equipe` protegida por `ScreenProtectedRoute` ou verificação de role

### Sem alterações no banco de dados
Todas as métricas são derivadas de tabelas existentes (`projeto_membros`, `projeto_tarefas`, `profiles`, `user_roles`). Não é necessária migração.

### Arquivos impactados
| Arquivo | Ação |
|---------|------|
| `src/pages/ProjetosMinhaEquipe.tsx` | Criar — página principal |
| `src/hooks/useProjetosTeamData.ts` | Criar — hook de dados da equipe |
| `src/components/dashboard/AppSidebar.tsx` | Editar — adicionar link no menu |
| `src/App.tsx` | Editar — adicionar rota |

