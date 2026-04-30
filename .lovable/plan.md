# Auditoria final: relatório vs. estado real (rodada 4)

Este é o **mesmo relatório** já auditado e implementado nas rodadas anteriores. Comparei mais uma vez com o banco e o código atuais — **nenhum item novo apareceu** e **nenhuma ação técnica é necessária**.

## Status definitivo (1.850 tarefas Asana já no sistema)

| Item do relatório | Estado atual | Evidência |
|---|---|---|
| `projeto.asana_gid`, `tarefa.asana_gid` | ✅ Implementado | 1.850 tarefas com `asana_gid` populado |
| `task.name → titulo`, `notes → descricao`, `parent → parent_tarefa_id` | ✅ Implementado | `asana-sync/index.ts` |
| Normalização de Prioridade (Alta/Média/Baixa, com aliases + TRIM) | ✅ Implementado | `mapAsanaPriority` + `cfMap` lowercase/trim |
| Normalização de Status ("Feito"/"Finalizado"/"Concluído" → `concluida`) | ✅ Implementado | Banco só tem 3 valores: `concluida` (1.341), `pendente` (485), `em_andamento` (24) |
| Mapeamento de "Estágio" | ✅ Implementado | 80 tarefas com `estagio` populado |
| Campo "Canal de criação" preservado | ✅ **Coluna `canal_criacao` existe** — não foi necessária tabela `projeto_tarefas_metadados` | 125 tarefas classificadas (Interno 60, Design Trade 36, Mídias Sociais 19, Sites 9, PDV 1) |
| Campo "ACOM" → `codigo` | ✅ Implementado como `codigo_acom` (coluna dedicada) | 30 tarefas preenchidas |
| Campos duplicados de Prioridade (4 GIDs distintos) | ✅ Resolvido pelo `cfMap` que normaliza chaves e mantém o primeiro `display_value` não-vazio | — |
| Multi-enum (defensivo) | ✅ Hardening aplicado: `extractCustomFieldValue` lê `multi_enum_values` e concatena com `, ` | `asana-sync/index.ts` |
| Tabela de anexos | ✅ `projeto_tarefa_anexos` criada — **489 anexos importados** | — |
| Tabela de seguidores | ⚠️ Não foi criada (decisão da rodada anterior: o produto não tem feature de "seguidores"; followers do Asana não geram valor) | — |
| Badge "Asana" na UI | ✅ `AsanaBadge.tsx` em `ProjetoTarefaRow.tsx` | — |
| Filtro lateral por Canal de Criação | ✅ `ProjetoFilterSort.tsx` | — |
| Sub-tarefas aninhadas no frontend | ✅ `useProjetoTarefas` agrupa por `parent_tarefa_id` (907 subtarefas marcadas via trigger `is_subtask`) | — |
| **Chip colorido por Canal de Criação** | ✅ Adicionado na rodada anterior (`CanalCriacaoBadge.tsx` ao lado do AsanaBadge) | — |

## Pontos do relatório que NÃO se aplicam (e por quê)

1. **`stg_asana_tasks` (staging table)** — não usamos staging. O fluxo é Edge Function `asana-sync` direto na fonte, com upsert por `asana_gid`. O `COALESCE` proposto no SQL é resolvido em TypeScript no `cfMap`.

2. **Tabela `projeto_tarefas_metadados`** — não foi criada porque os campos analíticos de valor (canal, ACOM, estágio) viraram **colunas dedicadas** no `projeto_tarefas`. Uma tabela genérica de metadados geraria queries mais complexas para o mesmo resultado.

3. **`origem_projeto = 'asana_migration'`** — não criamos coluna de origem porque `asana_gid IS NOT NULL` já é o predicado oficial usado em todo o código.

4. **Tabela `projeto_tarefa_seguidores`** — feature inexistente no produto. Adicionar a tabela sem UI seria armazenamento morto.

## Recomendação

**Encerrar esta thread de migração.** O relatório descreve um estado que já está 100% em produção há 3 rodadas. Se aparecer um requisito novo (ex: usar followers do Asana, criar dashboard analítico sobre canal_criacao, importar `task.notes` para um histórico longo), abrir como tarefa separada com escopo claro.

## Próximo passo

Nada a fazer. Aguardando confirmação do encerramento ou um novo escopo.
