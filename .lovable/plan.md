

# Integração Asana → Sistema de Projetos

## Objetivo
Importar todos os dados do Asana (workspaces, projetos, seções, tarefas, subtarefas, comentários, responsáveis, datas) para as tabelas existentes do módulo de Projetos (`projetos`, `projeto_secoes`, `projeto_tarefas`, `projeto_tarefa_comentarios`), permitindo migração completa e desligamento futuro do Asana.

## Pré-requisitos

Você precisará criar um **Personal Access Token** no Asana:
1. Na tela que você mostrou (https://app.asana.com/0/my-apps), clique em **"+ Criar novo token"**
2. Dê um nome (ex: "BiMaster Sync") e copie o token gerado
3. Esse token será armazenado de forma segura no backend

## Arquitetura

```text
Asana REST API
     ↓ (PAT auth)
Edge Function: asana-sync
     ↓
┌─────────────────────────────────┐
│ 1. GET /workspaces               │
│ 2. GET /projects (por workspace) │
│ 3. GET /sections (por projeto)   │
│ 4. GET /tasks (por projeto)      │
│ 5. GET /stories (comentários)    │
│ 6. GET /users (mapeamento)       │
└─────────────────────────────────┘
     ↓ (transform + upsert)
DB: projetos, projeto_secoes, projeto_tarefas,
    projeto_tarefa_comentarios, asana_sync_log
```

## Plano de Implementação

### 1. Migration SQL
- Tabela `asana_sync_mappings` — mapeia `asana_gid` ↔ `local_id` para projetos, seções, tarefas e usuários
- Tabela `asana_sync_log` — registra execuções de sync (status, contadores, erros)
- Campos opcionais: `asana_gid` em `projetos` e `projeto_tarefas` para rastreabilidade

### 2. Edge Function `asana-sync`
Rotas internas via `body.path`:

| Rota | Descrição |
|------|-----------|
| `/test-connection` | Valida o PAT e retorna workspaces |
| `/list-projects` | Lista projetos do workspace selecionado |
| `/sync-project` | Importa 1 projeto completo (seções + tarefas + subtarefas + comentários) |
| `/sync-all` | Importa todos os projetos de um workspace |
| `/status` | Retorna progresso da última sincronização |

**Mapeamento Asana → Sistema:**

| Asana | Tabela Local | Campo |
|-------|-------------|-------|
| Project | `projetos` | nome, cor, status |
| Section | `projeto_secoes` | nome, ordem |
| Task | `projeto_tarefas` | titulo, descricao, status, prioridade, data_prazo, responsavel_id, ordem |
| Subtask | `projeto_tarefas` | parent_tarefa_id preenchido |
| Story (comment) | `projeto_tarefa_comentarios` | conteudo, autor_id |
| Assignee | `profiles` | mapeamento por email |

**Lógica de status:**
- Asana `completed: true` → `concluida`
- Asana `completed: false` + due_date passado → `em_andamento` (atrasada)
- Asana `completed: false` → `em_andamento`

### 3. Tela de Configuração `AsanaIntegracaoPage.tsx`
- **Step 1**: Input do PAT + botão "Testar Conexão"
- **Step 2**: Seletor de Workspace (dropdown)
- **Step 3**: Lista de projetos Asana com checkboxes para selecionar quais importar
- **Step 4**: Botão "Importar Selecionados" com barra de progresso
- **Log**: Tabela com histórico de sincronizações (data, projetos importados, tarefas, erros)

### 4. Mapeamento de Usuários
- Buscar users do Asana por email
- Cruzar com `profiles.email` no sistema
- Usuários sem match ficam sem responsável (log de alerta)

### 5. Sync Incremental (futuro)
- Após importação inicial, permitir re-sync que atualiza apenas mudanças (baseado em `modified_at` do Asana)
- Toggle para sync automático periódico

## Alterações Técnicas

| Arquivo/Recurso | Ação |
|-----------------|------|
| **Migration SQL** | Criar `asana_sync_mappings`, `asana_sync_log`, adicionar `asana_gid` em projetos/tarefas |
| **Secret** | `ASANA_PAT` — Personal Access Token |
| **`supabase/functions/asana-sync/`** | Edge function com rotas de sync |
| **`src/pages/AsanaIntegracao.tsx`** | Tela de configuração e importação |
| **`src/hooks/useAsanaSync.ts`** | Hook para chamadas à edge function |
| **Rota** | `/dashboard/integracoes/asana` no router |

## Segurança
- PAT armazenado como secret no backend (nunca exposto ao frontend)
- Edge function valida JWT do usuário antes de executar
- RLS nas tabelas de sync com `check_user_access`

