

# Trilha de Auditoria Completa para Tarefas de Projetos

## Problema

Atualmente, alterações em tarefas (status, prioridade, responsável, prazo, estágio, título, descrição) **não são registradas** na tabela `projeto_tarefa_atividades`. O log de atividades só captura despachos de processos. Não há rastreabilidade de quem mudou o quê, quando.

## Solução

Implementar auditoria automática via **trigger de banco de dados** que captura todas as alterações relevantes na tabela `projeto_tarefas`, registrando automaticamente na `projeto_tarefa_atividades` — sem depender do frontend.

### 1. Trigger de Auditoria no Banco (Migration)

Criar função `audit_projeto_tarefa_changes()` que dispara em `UPDATE` de `projeto_tarefas` e registra automaticamente:

| Campo Monitorado | Tipo Registrado | Descrição Gerada |
|---|---|---|
| `status` | `status_change` | "Alterou status de X para Y" |
| `prioridade` | `prioridade_change` | "Alterou prioridade de X para Y" |
| `estagio` | `estagio_change` | "Alterou estágio de X para Y" |
| `responsavel_id` | `responsavel_change` | "Atribuiu responsável Z" |
| `data_prazo` | `prazo_change` | "Alterou prazo de X para Y" |
| `titulo` | `titulo_change` | "Alterou título" |
| `descricao` | `descricao_change` | "Alterou descrição" |
| `data_inicio_planejada` | `inicio_change` | "Alterou início planejado" |
| `secao_id` | `secao_change` | "Moveu para outra seção" |
| `validacao_status` | `validacao_change` | "Enviou para validação / Validada / Rejeitada" |

Também captura `INSERT` com tipo `criacao` — "Criou a tarefa".

O trigger usa `auth.uid()` para identificar quem fez a alteração e busca o nome no `profiles`.

### 2. Melhorar o Componente de Log de Atividades

Refatorar `ProjetoAtividadesLog.tsx`:

- Adicionar ícones e cores específicos por tipo de mudança (igual ao `AuditTimeline`)
- Mostrar valores anterior → novo com destaque visual
- Badges coloridos por tipo de ação
- Formato: "**João** alterou o status de `pendente` → `em_andamento`"
- Tooltip com data/hora completa

### 3. Aba "Histórico" no Detalhe da Tarefa

No `ProjetoTarefaDetalhe.tsx`, criar uma seção dedicada "Histórico de Alterações" abaixo dos comentários, usando o `ProjetoAtividadesLog` melhorado — sempre visível, sem precisar clicar.

### 4. Informações de Criação e Atribuição no Header

No header do detalhe da tarefa, exibir:
- "Criada por **Fulano** em DD/MM/YYYY"
- "Atribuída a **Ciclano** por **Beltrano** em DD/MM"
- Último editor e data da última alteração

## Alterações Técnicas

| Arquivo | Ação |
|---|---|
| **Migration SQL** | Criar trigger `audit_projeto_tarefa_changes` + função |
| `ProjetoAtividadesLog.tsx` | Visual premium com ícones, cores, badges, valores anterior/novo |
| `ProjetoTarefaDetalhe.tsx` | Adicionar seção "Histórico" + info de criação/atribuição no header |

Zero mudança no `useProjetoTarefas.ts` — toda auditoria é feita pelo trigger no banco, garantindo que alterações por qualquer caminho (UI, API, direto) sejam rastreadas.

