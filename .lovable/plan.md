
## Correção para importar os comentários do Asana

### Diagnóstico
A importação de comentários está implementada, mas o filtro atual está muito frágil e provavelmente está descartando os comentários vindos do Asana.

Hoje o sync faz isso em `supabase/functions/asana-sync/index.ts`:
- busca `/tasks/{gid}/stories`
- pede apenas `text,type,created_by,created_at`
- filtra com `if (story.type !== "comment" || !story.text) continue`

Pelo contrato da API do Asana, comentários também são identificados por `resource_subtype = "comment_added"`. Como o código:
- não solicita `resource_subtype`
- não solicita `gid` explicitamente
- depende só de `type === "comment"`

ele pode ignorar comentários válidos e ainda comprometer a deduplicação em `asana_sync_mappings`.

### O que vou ajustar

1. **Fortalecer a leitura das stories**
   Em `supabase/functions/asana-sync/index.ts`, ampliar `opt_fields` para incluir:
   - `gid`
   - `resource_subtype`
   - `html_text` (opcional, para fallback futuro)
   - manter `text`, `type`, `created_by`, `created_at`

2. **Corrigir a regra que identifica comentário**
   Em vez de aceitar só `story.type === "comment"`, considerar comentário quando:
   - `story.type === "comment"`, ou
   - `story.resource_subtype === "comment_added"`

   Também manter filtro para conteúdo não vazio.

3. **Manter deduplicação confiável**
   O código já usa `asana_sync_mappings` com `entity_type = "comment"`. Vou preservar esse fluxo, mas garantir que ele tenha sempre acesso ao `story.gid` retornado pela API.

4. **Melhorar visibilidade de erros no log**
   Se o insert do comentário falhar, o erro deve continuar aparecendo em `errors`, mas com contexto suficiente para diferenciar:
   - erro de leitura da API
   - erro de insert no banco
   - comentário ignorado por falta de texto

### Resultado esperado
Após o ajuste:
- comentários do Asana passam a ser importados junto com as tarefas
- `comments_synced` deixa de ficar zerado quando houver comentários reais
- os comentários ficam visíveis nas telas que já consomem `projeto_tarefa_comentarios`
- sincronizações futuras não duplicam comentários já mapeados

## Arquivo a alterar
- `supabase/functions/asana-sync/index.ts`

## Detalhes técnicos
```text
Hoje:
stories -> filtra só type === "comment"

Depois:
stories -> aceita
  type === "comment"
  OU resource_subtype === "comment_added"
-> insere em projeto_tarefa_comentarios
-> grava mapping por story.gid
```

## Validação após implementar
1. Rodar sync novamente no mesmo projeto
2. Verificar `comments_synced > 0`
3. Abrir uma tarefa importada com comentários no detalhe
4. Confirmar que os comentários aparecem na timeline/chat da tarefa
5. Rodar o sync uma segunda vez e validar que não houve duplicação
