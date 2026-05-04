# E2E — Comentário inválido no Histórico de Aprovações

> Complementa `docs/qa/e2e-aprovacoes-flow.md`. Garante que entradas
> inválidas (vazias, só espaços, ou >4000 caracteres) **não** geram eventos
> no histórico e que o usuário recebe feedback claro.

## Cobertura

Componente: `src/components/projetos/aprovacoes/kanban/HistoricoItemDialog.tsx`
Hook: `useComentarItem` em `src/hooks/useItemHistorico.ts`
RPC: `public.rpc_comentar_item_aprovacao` (valida `length(p_comentario) BETWEEN 1 AND 4000`).

| Caso | Entrada | Resultado esperado | Camada que bloqueia |
|---|---|---|---|
| Vazio | textarea sem texto | Botão **Comentar** desabilitado; nenhum request à RPC; timeline inalterada. | UI (`disabled` + early-return em `handleEnviarComentario`) |
| Apenas whitespace | `"   "` | Botão **Comentar** continua desabilitado; submit via Ctrl+Enter também é ignorado. | UI (`novoComentario.trim()` falsy) |
| >4000 caracteres | string com 4001 chars | Toast vermelho com a mensagem retornada pela RPC; textarea preserva o conteúdo; nenhum evento novo na timeline. | RPC (`raise exception`) → `toast.error` |
| Item sem permissão | usuário não autorizado | Toast `permission denied`; timeline intacta. | RPC (`has_role`/responsável check) |

## Roteiro manual no preview

1. Logar e ir para `/dashboard/central/aprovacoes`.
2. Abrir um card → clicar **Ver histórico do item**.
3. **Caso vazio**: confirmar que o botão **Comentar** começa desabilitado.
4. **Caso whitespace**: digitar `"    "` (4 espaços) → o botão permanece
   desabilitado.
5. **Caso >4000**: colar um texto com mais de 4000 caracteres
   (ex.: `"a".repeat(4001)`), clicar **Comentar**.
   - Validar toast vermelho.
   - Validar que **nenhuma nova entrada** aparece na timeline.
   - Validar que o textarea **mantém** o conteúdo digitado.
6. Apagar o textarea e fechar o dialog. Reabrir e confirmar que nenhum
   resíduo foi persistido.

## Reproduzir via browser tool (Lovable agent)

```text
browser--navigate_to_sandbox path=/dashboard/central/aprovacoes
browser--act mode=structured method=click selector=<primeiro card>
browser--act mode=natural_language action='Click "Ver histórico do item" button'

# Caso vazio
browser--observe instruction="Find the Comentar submit button and check disabled state"

# Caso whitespace
browser--act mode=natural_language action='Type "    " (4 spaces) into the comment textarea'
browser--observe instruction="Confirm Comentar button is still disabled"

# Caso >4000
browser--act mode=natural_language action='Clear the textarea then paste a string of 4001 letters "a"'
browser--act mode=natural_language action='Click "Comentar" button to submit'
browser--screenshot                       # confirmar toast de erro
browser--list_network_requests            # localizar POST para /rest/v1/rpc/rpc_comentar_item_aprovacao
browser--get_network_request_details request_ids=<id>
# resposta esperada: status 400/500 com mensagem do raise da RPC
```

## Critérios de aceitação

- Botão **Comentar** é desabilitado para `value.trim() === ""`.
- `mutateAsync` **não** é chamado em early-return (verificável por
  `useComentarItem.mutateAsync` mock count = 0 nos testes unitários).
- Quando a RPC rejeita, `toast.error(e.message)` é exibido e
  `setNovoComentario("")` **não** roda (textarea preserva o valor).
- `invalidateQueries(["item-historico", itemId])` **não** dispara em caso
  de erro (apenas `onSuccess` invalida — ver `useItemHistorico.ts`).
- Cobertura unitária garantida em
  `src/components/projetos/aprovacoes/kanban/__tests__/HistoricoItemDialog.test.tsx`
  (bloco `HistoricoItemDialog — comentário inválido`, 4 casos).

## Notas

- A validação dura (>4000 chars) está no SQL; não duplique no frontend
  com mensagens conflitantes — apenas propague `e.message` no toast.
- Não regredir `handleEnviarComentario` para limpar o textarea antes do
  `await comentar.mutateAsync(...)` — isso destruiria o conteúdo do
  usuário em caso de erro de rede.
