

# Chat do Processo — Mensagens Publicas e Privadas

## Resumo

Adicionar ao chat do processo a capacidade de enviar mensagens publicas (visiveis a todos os participantes) ou privadas (visiveis apenas ao remetente e destinatarios selecionados). Mensagens privadas mantêm todas as funcionalidades existentes: vincular documentos, oficializar, mencionar modulos.

## Alteracoes no banco de dados

Adicionar duas colunas na tabela `process_chat_messages`:

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| `visibilidade` | text | 'publica' | 'publica' ou 'privada' |
| `destinatarios_ids` | uuid[] | '{}' | Lista de user_ids que podem ver a mensagem privada |

Atualizar a RLS policy de SELECT para filtrar: mensagens publicas sao visiveis a todos os autenticados, mensagens privadas sao visiveis apenas se `auth.uid() = user_id` (remetente) OU `auth.uid() = ANY(destinatarios_ids)`.

```text
Policy SELECT:
  visibilidade = 'publica'
  OR user_id = auth.uid()
  OR auth.uid() = ANY(destinatarios_ids)
```

## Alteracoes na UI (`ProcessoChat.tsx`)

1. **Toggle de visibilidade na barra de input**: Botao/switch "Publica" / "Privada" ao lado do campo de mensagem. Quando "Privada" esta ativo, aparece um seletor de destinatarios (lista de usuarios do sistema).

2. **Seletor de destinatarios**: Dropdown multi-select com os perfis do sistema. So aparece quando modo privado esta ativo.

3. **Indicador visual nas mensagens**: Mensagens privadas exibem um icone de cadeado e badge "Privada" para diferenciar visualmente das publicas.

4. **Filtro no header do chat**: Tabs ou toggle para alternar entre "Todas", "Publicas", "Privadas" — filtro client-side sobre as mensagens ja retornadas (a RLS garante que so vem mensagens autorizadas).

## Alteracoes no Hook (`useProcessoChat.ts`)

- Interface `ProcessChatMessage`: adicionar `visibilidade` e `destinatarios_ids`
- `sendMessage`: aceitar `visibilidade` e `destinatarios_ids` no input, inserir na tabela
- `oficializarDocumento`: mensagens de oficializacao de conversa privada podem ser marcadas como privadas tambem

## Fluxo do usuario

```text
1. Usuario abre chat do processo
2. Clica no toggle "Privada" → aparece seletor de destinatarios
3. Seleciona "Maria — Regulatorio" como destinataria
4. Digita: "Maria, precisamos revisar esse laudo antes de oficializar"
5. Vincula documento "Laudo INCI" a mensagem
6. Envia → mensagem aparece com icone de cadeado para ambos
7. Outros usuarios do processo NAO veem essa mensagem
8. Maria responde na conversa privada, decide oficializar o documento
9. Clica "Oficializar" → documento e vinculado ao processo (evento publico na timeline)
```

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| Migration SQL | ALTER TABLE add `visibilidade`, `destinatarios_ids` + update RLS |
| `src/hooks/useProcessoChat.ts` | Tipo + mutation com novos campos |
| `src/components/processo/ProcessoChat.tsx` | Toggle privada, seletor destinatarios, visual cadeado, filtro |

