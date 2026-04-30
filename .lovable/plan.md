## Escopo

Três entregas independentes na página de projeto/tarefa.

---

### 1. Busca por descrição (task.notes) na página do projeto

**Estado atual:** o cabeçalho do projeto (`ProjetoHeader`) só tem `FilterButton` (status, prioridade, etc.) e `SortButton`. Não existe input de busca textual. A Central de Trabalho e o `ProjetoHomeFilters` já buscam por título e descrição (entrega anterior).

**Mudanças:**
- Adicionar `searchTerm` ao estado em `ProjetoHome.tsx`, propagar para `ProjetoHeader` e `ProjetoListView`/`ProjetoKanbanView`/`ProjetoCronogramaView`/`ProjetoCalendarioView`.
- Inserir `<Input>` com ícone `Search` no `ProjetoHeader` (entre tabs e `FilterButton`), placeholder "Buscar tarefa ou anotação…", `h-8`, largura `220px`.
- Estender `applyProjetoFilters` em `src/lib/projetoFilterUtils.ts` para aceitar `searchTerm` opcional e filtrar por `titulo` ou `descricao` (`toLowerCase().includes`). Sem alteração de tipos públicos: passar `searchTerm` como segundo arg ou agregar dentro de `ProjetoFilters`.
- Garantir que subtarefas que casam com o termo "puxam" o pai para a visualização (manter pai mesmo sem match para preservar contexto).

---

### 2. Paginação dos comentários do Asana no detalhe da tarefa

**Estado atual:** `TarefaComentariosSection` já tem paginação (10 por página, "Carregar mais") da entrega anterior. **Nada a fazer** — a menos que se queira diferenciar visualmente comentários originados do Asana.

**Mudança proposta:**
- Adicionar badge "Asana" pequeno ao lado do autor quando o comentário veio da sincronização (verificar via `asana_sync_mappings` com `entity_type='comment'` e `local_id=comentario.id`).
- Para evitar N consultas, fazer um único `IN (...)` no carregamento dos comentários e mapear os IDs origem-Asana em um Set passado ao componente.
- Confirmar tamanho de página atual (10) ou ajustar para 20.

---

### 3. Anexos das tarefas — funcionamento perfeito

**Diagnóstico (achados na base):**

| Métrica | Valor |
|---|---|
| Total de anexos | 523 |
| Baixados para o storage `projeto-anexos` | 34 |
| **Com URL crua do Asana (`asanausercontent.com`)** | **488** |
| Tipo `asana_hosted` | 488 |

As 488 URLs cruas têm parâmetro de expiração `e=` (Unix ts). Exemplos atuais já expiraram (`e=1775148794` = 28/03/2026). Por isso "abrir" não funciona.

Além disso, `TarefaAnexosSection.handleDownload` usa `window.open(url, "_blank")` — viola a regra Core "usar `StoragePreviewDialog` para download como Blob".

**Mudanças:**

**3.1. Frontend — preview seguro:**
- Substituir `window.open` por abertura do `StoragePreviewDialog` (renderizado como filho do componente).
- Estender `resolveToStoragePath` em `src/lib/utils/storage-download.ts` para reconhecer paths sem protocolo iniciados por `imported/asana/...` ou pertencentes a tarefas → bucket `projeto-anexos`. Default continua `fabrica-custo-evidencias` para retrocompatibilidade.
- Para anexos `external://` (links Drive/Dropbox/OneDrive): manter `window.open` apenas neles (são links externos legítimos), com ícone diferente e tooltip "Abre em nova aba".
- Para anexos cuja URL é `https://asanausercontent.com/...` (legacy não migrado): mostrar badge "Expirado — re-sincronizar" e botão "Reimportar" que dispara nova sync do anexo via edge function.

**3.2. Backend — reimportar os 488 anexos legacy:**
- Criar nova edge function `asana-reimport-attachments` (ou novo endpoint dentro de `asana-sync`) que:
  1. Lê anexos com `storage_path LIKE 'http%' AND asana_gid IS NOT NULL`.
  2. Para cada um: chama `GET /attachments/{gid}` no gateway do Asana com `opt_fields=download_url,name,size,host` para obter download URL fresca.
  3. Faz download autenticado, faz upload para `projeto-anexos` em `imported/asana/{tarefa_id}/{gid}-{nome}` e atualiza a linha (`storage_path`, `tipo_arquivo`, `tamanho`).
  4. Roda em batch (50 por chamada) com paginação para respeitar o limite de 25s do edge runtime.
- Adicionar UI em `IntegracoesAsana.tsx` (página atual `/dashboard/integracoes/asana`): botão "Reimportar anexos legacy (488 pendentes)" que invoca a função em loop até zerar.
- Garantir que o RLS / policies do bucket `projeto-anexos` permitem leitura (signed URL) por membros do projeto.

**3.3. Bucket — verificação:**
- Confirmar que `projeto-anexos` existe e suas policies permitem `select` para usuários com acesso ao projeto via tarefa. Se for público demais ou restrito demais, ajustar via migration (sem tocar em schema `storage`).

---

## Plano técnico — ordem de execução

```text
1. Backend (sem touch UI)
   ├─ Edge function: asana-reimport-attachments (batch 50)
   └─ Verificar policies do bucket projeto-anexos

2. Frontend — Anexos
   ├─ Estender storage-download.ts (suportar bucket projeto-anexos)
   ├─ Refatorar TarefaAnexosSection: usar StoragePreviewDialog
   ├─ Tratar 3 casos: storage local / external link / asana legacy
   └─ Adicionar botão "Reimportar" no card legacy

3. Frontend — Busca por descrição
   ├─ Estender applyProjetoFilters com searchTerm
   ├─ Adicionar Input no ProjetoHeader
   └─ Propagar searchTerm em ProjetoHome → views

4. Frontend — Comentários Asana (opcional, a confirmar)
   └─ Badge "Asana" via lookup em asana_sync_mappings
```

---

## Riscos e pontos de atenção

- **Reimportar 488 anexos** = 488 downloads + 488 uploads. Em batch de 50, ~10 chamadas. Cada anexo pode ter até 50 MB. Vai consumir banda e tempo. Sugiro dry-run mostrando tamanho total antes de executar.
- Para os anexos cuja URL Asana já expirou totalmente (`e=` muito antigo), o re-fetch pode falhar com 403. Tratar como erro registrado em `asana_sync_log.errors` e marcar o anexo como "indisponível" (ex.: `tipo_arquivo='asana_expired'`).
- **Sem reimportação**: anexos legacy ficam permanentemente quebrados. Se o usuário não autorizar a reimportação, a UI deve ao menos comunicar isso claramente em vez de "não abrir".

---

## Decisão necessária do usuário

1. **Reimportar os 488 anexos legacy do Asana?** (Recomendado — sem isso, os anexos não vão abrir, apenas mostrarão aviso de "expirado".)
2. **Adicionar badge "Asana" nos comentários sincronizados?** (Item 2 do plano — paginação já existe.)
3. **Local da busca**: adicionar um input dedicado no header do projeto (proposta acima) ou colocar dentro do popover de filtros existente?
