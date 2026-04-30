## Análise: relatório vs. estado real do sistema

Auditei o relatório contra o banco e o código atual. **Quase tudo já está implementado** na rodada anterior. Há apenas 1 ponto novo no relatório que merece tratamento defensivo, e 2 itens que são teóricos e **não se aplicam aos dados reais**.

### Status item a item

| Item do relatório | Estado atual | Ação |
|---|---|---|
| Mapeamento `gid → asana_gid`, `name → titulo`, `notes → descricao`, `parent → parent_tarefa_id`, `due_on → data_prazo`, `assignee → responsavel_id` | ✅ Implementado | Nenhuma |
| Normalização de Prioridade (Alta/Média/Baixa, com aliases e TRIM) | ✅ `mapAsanaPriority` cobre alto/alta/high, médio/media/medium, baixo/baixa/low, urgente | Nenhuma |
| Consolidação Status + "Progresso da tarefa" | ✅ Implementado na rodada anterior (aliases adicionados) | Nenhuma |
| Mapeamento de "Estágio" | ✅ Coluna `estagio` populada via `cfMap.get("estágio")` | Nenhuma |
| `canal_criacao` (Interno, Anúncio, etc.) | ✅ Coluna criada + backfill rodado (125 tarefas classificadas: Interno 60, Design Trade 36, Mídias Sociais 19, Sites 9, PDV 1) | Nenhuma |
| `acom_referencia` | ✅ Existe como `codigo_acom` (30 tarefas preenchidas) | Nenhuma |
| `is_subtask` boolean | ✅ Coluna + trigger `trg_projeto_tarefas_set_is_subtask` | Nenhuma |
| Hierarquia subtarefas via `parent_tarefa_id` | ✅ `syncSubtasksRecursive` (até 3 níveis) | Nenhuma |
| Anexos (`projeto_tarefa_anexos`) | ✅ Tabela existe, **489 anexos já importados** | Nenhuma |
| Badge de origem Asana | ✅ `AsanaBadge.tsx` | Nenhuma |
| Filtro lateral por Canal de Criação | ✅ `ProjetoFilterSort.tsx` + `useMemo` em `ProjetoHeader` | Nenhuma |
| Visualização indentada de subtarefas | ✅ `useProjetoTarefas` agrupa por `parent_tarefa_id` | Nenhuma |
| TRIM em valores de texto | ✅ Aplicado em `cfMap` e `camposCustomizados` | Nenhuma |
| Dedupe de chaves duplicadas com whitespace | ✅ Implementado + backfill executado | Nenhuma |

### Pontos do relatório que NÃO se aplicam

1. **"Multi-Enum em Prioridade (GID 1211893937271322)"** — Verifiquei o banco: nenhum custom_field salvo tem `multi_enum_values` ou `type: multi_enum`. Todos são `enum` simples (`enum_value` com 1 objeto). Os 2 GIDs distintos de "Prioridade" (1550 + 116 ocorrências) já são desambiguados pelo `cfMap` (primeiro valor não-vazio com a mesma chave normalizada).

2. **"Risco de perda de anexos"** — Já há 489 anexos migrados no `projeto_tarefa_anexos`, com download para o bucket `projeto-anexos` ou referência `external://` para Drive/Dropbox.

### Único ajuste defensivo recomendado (opcional)

Se no futuro o Asana retornar `multi_enum_values` (array de enum), o código atual ignora silenciosamente (apenas lê `enum_value.name`). Para blindar:

**Em `supabase/functions/asana-sync/index.ts`**, na construção do `cfMap` (linhas ~309-318) e no helper de subtarefa (~linhas 707-714), aceitar também `multi_enum_values`:

```ts
let rawVal: string = "";
if (cf.enum_value?.name) {
  rawVal = cf.enum_value.name;
} else if (Array.isArray(cf.multi_enum_values) && cf.multi_enum_values.length) {
  rawVal = cf.multi_enum_values.map((v: any) => v?.name).filter(Boolean).join(", ");
} else if (cf.display_value) {
  rawVal = cf.display_value;
}
```

Isso garante compatibilidade futura sem mudar nenhum comportamento atual (já que hoje 0 tarefas usam multi_enum).

### Recomendação

**Não há trabalho urgente a fazer.** O relatório descreve um estado já alcançado. Se você quiser, posso aplicar o ajuste defensivo de `multi_enum_values` (5 linhas em 2 lugares) como hardening preventivo, mas é estritamente opcional.

## Próximo passo

Aguardando sua decisão:
- **Aplicar o hardening de multi_enum** (mudança mínima, defensiva)
- **Não fazer nada** — sistema já cobre 100% dos cenários reais observados
