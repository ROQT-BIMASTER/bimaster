

## Metas de Tarefas com Monitoramento de Atrasos

### Conceito

O coordenador define **metas por tarefa** (data início planejada, data prazo, e marcos intermediários opcionais). O sistema monitora automaticamente e:
- Sinaliza visualmente tarefas em risco (prazo próximo) ou atrasadas
- Envia notificações automáticas para responsáveis e coordenador
- Mostra um painel de saúde do projeto no header

### Novas Colunas na Tabela `projeto_tarefas`

| Campo | Tipo | Uso |
|-------|------|-----|
| `data_inicio_planejada` | date | Data que o coordenador define como início esperado |
| `dias_alerta_antes` | integer (default 2) | Quantos dias antes do prazo alertar |

### Nova Tabela: `projeto_tarefa_metas`

Para marcos intermediários opcionais dentro de uma tarefa:

| Campo | Tipo |
|-------|------|
| `id` | uuid PK |
| `tarefa_id` | FK → projeto_tarefas |
| `descricao` | text |
| `data_meta` | date |
| `concluida` | boolean default false |
| `created_at` | timestamp |

### Edge Function: `projeto-monitor-atrasos`

Função agendada via `pg_cron` (executa 1x/dia) que:
1. Busca tarefas não concluídas com `data_prazo` definido
2. Calcula dias restantes
3. Se `dias_restantes <= dias_alerta_antes` → cria notificação de **alerta** para responsável + coordenador
4. Se `dias_restantes < 0` → cria notificação de **atraso** 
5. Verifica metas intermediárias vencidas não concluídas

### Mudanças no Frontend

**1. Painel de definição de metas (ProjetoTarefaDetalhe)**
- Campo "Data Início Planejada" ao lado do prazo existente
- Campo "Alertar X dias antes" (selector: 1, 2, 3, 5, 7)
- Seção "Marcos/Metas" com lista editável de checkpoints intermediários

**2. Indicadores visuais (ListView, KanbanView, CronogramaView)**
- Badge vermelho pulsante para tarefas atrasadas
- Badge amarelo para tarefas em risco (dentro do período de alerta)
- Ícone de progresso baseado em metas concluídas vs total

**3. Painel de Saúde no ProjetoHeader**
- Mini dashboard: "X tarefas no prazo | Y em risco | Z atrasadas"
- Clicável para filtrar apenas as problemáticas

### Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar colunas + criar tabela `projeto_tarefa_metas` |
| `supabase/functions/projeto-monitor-atrasos/index.ts` | Nova edge function agendada |
| `src/hooks/useProjetoTarefas.ts` | Buscar metas, expor helper de status de risco |
| `src/components/projetos/ProjetoTarefaDetalhe.tsx` | Campos de meta + marcos intermediários |
| `src/components/projetos/ProjetoListView.tsx` | Badges de alerta/atraso |
| `src/components/projetos/ProjetoKanbanView.tsx` | Badges de alerta/atraso |
| `src/components/projetos/ProjetoCronogramaView.tsx` | Cores de risco nas barras |
| `src/components/projetos/ProjetoHeader.tsx` | Mini painel de saúde |

