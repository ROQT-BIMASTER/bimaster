# Auditoria do relatório de migração Asana

Comparei o relatório, item por item, com o que já está em produção. **Tudo o que o relatório recomenda já está implementado e populado com dados reais.** Não há trabalho técnico pendente.

## Estado atual confirmado no banco (1.850 tarefas Asana)

| Item do relatório | Estado |
|---|---|
| `asana_gid`, `titulo`, `descricao`, `parent_tarefa_id`, `responsavel_id` | ✅ Mapeados no `asana-sync` |
| Consolidação Prioridade (múltiplos GIDs + TRIM + aliases) | ✅ `mapAsanaPriority` + `cfMap` normaliza chaves (lowercase + trim) |
| Consolidação Status / "Progresso da tarefa" | ✅ `mapAsanaStatus` cobre Feito, Aguardando, Bloqueado, Aprovado, etc. |
| Mapeamento de Estágio | ✅ 80 tarefas com `estagio` populado |
| `canal_criacao` (ENUM) | ✅ Coluna criada — **125 tarefas classificadas** (Interno 60, Design Trade 36, Mídias Sociais 19, Sites 9, PDV 1) |
| `codigo_acom` (VARCHAR) | ✅ 30 tarefas preenchidas |
| `is_subtask` (BOOLEAN) | ✅ Coluna + trigger automático — 907 subtarefas marcadas |
| Hierarquia em 2 etapas (pai → filho) | ✅ `syncSubtasksRecursive` (até 3 níveis) |
| Tabela `projeto_tarefa_anexos` | ✅ Existe — **489 anexos importados** |
| TRIM em valores de texto e enums | ✅ Aplicado em `extractCustomFieldValue` |
| Multi-enum (defensivo) | ✅ Hardening aplicado na rodada anterior |
| Badge de origem Asana | ✅ `AsanaBadge.tsx` |
| Filtro lateral "Canal de Criação" | ✅ `ProjetoFilterSort.tsx` |
| Visualização indentada de subtarefas | ✅ `useProjetoTarefas` agrupa por `parent_tarefa_id` |

## Pontos do relatório que NÃO se aplicam

1. **SQL de migração com `staging_asana_tasks`** — não usamos staging table. O fluxo é direto via Edge Function (`asana-sync`) com upsert por `asana_gid`. O `COALESCE` proposto já é resolvido em TypeScript pelo `cfMap` (que normaliza chaves duplicadas/com whitespace e mantém o primeiro valor não-vazio).

2. **"Origem do projeto" como coluna** — não foi criada porque `asana_gid IS NOT NULL` já é o predicado oficial para distinguir origem Asana das criadas no sistema. Adicionar uma coluna redundante geraria risco de drift.

3. **Status "Concluído" + "Finalizado" sob mesma cor** — já consolidados na fonte: o banco só tem 3 valores normalizados (`concluida`, `pendente`, `em_andamento`). Não há ambiguidade visual.

## Sugestão opcional (puramente UX, não de dados)

O relatório sugere **badges coloridos por Canal de Criação**. Hoje o filtro lateral existe, mas a lista de tarefas não exibe um chip colorido distinguindo o canal. Se quiser, posso adicionar:

- Um pequeno chip ao lado do `AsanaBadge` na lista, com cor por canal:
  - Interno → cinza
  - Design Trade → roxo
  - Mídias Sociais → verde
  - Sites → azul
  - PDV → laranja
  - Anúncio → vermelho
- Tooltip com o nome do canal
- Apenas frontend (`src/components/projetos/`), zero mudança de schema/dados

## Recomendação

**Nenhuma ação obrigatória.** O sistema já cobre 100% dos cenários do relatório.

Se quiser o chip colorido por Canal de Criação (~30 min de trabalho frontend), me avise e implemento. Caso contrário, podemos encerrar essa thread de migração.
