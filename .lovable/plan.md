

# Anexos e Chat Inline no Painel de Detalhe de "Minhas Tarefas"

## Objetivo

Adicionar ao painel lateral `MinhasTarefaDetail` (Sheet que aparece ao clicar numa tarefa em Minhas Tarefas) duas funcionalidades que já existem no detalhe completo do projeto: **upload/gestão de anexos** e **chat inline com mensagens**.

## Contexto

As tabelas `projeto_tarefa_anexos` e `projeto_tarefa_messages` já existem no banco. O hook `useProjetoTarefaDetalhe.ts` já implementa queries e mutations para ambas. O componente `TarefaAnexosSection` e `TarefaChatPanel` já existem como componentes reutilizáveis.

## Implementação

### 1. Hook simplificado para o painel de Minhas Tarefas

Criar `src/hooks/useMinhasTarefaDetalhe.ts` com:
- Query de anexos (`projeto_tarefa_anexos` filtrado por `tarefa_id`)
- Mutation de upload (storage bucket + insert)
- Mutation de delete anexo
- Query de mensagens (`projeto_tarefa_messages` filtrado por `tarefa_id`, join com profiles para autor)
- Mutation de envio de mensagem
- Função `getAnexoUrl` para download
- Query de membros do projeto (para mentions no chat)

Reutiliza a mesma lógica de `useProjetoTarefaDetalhe` mas isolada para ser chamada apenas quando o painel abre.

### 2. Atualizar `MinhasTarefaDetail.tsx`

Expandir o Sheet para incluir, abaixo do botão "Salvar alterações":

- **Seção de Anexos**: Botão de upload + lista de arquivos anexados, usando o componente `TarefaAnexosSection` existente (versão simplificada sem cofre)
- **Seção de Chat Inline**: Lista de mensagens + input de envio, embutido diretamente no painel (não como sidebar lateral como no detalhe completo). Renderizar mensagens com bolhas simples e input com MentionInput na base.

Layout do Sheet:
```text
┌─────────────────────────┐
│ Módulo: Fábrica Brasil  │
│ [Título editável]       │
│ Status | Prioridade     │
│ Prazo                   │
│ Observações             │
│ [Salvar] [Abrir projeto]│
├─────────────────────────┤
│ 📎 Anexos (2)           │
│  arquivo1.pdf  [⬇][🗑] │
│  foto.png      [⬇][🗑] │
│  [+ Anexar arquivo]     │
├─────────────────────────┤
│ 💬 Chat                 │
│  Maria: Bom dia...      │
│  João: Pronto!          │
│  [Digite sua mensagem]  │
└─────────────────────────┘
```

### 3. Componente de Anexos Simplificado

Criar `src/components/minhas-tarefas/MinhasTarefaAnexos.tsx` — versão compacta do `TarefaAnexosSection` sem a funcionalidade de cofre (que é específica do detalhe de projeto). Apenas: upload, lista, download, delete.

### 4. Componente de Chat Inline

Criar `src/components/minhas-tarefas/MinhasTarefaChat.tsx` — chat embutido (não lateral) com:
- ScrollArea com mensagens
- Bolhas com avatar, nome, hora
- Input de mensagem com suporte a @menções
- Auto-scroll ao receber mensagem

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/hooks/useMinhasTarefaDetalhe.ts` | Novo — queries/mutations para anexos e mensagens |
| `src/components/minhas-tarefas/MinhasTarefaAnexos.tsx` | Novo — seção compacta de anexos |
| `src/components/minhas-tarefas/MinhasTarefaChat.tsx` | Novo — chat inline embutido |
| `src/components/minhas-tarefas/MinhasTarefaDetail.tsx` | Integrar anexos e chat no Sheet |

