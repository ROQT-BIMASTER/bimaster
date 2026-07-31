## Objetivo

Deixar o composer de **todos** os chats do sistema com o mesmo conjunto de ações, hoje presente apenas em Pessoas, Briefings, Projetos e Submissões (China):

1. Anexar arquivo
2. Capturar pela câmera
3. Solicitar aprovação de documento
4. Chamar atenção (mensagem urgente)
5. Emojis

## Situação atual (verificada no código)

- `src/components/chat/v2/ChatComposerActionsBar.tsx` já é o componente padrão com os 5 botões.
- Usam a barra hoje: `MessageInput` (Pessoas), `BriefingChatPanel`, `ProjetoChatPanel`, `ChinaChatPanel`.
- **Não usam** (ficam só com "Anexar" ou nada):
  - `src/components/chat/v2/TarefaChatPanel.tsx` — aba Tarefas do hub de Chat
  - `src/components/projetos/tarefa-detalhe/TarefaChatPanel.tsx` — chat lateral da tarefa
  - `src/components/projetos/TarefaFocusMode.tsx` — chat do modo Foco (o da imagem enviada)
  - `src/components/processo/ProcessoChat.tsx` — chat de processos
- As ações de aprovação/urgência fora de Pessoas passam por `useAbrirAcaoVinculada`, que chama a rotina `rpc_get_or_create_conversa_vinculada` e hoje aceita apenas `briefing | projeto | submissao`.

## O que será feito

### 1. Backend — suportar vínculo por tarefa e processo
Atualizar a rotina `rpc_get_or_create_conversa_vinculada` para aceitar também `tarefa` e `processo`, mantendo o comportamento idempotente (reaproveita a conversa existente do item) e sincronizando participantes:
- `tarefa`: criador, responsável e seguidores da tarefa + membros do projeto ao qual ela pertence.
- `processo`: participantes já vinculados ao processo.
Sem ampliação de permissões: o chamador continua precisando estar autenticado e só entra em conversas de itens aos quais tem acesso.

### 2. Hook compartilhado
Estender `useAbrirAcaoVinculada` com os novos tipos e os rótulos correspondentes ("tarefa", "processo"), mantendo o fluxo atual (abre a conversa vinculada em `/dashboard/chat` já com o diálogo de aprovação ou de chamada de atenção).

### 3. Chats da tarefa
Em `chat/v2/TarefaChatPanel`, `tarefa-detalhe/TarefaChatPanel` e no chat do modo Foco (`TarefaFocusMode`):
- Substituir o botão solto de "Anexar" pela `ChatComposerActionsBar`.
- `onAttachFile` / `onCameraCapture` reaproveitam o upload de anexo já existente da tarefa (arquivo continua indo para os Anexos da tarefa, como hoje).
- `onRequestApproval` / `onUrgentAlert` chamam `abrirAprovacao` / `abrirUrgente` com `tipo: "tarefa"` e o título da tarefa.
- `onEmojiPick` insere o emoji no texto em edição.

### 4. Chat de processos
Mesma substituição em `ProcessoChat`, preservando o seletor de documentos oficiais já existente (o botão "Anexar Doc" continua, ao lado da barra padrão).

### 5. Validação
- Testes de renderização garantindo que os 4 chats expõem os botões "Solicitar aprovação" e "Chamar atenção".
- Teste da rotina para os novos tipos de vínculo (retorno idempotente e participantes corretos).
- Registro no changelog e bump de versão, conforme a disciplina de release do projeto.

## Detalhes técnicos

- Nenhuma alteração no armazenamento de mensagens das tarefas (`projeto_tarefa_messages`) — a aprovação/urgência continua vivendo na conversa vinculada, como já ocorre em Briefings e Projetos.
- A barra aceita `size` e `accept`, então a densidade do modo Foco e do painel lateral é preservada.
- Sem mudança nas regras de acesso a arquivos nem no fluxo de homologação de documentos da China.
