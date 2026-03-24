

# Chat do Processo — Comunicacao Contextual com Acoes Oficiais

## Resumo

Criar um chat em tempo real dentro de cada processo do produto, onde usuarios podem discutir, mencionar modulos/pessoas, vincular documentos existentes a mensagens, e — criticamente — oficializar documentos diretamente do chat, gerando juntada automatica e registro na timeline do processo.

## Nova tabela: `process_chat_messages`

```text
process_chat_messages
├── id (UUID PK)
├── process_id (UUID FK → product_process)
├── user_id (UUID, auth.uid())
├── user_nome (text)
├── conteudo (text) — texto da mensagem, suporta @mencoes
├── modulo_origem (text) — modulo de onde o usuario enviou
├── tipo (text default 'mensagem') — mensagem | juntada | decisao | sistema
├── documento_ids (UUID[]) — array de docs vinculados a esta mensagem
├── documento_oficializado_id (UUID nullable) — se esta msg oficializou um doc
├── fase_processo (text nullable) — fase do checklist vinculada
├── metadata (jsonb default '{}')
├── created_at (timestamptz)
```

- RLS: authenticated pode SELECT e INSERT onde process_id pertence a processos que o user tem acesso
- Realtime habilitado para atualizacao instantanea

## Componentes

### 1. `ProcessoChat.tsx` — Componente principal

Embute dentro do `ProcessoAmbiente` como nova aba "Chat" ou como componente standalone na expansao do produto.

**Estrutura do chat:**
- Lista de mensagens com scroll automatico e realtime
- Cada mensagem mostra: avatar, nome, modulo de origem (badge), horario
- Mensagens do tipo `juntada` ou `decisao` tem visual diferenciado (card com icone)
- Documentos vinculados aparecem como chips clicaveis abaixo do texto

**Barra de input:**
- Textarea com `@` mention (reutiliza logica do `MentionInput` existente)
- Botao de anexar documento (abre seletor dos docs da submissao)
- Botao de oficializar (transforma doc selecionado em juntada oficial)

### 2. `ProcessoChatDocPicker.tsx` — Seletor de documentos

Dialog que lista documentos da submissao (`china_produto_documentos`) agrupados por categoria. O usuario seleciona um ou mais docs para:
- **Vincular**: anexa referencia na mensagem do chat
- **Oficializar**: cria juntada no `process_juntadas`, registra evento em `process_events`, e posta mensagem de sistema no chat

### 3. `ProcessoChatMentions.tsx` — Sistema de mencoes

Combina duas fontes de mencao:
- **@modulo** — lista dos modulos habilitados (`process_modulos_despacho` onde `ambiente_habilitado = true`)
- **@pessoa** — lista de profiles da equipe

Ao mencionar um modulo, o sistema pode gerar notificacao para responsaveis daquele modulo.

## Hook: `useProcessoChat.ts`

```text
useProcessoChat(processId)
├── messages — query com realtime subscription
├── sendMessage(conteudo, modulo, docIds?) — insert + invalida cache
├── oficializarDocumento(docId, mensagem, fase?) — cria juntada + evento + msg sistema
└── mentions — query de modulos + profiles disponiveis
```

A acao `oficializarDocumento`:
1. Insere em `process_juntadas` com referencia ao documento
2. Registra `process_event` tipo "juntada" com metadata incluindo chat_message_id
3. Insere mensagem de sistema no chat: "Fulano oficializou o documento X como documento oficial do processo — Fase: Y"

## Integracao

- **`ProcessoAmbiente.tsx`**: adicionar aba "Chat" ao TabsList existente
- **`ChinaSubmissaoExpandido.tsx`**: se ha processo vinculado, exibir botao para abrir chat
- As mensagens de acao (ciencia, aprovacao, rejeicao, contestacao) do `useProcessoAmbiente` tambem geram mensagem automatica no chat, criando um registro unificado

## Fluxo do usuario

```text
1. Abre produto na tela Vincular China
2. Expande submissao → ve abas do processo
3. Clica em "Chat" 
4. Digita: "@regulatorio precisamos validar a formula antes de aprovar"
5. Clica no clip → seleciona "Laudo Composicao INCI"
6. Documento aparece como chip na mensagem
7. Outro usuario responde: "Aprovado, pode oficializar"
8. Usuario clica "Oficializar" no documento → seleciona fase "Analise Regulatoria"
9. Sistema cria juntada, registra evento, posta mensagem de sistema
10. Timeline do processo reflete automaticamente
```

## Arquivos

| Arquivo | Acao |
|---------|------|
| Migration SQL | CREATE TABLE `process_chat_messages` + RLS + realtime |
| `src/hooks/useProcessoChat.ts` | Hook com queries, mutations, realtime |
| `src/components/processo/ProcessoChat.tsx` | UI do chat com mentions e doc picker |
| `src/components/processo/ProcessoChatDocPicker.tsx` | Dialog de selecao de documentos |
| `src/components/processo/ProcessoAmbiente.tsx` | Adicionar aba "Chat" |

