

## Painel Unificado de Aprovação e Acompanhamento Brasil ↔ China

### Problema

Atualmente os painéis de revisão (`ChinaRevisaoPanel` e `ChinaRevisaoFeedback`) são componentes separados e básicos. Falta:
- Visão unificada onde a China acompanha o que enviou ao Brasil E o que recebeu do Brasil
- Registro de quem fez cada ação (aceitar, contestar, aprovar, rejeitar)
- Interface sofisticada dividida visualmente entre os dois fluxos
- Funcionalidade de "dar ciência" (acknowledge) nos itens recebidos do Brasil

### Solução

Criar um novo componente **`ChinaPainelAprovacao`** — uma tela full-screen (estilo Focus Mode) com layout de duas colunas divididas por fluxo, com timeline de ações e registro de autoria.

### Layout Visual

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Painel de Aprovação — [Produto Nome]         [Progresso] [Fechar]  │
├──────────────────────────┬───────────────────────────────────────────┤
│                          │                                          │
│  ▲ CHINA → BRASIL        │  ▼ BRASIL → CHINA                       │
│  (azul, o que enviamos)  │  (verde, o que recebemos)                │
│                          │                                          │
│  ┌─ Dados Oficiais ────┐ │  ┌─ Etiquetas ──────────┐               │
│  │ Planilha Excel      │ │  │ Etiq. Fundo          │               │
│  │ ✓ Aprovado pelo BR  │ │  │ ⏳ Aguardando ciência │               │
│  │ Por: João 14/03 10h │ │  │ [Aceitar] [Contestar]│               │
│  └─────────────────────┘ │  └──────────────────────┘               │
│                          │                                          │
│  ┌─ Rotulagem ─────────┐ │  ┌─ Códigos EAN ────────┐               │
│  │ Volumetria          │ │  │ EAN Unitário         │               │
│  │ ✗ Rejeitado         │ │  │ ✓ Aceito pela China  │               │
│  │ Motivo: dados errad │ │  │ Por: Li Wei 14/03    │               │
│  │ [Corrigir][Contest] │ │  └──────────────────────┘               │
│  └─────────────────────┘ │                                          │
│                          │                                          │
├──────────────────────────┴───────────────────────────────────────────┤
│  Timeline de Ações (últimas ações com avatar, nome, data, ação)     │
└──────────────────────────────────────────────────────────────────────┘
```

### Funcionalidades por Papel

**Visão China:**
- Coluna esquerda (China → Brasil): Acompanhar status do que enviou (aprovado/rejeitado/pendente), corrigir ou contestar rejeitados
- Coluna direita (Brasil → China): Visualizar itens recebidos, dar "Ciência ✓" (aceitar) ou "Contestar" com justificativa

**Visão Brasil:**
- Coluna esquerda (China → Brasil): Aprovar ou rejeitar documentos com anotações estruturadas
- Coluna direita (Brasil → China): Ver status dos itens que enviou e se a China deu ciência

### Database

Adicionar campos à tabela `china_doc_revisoes` para registrar ciência:

```sql
ALTER TABLE china_doc_revisoes 
  ADD COLUMN IF NOT EXISTS acao_tipo TEXT,
  ADD COLUMN IF NOT EXISTS acao_por_nome TEXT;

-- Update check constraint to include 'ciencia'
ALTER TABLE china_doc_revisoes DROP CONSTRAINT IF EXISTS china_doc_revisoes_resultado_check;
ALTER TABLE china_doc_revisoes ADD CONSTRAINT china_doc_revisoes_resultado_check 
  CHECK (resultado IN ('aprovado','rejeitado','contestado','ciencia'));
```

O campo `acao_tipo` registra a ação específica (`aprovar`, `rejeitar`, `contestar`, `ciencia`, `reenviar`).
O campo `acao_por_nome` armazena o nome do usuário para exibição na timeline sem necessidade de join.

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/china/ChinaPainelAprovacao.tsx` | **Novo** — Componente principal full-screen com duas colunas |
| `src/components/china/ChinaAprovacaoTimeline.tsx` | **Novo** — Timeline de ações na parte inferior |
| `src/components/china/ChinaDocCard.tsx` | **Novo** — Card reutilizável para cada documento com ações contextuais |
| `src/hooks/useChinaRevisoes.ts` | **Editar** — Adicionar mutation `useDarCiencia` e incluir nome do usuário nas ações |
| `src/pages/ChinaFichaProduto.tsx` | **Editar** — Substituir `ChinaRevisaoPanel` + `ChinaRevisaoFeedback` pelo novo `ChinaPainelAprovacao` |

### Componente `ChinaDocCard`

Card individual para cada documento com:
- Ícone + nome PT/CN do tipo de documento
- Badge de status colorido
- Nome do arquivo (se existir)
- Última ação: "Aprovado por João em 14/03 às 10h" ou "Rejeitado — motivo"
- Lista de anotações de erro (se rejeitado)
- Botões de ação contextuais conforme papel e status:
  - Brasil vendo pendente: `[Aprovar ✓]` `[Rejeitar ✗]`
  - China vendo rejeitado: `[Corrigir e Reenviar]` `[Contestar]`
  - China vendo item do Brasil pendente: `[Aceitar / Ciência ✓]` `[Contestar]`
  - Brasil vendo contestação: `[Aceitar Contestação]` `[Manter Rejeição]`

### Timeline de Ações

Componente inferior que lista todas as revisões ordenadas por data:
```
🟢 João Silva aprovou "Planilha Excel" — 14/03 10:32
🔴 Maria Santos rejeitou "Volumetria" — Dados incorretos — 14/03 09:15  
🟡 Li Wei contestou "Volumetria" — "Os dados estão corretos conforme..." — 14/03 11:00
✓  Li Wei deu ciência em "Etiqueta de Fundo" — 14/03 11:15
```

### Fluxo de Ciência (Novo)

Quando o Brasil envia um item (etiqueta, EAN, arte), a China precisa dar ciência:
1. Item chega com status `pendente`
2. China clica "Aceitar / Dar Ciência" → cria revisão com `resultado: 'ciencia'`, registra `acao_por_nome`
3. Ou China clica "Contestar" → cria revisão com `resultado: 'contestado'` + justificativa
4. Brasil vê na timeline e pode responder

