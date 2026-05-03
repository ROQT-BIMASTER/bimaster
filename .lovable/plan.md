## Diagnóstico

O erro não está mais no inbox. O log atual aponta para `useProjetoTarefas.ts`:

```text
cannot add `postgres_changes` callbacks for realtime:rt-projeto-<projetoId> after `subscribe()`
```

A causa raiz é que a versão atual do cliente Realtime **reutiliza um canal existente quando o topic é igual**. Se duas instâncias do mesmo hook/componente montam ao mesmo tempo com o mesmo nome de canal, a segunda recebe o canal já em `joining/joined` e tenta adicionar `.on('postgres_changes')`, gerando crash. Isso pode acontecer em várias rotas, principalmente em React StrictMode e telas que renderizam o mesmo hook mais de uma vez.

## Plano de correção

1. **Criar um helper central de Realtime**
   - Novo utilitário em `src/lib/realtime/channelName.ts` ou equivalente.
   - Gerar nomes únicos e seguros por instância, preservando prefixos legíveis para debug.
   - Evitar repetição manual de `crypto.randomUUID()` em dezenas de arquivos.
   - Incluir fallback para ambientes sem `crypto.randomUUID()`.

2. **Corrigir imediatamente o crash da rota de projetos**
   - Atualizar `src/hooks/useProjetoTarefas.ts`.
   - Trocar `rt-projeto-${projetoId}` por um canal único por instância.
   - Adicionar `cancelled` para bloquear invalidações após unmount.
   - Fazer cleanup defensivo: limpar debounce e chamar `removeChannel(channel).catch(...)`.
   - Adicionar logs de status apenas para falhas relevantes (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`) sem derrubar UI.

3. **Aplicar o mesmo padrão nos demais canais Realtime encontrados**
   - Atualizar canais estáticos ou parametrizados que podem montar duplicados, incluindo hooks, páginas e componentes com `.channel(...)`.
   - Prioridade para pontos globais/rotas amplas: notificações, China inbox, chats, WhatsApp, dashboards, sidebar, módulos de Trade, aprovações, conversas e tickets.
   - Não alterar regra de negócio, queries, filtros, permissões ou schema; somente nome do canal, logs e cleanup.

4. **Validar rota por rota com sinais objetivos**
   - Usar o preview/browser para abrir a rota atual de projeto e confirmar ausência do erro de `postgres_changes after subscribe()`.
   - Verificar console após login/navegação para confirmar que canais fechados por unmount não viram crash.
   - Testar rotas representativas dos grupos com Realtime: Projetos, Inbox/Central, China, Trade, WhatsApp/Chat quando acessíveis.
   - Se alguma rota exigir contexto/dado indisponível, deixar anotado e validar ao menos que o código não mantém topic reutilizado.

5. **Entrega**
   - Resumo curto dos arquivos ajustados.
   - Informar quais rotas foram verificadas e se restou alguma dependente de permissão/dados.