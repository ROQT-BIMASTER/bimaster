

# Corrigir Tabela de Eventos Webhook na Documentação

## Problema

A tabela de eventos webhook em `ApiDocumentation.tsx` (linha 1518-1528) lista apenas **11 eventos**, mas o backend (`webhook-subscriptions-api`) suporta **19 eventos**. Faltam:

| Evento faltante | Módulo |
|---|---|
| `cliente.excluido` | Clientes |
| `conta_receber.alterado` | Contas a Receber (listado mas sem evento excluido) |
| `fornecedor.excluido` | Fornecedores |
| `departamento.criado` | Departamentos |
| `departamento.alterado` | Departamentos |
| `categoria.criado` | Categorias |
| `categoria.alterado` | Categorias |
| `projeto.criado` | Projetos |
| `projeto.alterado` | Projetos |
| `conta_corrente.criado` | Contas Correntes |
| `conta_corrente.alterado` | Contas Correntes |
| `lancamento_cc.criado` | Lançamentos CC |
| `tarefa.criado` | Tarefas |
| `tarefa.alterado` | Tarefas |
| `tarefa.concluido` | Tarefas |

## Correção

**Arquivo: `src/components/erp/ApiDocumentation.tsx`** (linhas 1518-1528)

Expandir o array de eventos para incluir todos os 19 eventos suportados pelo backend, mantendo o mesmo formato `{ event, desc, mod }`.

Apenas uma adição de linhas ao array existente — nenhuma remoção ou alteração de funcionalidade.

