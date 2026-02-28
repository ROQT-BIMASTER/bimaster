

# Plano: Chat Profissional com Reply, Menções e Finalização

## Problema
O chat atual é linear e básico. Faltam: responder mensagens específicas (reply), mencionar usuários (@), finalizar conversas, e status de conversa (aberta/finalizada).

---

## 1. Migração do Banco de Dados

Adicionar colunas à tabela `fabrica_revisao_mensagens`:
- `resposta_a_id` (uuid, FK para si mesma) — referência à mensagem respondida (reply)
- `mencoes` (jsonb, default '[]') — array de `{user_id, nome}` mencionados
- `status_conversa` na tabela `fabrica_ficha_custo_revisoes`:
  - `chat_status` (text, default 'aberto') — valores: 'aberto', 'finalizado'
  - `chat_finalizado_por` (uuid) — quem finalizou
  - `chat_finalizado_em` (timestamptz) — quando finalizou

---

## 2. Refatorar `RevisaoChatPanel.tsx` — Estilo WhatsApp

### Reply (Responder mensagem)
- Ao clicar/segurar uma mensagem, aparece botão "Responder"
- Ao ativar, mostra preview da mensagem sendo respondida acima do input (com X para cancelar)
- Na mensagem renderizada, exibe box citado com nome + texto truncado da mensagem original
- Grava `resposta_a_id` no insert

### Menções (@usuário)
- Ao digitar `@` no textarea, abre um popover/dropdown com lista de usuários da fábrica (busca na tabela `profiles`)
- Ao selecionar, insere `@NomeUsuário` no texto e grava no campo `mencoes`
- Na renderização, destaca `@NomeUsuário` com cor diferente (bold, azul)

### Finalizar conversa
- Botão "Finalizar Conversa" no header do chat (visível para diretoria)
- Ao finalizar: atualiza `chat_status = 'finalizado'` na revisão
- Chat finalizado fica em modo readonly com banner informativo
- Botão "Reabrir" para diretoria se necessário

### UI melhorada
- Avatar com iniciais ao lado de cada mensagem (como WhatsApp)
- Mensagens próprias à direita (azul), de outros à esquerda (cinza)
- Timestamp + status de leitura (checks) por mensagem
- Hover em mensagem mostra ações rápidas (responder)

---

## 3. Refatorar `RevisaoChatConsolidado.tsx`

- Adicionar filtro por status da conversa: "Abertas" | "Finalizadas" | "Todas"
- Na lista, mostrar badge de status (Aberta/Finalizada)
- Conversas finalizadas ficam esmaecidas na lista
- Botão de finalizar diretamente da lista (sem abrir a conversa)

---

## Resumo de Entregas

| Entrega | Tipo |
|---|---|
| Colunas `resposta_a_id`, `mencoes` na mensagens | Migração DB |
| Colunas `chat_status`, `chat_finalizado_por/em` na revisões | Migração DB |
| Reply com preview e citação visual | UI (RevisaoChatPanel) |
| Menções @usuário com autocomplete | UI (RevisaoChatPanel) |
| Finalizar/Reabrir conversa | UI + DB |
| Filtro aberta/finalizada no consolidado | UI (RevisaoChatConsolidado) |
| Avatar + checks de leitura | UI (RevisaoChatPanel) |

---

## Detalhes Técnicos

- **Profiles query**: `SELECT id, nome FROM profiles WHERE aprovado = true` para o autocomplete de menções
- **Reply**: FK `fabrica_revisao_mensagens(resposta_a_id) REFERENCES fabrica_revisao_mensagens(id)`
- **Menções**: JSON array `[{"user_id": "...", "nome": "..."}]` — permite notificação futura
- **Regex render**: `/@(\w+\s?\w*)/g` para highlight de menções no texto
- **Finalização**: Apenas tipo `diretoria` pode finalizar; campo `chat_status` controla readonly

