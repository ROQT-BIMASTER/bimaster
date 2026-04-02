

# Implementar Sugestões da Análise IA do Asana

## Descobertas da Exploração

O banco já possui várias tabelas que a IA sugeriu criar:
- **`projeto_tarefa_anexos`** — JÁ EXISTE (com `tarefa_id`, `nome`, `storage_path`, `tipo_arquivo`, `tamanho`)
- **`projeto_tarefa_colaboradores`** — JÁ EXISTE (serve como "seguidores" com `tarefa_id`, `user_id`)
- **`asana_gid`** em `projeto_tarefas` — JÁ EXISTE

O que **realmente falta**:
1. Campo `codigo_acom` na tabela `projeto_tarefas`
2. Campo `asana_gid` na tabela `projeto_tarefa_anexos` (para deduplicação na migração)
3. Mapeamento expandido de status/prioridade no sync para aceitar valores Asana como "Aguardando Terceiros", "Aprovado com Fiscal"
4. Frontend: Badge ACOM + exibição de seguidores na tarefa

## Plano

### 1. Migration SQL
- `ALTER TABLE projeto_tarefas ADD COLUMN codigo_acom VARCHAR(50)`
- `ALTER TABLE projeto_tarefa_anexos ADD COLUMN asana_gid TEXT`
- Sem necessidade de criar tabelas de seguidores ou anexos (já existem)

### 2. Edge Function `asana-sync` — Melhorias no Sync
- Mapear custom_field "ACOM" → `codigo_acom`
- Mapear custom_fields de Prioridade/Status **por nome** (não por GID) para normalizar redundâncias entre projetos
- Importar attachments do Asana → `projeto_tarefa_anexos` (download URL + metadata)
- Importar followers → `projeto_tarefa_colaboradores`
- Tratar valores nulos em prioridade/status graciosamente
- Importar subtarefas em segunda passada (pai primeiro, filhos depois)

### 3. Frontend — Badge ACOM no Detalhe da Tarefa
- Exibir badge com `codigo_acom` ao lado do título na listagem e no detalhe
- Componente simples: se `codigo_acom` existe, mostra `<Badge>ACOM-34</Badge>`

### 4. Mapeamento De/Para de Status e Prioridade
Expandir o mapeamento na edge function:

| Asana Status | Sistema Local |
|---|---|
| Em andamento | em_andamento |
| Aguardando Terceiros | aguardando_terceiros |
| Aprovado com Fiscal | aprovado_fiscal |
| Concluído | concluida |
| (null) | pendente |

| Asana Prioridade | Sistema Local |
|---|---|
| Alto / Alta | alta |
| Médio / Média | media |
| Baixo / Baixa | baixa |
| (null) | (null) |

## Alterações Técnicas

| Arquivo/Recurso | Ação |
|---|---|
| **Migration SQL** | Adicionar `codigo_acom` em `projeto_tarefas`, `asana_gid` em `projeto_tarefa_anexos` |
| **`supabase/functions/asana-sync/index.ts`** | Expandir sync: custom_fields por nome, attachments, followers, subtarefas ordenadas |
| **Componente tarefa (listagem/detalhe)** | Badge ACOM quando campo preenchido |

