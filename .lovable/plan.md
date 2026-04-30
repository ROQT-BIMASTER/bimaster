## Análise do estado atual vs. relatório

A migração Asana já está implementada em grande parte (schema, edge function, anexos, seguidores, subtarefas, AsanaBadge, filtro por canal). Após auditoria com queries reais no banco, identifiquei **5 gaps concretos** que precisam de correção — o restante do relatório já está coberto.

### Gaps confirmados por dados reais

| Gap | Evidência |
|-----|-----------|
| `canal_criacao` 100% NULL nas 1.850 tarefas migradas | `campos_customizados` tem "Canal de criação" preenchido em 125 tarefas (Interno, Design Trade, Mídias Sociais, Sites, PDV), mas nenhuma migrou para a coluna |
| "Progresso da tarefa" não é considerado como status | 987 tarefas têm esse campo (Feito/Aguardando/Em andamento), mas só "Status"/"Estágio" são lidos |
| `codigo_acom` quase vazio (4/1824) | Campo "ACOM" existe em 30 tarefas; mapeamento `cfMap.get("acom")` provavelmente falha por ser texto livre, não enum |
| Chaves duplicadas com whitespace | JSON tem `"Status"` e `"Status "` (com espaço) gerando duas entradas em `campos_customizados` |
| Sem backfill retroativo | Tarefas já importadas não recebem os novos mapeamentos sem re-sync completo |

## O que precisa ser feito

### 1. Corrigir mapeamento de campos na edge function
Em `supabase/functions/asana-sync/index.ts` (e no helper de subtarefas, ~linha 696):

- Adicionar `"progresso da tarefa"` e `"progresso"` aos aliases de status (com prioridade após "status" oficial).
- Estender alias de `codigo_acom` para `"acom"`, `"código acom"`, `"codigo acom"`, `"acom referencia"`.
- Garantir que `cfMap` não pule duplicatas vazias — quando há `"Status"` e `"Status "`, manter o que tem `display_value` não-vazio (já faz `if (val && !cfMap.has(key))`, mas precisa também atualizar se o existente estiver vazio — revisar lógica).
- No bloco de `camposCustomizados`, normalizar a chave (`cf.name.trim()`) antes de salvar para eliminar duplicatas com whitespace.

### 2. Expandir tabela de normalização de status
A função `mapAsanaStatus` precisa cobrir os valores reais vistos no banco:
- `"Feito"`, `"Concluído"`, `"Finalizado"` → `concluida`
- `"Em andamento"` → `em_andamento`
- `"Aguardando"`, `"Aguardando Criação"`, `"Bloqueado"` → `bloqueado` (verificar se enum local aceita `bloqueado` ou usar `pendente`)
- Default → `pendente`

### 3. Backfill SQL one-shot
Migration para popular as 1.850 tarefas já importadas sem precisar de re-sync completo:

```sql
-- canal_criacao a partir de campos_customizados
UPDATE projeto_tarefas
SET canal_criacao = TRIM(campos_customizados->>'Canal de criação')
WHERE asana_gid IS NOT NULL
  AND canal_criacao IS NULL
  AND campos_customizados ? 'Canal de criação'
  AND TRIM(campos_customizados->>'Canal de criação') <> '';

-- codigo_acom a partir de campos_customizados (chave "ACOM")
UPDATE projeto_tarefas
SET codigo_acom = TRIM(campos_customizados->>'ACOM')
WHERE asana_gid IS NOT NULL
  AND codigo_acom IS NULL
  AND campos_customizados ? 'ACOM';

-- status a partir de "Progresso da tarefa" quando status atual é genérico
UPDATE projeto_tarefas
SET status = CASE TRIM(campos_customizados->>'Progresso da tarefa')
  WHEN 'Feito' THEN 'concluida'
  WHEN 'Em andamento' THEN 'em_andamento'
  WHEN 'Aguardando' THEN 'pendente'
  ELSE status
END
WHERE asana_gid IS NOT NULL
  AND campos_customizados ? 'Progresso da tarefa'
  AND status = 'pendente';

-- Limpeza de chaves duplicadas com whitespace em campos_customizados
UPDATE projeto_tarefas
SET campos_customizados = (
  SELECT jsonb_object_agg(TRIM(key), value)
  FROM jsonb_each(campos_customizados)
  WHERE value::text <> '""' AND value IS NOT NULL
)
WHERE asana_gid IS NOT NULL
  AND campos_customizados IS NOT NULL;
```

### 4. Sem mudanças no frontend
O `AsanaBadge`, filtro por canal e renderização indentada de subtarefas já estão implementados. Após o backfill, o filtro lateral por `canal_criacao` passa a mostrar opções reais automaticamente (já é `useMemo` sobre as tarefas).

## Arquivos afetados
- `supabase/functions/asana-sync/index.ts` — corrigir aliases de campos e dedupe de chaves
- `supabase/migrations/<timestamp>_asana_backfill_normalize.sql` — backfill via tool de insert (não migration, pois é DML)

## O que NÃO mudar
- Schema (já tem `canal_criacao`, `is_subtask`, `origem_projeto`, `codigo_acom`, `projeto_tarefa_seguidores`, `projeto_tarefa_anexos`)
- AsanaBadge, filtro lateral, indentação de subtarefas (já existem)
- Lógica de download de anexos (já implementada com cap de 50MB e fallback `external://`)
- Hook `useAsanaSync` (já cobre progresso)
