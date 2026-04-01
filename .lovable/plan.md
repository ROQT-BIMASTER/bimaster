

# Correções do Ambiente de Projetos — Bugs Encontrados nos Testes

## Testes Realizados

| Funcionalidade | Resultado |
|---|---|
| Home Pessoal (KPIs, saudação, projetos) | ✅ OK |
| Minhas Tarefas — Lista | ✅ OK (empty state funcional) |
| Minhas Tarefas — Quadro (Kanban) | ✅ OK |
| Minhas Tarefas — Calendário | ✅ OK (hoje destacado, empty state) |
| Caixa de Entrada (Inbox) | ✅ OK (KPIs, tabs, filtros, empty states) |
| Lista de Projetos | ✅ OK (status, progresso, membros) |
| Detalhe do Projeto — Lista de tarefas | ✅ OK (seções, inline input) |
| **Criar tarefa (Dialog "Nova Tarefa")** | ❌ ERRO |
| **Criar tarefa inline no projeto** | ❌ ERRO (silencioso) |

## Bug Crítico Encontrado

**Trigger `generate_tarefa_codigo` está quebrada.** A função referencia:
- `NEW.tipo` → coluna não existe (o campo correto é `tipo_tarefa`)
- Tabela `tarefas` → não existe (o nome correto é `projeto_tarefas`)

Isso impede **toda e qualquer criação de tarefa** no sistema (tanto via dialog quanto inline).

**Erro no banco:** `record "new" has no field "tipo"`

## Bug Secundário

- O dialog `NovaTarefaMinhasDialog` mostra erro genérico "Erro ao criar tarefa" sem detalhes — deveria logar o `error.message` para facilitar debug.
- A criação inline no projeto falha **silenciosamente** (sem toast de erro).

## Correções

### 1. Migration: Corrigir trigger `generate_tarefa_codigo`
Recriar a função para usar os nomes corretos:
- `NEW.tipo` → `NEW.tipo_tarefa`
- `FROM tarefas` → `FROM projeto_tarefas`
- `WHERE tipo =` → `WHERE tipo_tarefa =`

### 2. Melhorar mensagem de erro no Dialog
Em `NovaTarefaMinhasDialog.tsx`, incluir `error.message` no toast de erro.

### 3. Adicionar toast de erro na criação inline
Localizar o componente de criação inline de tarefas e adicionar feedback de erro visível ao usuário.

## Resultado Esperado
Após as correções, criar tarefas tanto pelo dialog quanto inline funcionará corretamente, com códigos auto-gerados (ex: `PAD-0001`).

