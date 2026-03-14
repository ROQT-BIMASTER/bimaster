

## Chat In-line China ↔ Brasil

Criar um sistema de chat em tempo real entre as equipes China e Brasil, integrado diretamente na ficha do produto (`ChinaFichaProduto`), seguindo o padrão visual do `RevisaoChatPanel` da fábrica.

### Conceito

Chat inline com capacidade de **marcar produto, item do checklist ou documento** em cada mensagem — criando contexto de tratativa. Mensagens da China ficam à esquerda (vermelho), Brasil à direita (azul). Inclui replies, menções @, read receipts e lifecycle (aberto/finalizado).

### Banco de Dados (migration)

**Tabela `china_chat_mensagens`:**

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| submissao_id | uuid FK → china_produto_submissoes | Vínculo com submissão |
| usuario_id | uuid | Autor |
| usuario_nome | text | Cache do nome |
| conteudo | text | Texto da mensagem |
| tipo | text | "china" ou "brasil" (lado do remetente) |
| ref_tipo | text nullable | "produto", "checklist", "documento" |
| ref_id | text nullable | ID do item referenciado |
| ref_label | text nullable | Label legível do item marcado |
| resposta_a_id | uuid nullable self-ref | Reply |
| mencoes | jsonb [] | Menções @ |
| lida_por | jsonb [] | Read receipts |
| anexos | jsonb [] | Arquivos anexos |
| created_at | timestamptz | |

- RLS: authenticated pode SELECT e INSERT
- Realtime habilitado

**Coluna `chat_status` em `china_produto_submissoes`:**
- `chat_status text default 'aberto'`

### Componente `ChinaChatPanel.tsx`

Baseado no `RevisaoChatPanel` da fábrica, adaptado para o contexto China:

- **Seletor de referência**: Dropdown para marcar "Produto", um item do checklist (categoria + tipo) ou um documento específico da submissão
- **Bubbles**: China (esquerda, fundo vermelho/coral) vs Brasil (direita, fundo azul) — determinado pelo `useChinaUserContext`
- **Badges de referência**: Cada mensagem com ref mostra badge clicável com ícone + label do item marcado
- **Reply, menções @, read receipts**: Mesma lógica do chat da fábrica
- **Realtime**: Subscribe em `china_chat_mensagens` filtrado por `submissao_id`
- **Finalizar/Reabrir**: Controle de lifecycle do chat

### Integração na `ChinaFichaProduto.tsx`

Adicionar aba/seção "Chat 聊天" com o `ChinaChatPanel`, passando:
- `submissaoId`
- Lista de documentos (para seletor de referência)
- Lista de categorias do checklist (para seletor de referência)
- `tipoRemetente` baseado em `useChinaUserContext`

### Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `china_chat_mensagens` + coluna `chat_status` |
| `src/components/china/ChinaChatPanel.tsx` | Novo componente (baseado no RevisaoChatPanel) |
| `src/pages/ChinaFichaProduto.tsx` | Integrar o ChinaChatPanel na ficha |

