

# Análise Completa: Status de Implementação do Módulo de Projetos

## Todas as 9 Brechas — Status Atual

| # | Brecha | Status | Detalhes |
|---|--------|--------|----------|
| 1 | **Filtrar + Ordenar** | ✅ Implementado | `ProjetoFilterSort.tsx` com popover de filtros (status, prioridade, estágio, tipo, responsável, atrasadas) e ordenação (5 campos). Integrado ao `ProjetoListView` via `applyFilters`/`applySort`. |
| 2 | **RLS aprovações restritiva** | ✅ Implementado | Migração aplicada: policies permissivas substituídas por verificação de `projeto_membros` + `criador_id`. |
| 3 | **Botão Adicionar tarefa** | ✅ Implementado | `QuickAddTaskDialog.tsx` com seleção de seção, conectado ao header via `quickAddOpen` state. |
| 4 | **Aba Arquivos** | ✅ Implementado | `ProjetoArquivosView.tsx` lista anexos de todas as tarefas do projeto com busca e download. |
| 5 | **Log de atividades** | ✅ Implementado | Tabela `projeto_tarefa_atividades` + trigger `tr_log_projeto_tarefa_changes` (status, responsável, prazo, estágio, retrabalho). `ProjetoAtividadesLog.tsx` integrado no detalhe da tarefa. |
| 6 | **Exportação Excel** | ✅ Implementado | Botão no `ProjetoEquipeDashboard` exporta tarefas com ExcelJS + FileSaver. |
| 7 | **Dependências entre tarefas** | ⚠️ Parcial | Tabela `projeto_tarefa_dependencias` criada com RLS, mas **sem UI** para adicionar/visualizar dependências no frontend. |
| 8 | **Dashboard tarefas sem responsável** | ✅ Implementado | Card dedicado no `ProjetoEquipeDashboard` listando tarefas sem responsável. |
| 9 | **Workflow de aprovação** | ✅ Implementado | `ProjetoAprovacaoWorkflow.tsx` com pipeline vertical, botões aprovar/rejeitar, observações e audit de aprovador. |

### Funcionalidades extras implementadas
- **Campo de Retrabalho**: Toggle + motivo no detalhe da tarefa, badge na row, contador no Health Panel.
- **Dashboard de Equipe**: Cards por membro, gráfico de barras (Recharts), tabela de atrasos, barra de progresso.

---

## Brecha Restante: UI de Dependências entre Tarefas (#7)

A tabela de banco existe mas falta o frontend. Implementação necessária:

### Arquivos a criar/editar
1. **Novo**: `src/components/projetos/ProjetoTarefaDependencias.tsx` — mini-componente no detalhe da tarefa para adicionar/remover dependências (select com busca de tarefas do projeto).
2. **Editar**: `src/components/projetos/ProjetoTarefaDetalhe.tsx` — adicionar seção "Dependências" abaixo do workflow de aprovação.

### Lógica
- Buscar tarefas do mesmo projeto (excluindo a tarefa atual e subtarefas)
- Select para escolher tarefa + tipo de dependência ("Terminar antes" / "Iniciar junto")
- Listar dependências existentes com botão de remover
- Queries: INSERT/DELETE em `projeto_tarefa_dependencias`

---

## Problemas Menores Identificados

1. **TypeScript loose typing**: `tipo_tarefa` e `motivo_retrabalho` não estão no interface `ProjetoTarefa` — acessados via `(t as any)`. Funciona em runtime pois `select("*")` retorna os campos, mas não é type-safe. Corrigir adicionando 2 campos opcionais ao interface.

2. **`ProjetoArquivosView`** usa `as any` para `projeto_tarefa_anexos` — tabela pode não estar nos types gerados. Se a tabela existir no DB, funciona em runtime.

3. **Notificações de prazo** (item 8 do plano original) não foram implementadas — requer edge function com cron. É uma melhoria de médio prazo.

---

## Plano de Implementação

### Tarefa 1: UI de Dependências entre Tarefas
- Criar componente `ProjetoTarefaDependencias.tsx` com select de tarefas + lista de dependências
- Integrar no `ProjetoTarefaDetalhe.tsx` como nova seção

### Tarefa 2: Tipagem TypeScript
- Adicionar `tipo_tarefa` e `motivo_retrabalho` ao interface `ProjetoTarefa` no hook

### Tarefa 3: Verificação end-to-end
- Testar no browser: filtros, ordenação, quick add, aprovação, retrabalho, dashboard equipe, arquivos, log de atividades

