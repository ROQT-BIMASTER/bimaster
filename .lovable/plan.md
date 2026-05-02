## Visão Consolidada de Aprovações — 3 escopos

Hoje o Kanban de aprovações vive **dentro da tarefa** (`TarefaAprovacoesSection`). Falta a visão "para fora" — ninguém consegue ver, sem abrir cada tarefa, o que está pendente para si, para a sua seção ou para o seu projeto.

A proposta cria **três visões consolidadas** alimentadas pelas mesmas tabelas (`fluxo_aprovacao_instancias` + `fluxo_aprovacao_etapa_eventos` + `fluxo_aprovacao_lote_documentos`), sem duplicar dados.

---

### 1. Os três escopos

| Escopo | Quem usa | Pergunta que responde |
|---|---|---|
| **Minhas Aprovações** (pessoal) | Qualquer responsável de etapa | "O que está esperando *eu* revisar/aprovar/encaminhar agora?" |
| **Aprovações da Seção** | Coordenador da seção | "Quais lotes da minha seção estão em curso, atrasados, parados?" |
| **Aprovações do Projeto** | Líder do projeto / admin | "Quadro geral de todas as aprovações do projeto, por seção e por etapa." |

Todas as três telas compartilham os mesmos cards/filtros/ações — muda só o **filtro de escopo** e o **agrupamento padrão**.

---

### 2. Onde aparece na navegação

```text
Central de Trabalho (Ctrl+J)
└── nova aba "Aprovações"           ← visão pessoal, fila do dia

Projeto › menu lateral
├── Tarefas
├── Aprovações                       ← novo: visão do projeto inteiro
└── Configurações

Tarefa (detalhe)
└── seção "Aprovações"               ← já existe, sem mudança

Seção (header da seção dentro do projeto)
└── botão "Ver aprovações da seção"  ← abre /projeto/:id/aprovacoes?secao=...
```

A página antiga `CentralAprovacoes` (que usa `CentralTrabalhoModulo` legado) é **substituída** pela nova visão pessoal — mesma rota `/dashboard/central/aprovacoes`.

---

### 3. Layout (igual nos 3 escopos)

```text
┌─────────────────────────────────────────────────────────────┐
│  KPIs                                                        │
│  [Pendentes p/ mim: 7]  [Atrasadas: 2]  [Hoje: 3]  [SLA 92%]│
├─────────────────────────────────────────────────────────────┤
│  Filtros: [Projeto ▼] [Seção ▼] [Etapa ▼] [Status ▼] [Busca]│
│  Visualização: ( ) Lista  (•) Kanban por etapa  ( ) Calendário│
├─────────────────────────────────────────────────────────────┤
│  KANBAN consolidado (colunas = etapas do template)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Revisão  │ │ Aprovação│ │ Ajustes  │ │ Concluído│       │
│  │  (3)     │ │   (2)    │ │   (1)    │ │   (12)   │       │
│  │ ┌──────┐ │ │ ┌──────┐ │ │          │ │          │       │
│  │ │ Lote │ │ │ │ Lote │ │ │          │ │          │       │
│  │ │ Proj │ │ │ │ Proj │ │ │          │ │          │       │
│  │ │ R2   │ │ │ │ R1   │ │ │          │ │          │       │
│  │ │ 2d   │ │ │ │ ⚠ 1d │ │ │          │ │          │       │
│  │ └──────┘ │ │ └──────┘ │ │          │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

**Card consolidado** (componente `LoteAprovacaoCardCompacto`, novo):
- Nome do lote + breadcrumb `Projeto › Seção › Tarefa`
- Etapa atual + rodada (R1/R2/R3)
- SLA: dias restantes / atrasado em vermelho
- Avatar do responsável
- Ações inline: **Aprovar**, **Reprovar**, **Abrir tarefa**

Clicar no card abre um **drawer lateral** com o mesmo `LoteAprovacaoCard` completo já existente (preview de documentos, histórico de eventos, comentários, botões de decisão). Não duplica componente.

---

### 4. Detalhes técnicos

**Backend (1 migration):**
- View `vw_aprovacoes_consolidado` agregando:
  - `fluxo_aprovacao_instancias` (lote)
  - última linha de `fluxo_aprovacao_etapa_eventos` (etapa atual + responsável + prazo)
  - join com `projeto_tarefas`, `projeto_secoes`, `projetos` para breadcrumb
  - cálculo de `dias_restantes` e flag `atrasado`
- RPC `rpc_aprovacoes_pendentes_para(_user_id uuid)` — retorna lotes onde a etapa atual aberta tem `responsavel_id = _user_id` (inclui suplente).
- RLS: já coberta pela RLS das tabelas-base (membros do projeto + admins). Sem policy nova.
- Performance: índice composto `(status, etapa_atual_ordem)` em `fluxo_aprovacao_instancias` e `(responsavel_id, concluido_em)` em `fluxo_aprovacao_etapa_eventos`.

**Frontend:**
- Hook único `useAprovacoesConsolidado({ escopo: 'pessoal'|'secao'|'projeto', id? })` consumindo a view via TanStack Query, com Realtime subscription nas duas tabelas para atualizar contadores.
- Componente `<AprovacoesDashboard escopo=... />` reutilizado nas 3 telas.
- Páginas novas:
  - `src/pages/CentralAprovacoes.tsx` (rewrite — pessoal)
  - `src/pages/projetos/ProjetoAprovacoes.tsx` (escopo projeto, com filtro de seção opcional via querystring)
- Card compacto novo: `src/components/projetos/aprovacoes/LoteAprovacaoCardCompacto.tsx`
- Drawer wrapper: reusa `LoteAprovacaoCard` existente.

**Sem mudança nos fluxos existentes:**
- Criação de lote, RPCs `rpc_avancar_etapa_aprovacao`, `rpc_criar_lote_aprovacao` continuam idênticos.
- A seção dentro da tarefa não muda.

---

### 5. Entregáveis

1. Migration: view `vw_aprovacoes_consolidado` + RPC `rpc_aprovacoes_pendentes_para` + 2 índices.
2. Hook `useAprovacoesConsolidado` + tipos.
3. Componentes: `AprovacoesDashboard`, `LoteAprovacaoCardCompacto`, `LoteAprovacaoDrawer`.
4. Rewrite de `CentralAprovacoes.tsx` (visão pessoal).
5. Nova página `ProjetoAprovacoes.tsx` + rota `/dashboard/projetos/:id/aprovacoes`.
6. Item "Aprovações" no menu lateral do projeto + entrada na Central de Trabalho.
7. Bump `APP_VERSION` → 3.4.79 + entrada no changelog em `ApiDocumentation.tsx`.
8. Atualizar memória `mem://features/projects/kanban-alcadas-aprovacao` com a camada de visualização consolidada.

---

### 6. Fora de escopo

- Notificações por email/push de pendências (fica para iteração seguinte).
- Delegação de aprovação para outro usuário (já temos suplente — basta usar).
- Relatórios/export PDF da fila de aprovações.