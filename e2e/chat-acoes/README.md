# E2E — Barra de ações do chat (aprovação / chamar atenção)

Valida a paridade da `ChatComposerActionsBar` e o fluxo completo
**clique → resultado** nos quatro contextos onde o chat aparece.

| Contexto | Rota | Observação |
|---|---|---|
| Hub de Chat | `/dashboard/chat` | Aba Pessoas; diálogo abre direto na conversa |
| Painel lateral | `/dashboard/projetos/:id?tarefa=:tarefaId` | Drawer de detalhe da tarefa |
| Modo Foco | botão **Foco** dentro do drawer | Requer permissão de UI `acao_foco` |
| Processos | `/dashboard/suporte/processos/:id` | Barra sem anexar/câmera (usa "Anexar Doc") |

## Invariantes

- Mesmos `aria-label` em todos os contextos: `Solicitar aprovação`,
  `Chamar atenção (mensagem urgente)`, `Inserir emoji`.
- Clique resulta no diálogo correspondente aberto
  (`Solicitar aprovação` / `Chamar atenção da equipe`).
- Deep-link `?conversaId=...&abrir=aprovacao|urgente` é consumido e
  **removido** da URL pelo `ChatLayout`.

## Variáveis de ambiente

```bash
E2E_BASE_URL=https://id-preview--<id>.lovable.app
E2E_TEST_EMAIL=...
E2E_TEST_PASSWORD=...
E2E_PROJETO_ID=<uuid>    # contextos painel lateral e modo Foco
E2E_TAREFA_ID=<uuid>     # opcional; senão usa a 1ª tarefa do quadro
E2E_PROCESSO_ID=<uuid>   # contexto processos
```

Sem as variáveis opcionais os respectivos testes são **skipados**, nunca falham.

## Comando

```bash
bunx playwright test e2e/chat-acoes
```
