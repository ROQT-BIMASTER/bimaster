

# CRM Omnichannel - Evolucao do Kanban de Leads

## Visao Geral

Transformar o Kanban de Prospects atual em um CRM Omnichannel completo, adicionando um modal detalhado com abas, central de demandas internas, e automacoes ao mover cards.

## O que ja existe (aproveitado)

- Kanban com drag-and-drop funcional (6 colunas de status)
- Tabela `prospects` rica (50+ campos incluindo CNPJ, redes sociais, scores)
- Tabela `atividades` vinculada a prospects
- Sistema de chat interno (`conversas` + `mensagens`)
- Componente `ProspectDetailDialog` (formulario simples de edicao)
- Autenticacao e RLS configurados

## O que sera construido

### Fase 1 - Modal de Lead com 4 Abas

Substituir o `ProspectDetailDialog` atual por um modal fullscreen com abas:

**Aba 1 - Resumo IA e Dados**
- Campos de qualificacao do prospect (dados ja existentes: porte, CNAE, score, faturamento)
- Campo "Insight da IA" gerado via Lovable AI (edge function) que analisa historico de atividades e dados do lead para gerar um resumo do momento atual
- Cards visuais com metricas: dias sem contato, quantidade de atividades, score de propensao

**Aba 2 - Subtarefas Dinamicas**
- Nova tabela `lead_subtasks` (prospect_id, titulo, responsavel_id, checklist JSONB, data_entrega, concluida)
- Interface de checklist com barra de progresso percentual
- Cada subtarefa pode ter sub-itens (checklist interno em JSONB)
- Atribuicao de responsavel por subtarefa

**Aba 3 - Historico de WhatsApp (Simulado)**
- Nova tabela `lead_messages` (prospect_id, tipo: text/audio/image, conteudo, direcao: inbound/outbound, created_at)
- Interface visual identica ao WhatsApp (baloes verdes/brancos, timestamps)
- Suporte visual a audios (player simulado), imagens e textos
- Dados mock iniciais para demonstracao

**Aba 4 - Log de Acompanhamento (Auditoria)**
- Nova tabela `lead_activity_logs` (prospect_id, user_id, acao, detalhes, created_at)
- Linha do tempo vertical com icones por tipo de evento
- Registro automatico ao mover card no Kanban, concluir subtarefa, etc.

### Fase 2 - Central de Demandas Internas

- Nova tabela `internal_tickets` (titulo, descricao, prospect_id nullable, prioridade, status, responsavel_id, criado_por)
- Pagina dedicada com lista/kanban de tickets
- Vinculo opcional com lead (campo "Vinculo com Lead")
- Efeito visual "glow" para tickets urgentes (animacao CSS)

### Fase 3 - Automacao Kanban -> Demandas

- Ao mover card para "Ganho" (coluna fechado), criar automaticamente um ticket interno para Onboarding
- Logica no `handleDragEnd` do KanbanBoard
- Registro no log de auditoria

## Detalhes Tecnicos

### Novas tabelas (migration SQL)

```text
lead_subtasks
  - id (uuid PK)
  - prospect_id (FK prospects)
  - titulo (text)
  - responsavel_id (FK profiles)
  - checklist (jsonb) -- [{item: "...", done: bool}]
  - data_entrega (date)
  - concluida (boolean default false)
  - created_at, updated_at

lead_messages
  - id (uuid PK)
  - prospect_id (FK prospects)
  - tipo (text: 'text','audio','image')
  - conteudo (text)
  - direcao (text: 'inbound','outbound')
  - remetente_nome (text)
  - created_at

lead_activity_logs
  - id (uuid PK)
  - prospect_id (FK prospects)
  - user_id (FK profiles)
  - acao (text)
  - detalhes (text)
  - created_at

internal_tickets
  - id (uuid PK)
  - titulo (text)
  - descricao (text)
  - prospect_id (FK prospects, nullable)
  - prioridade (text: 'baixa','media','alta','urgente')
  - status (text: 'aberto','em_andamento','concluido')
  - responsavel_id (FK profiles)
  - criado_por (FK profiles)
  - created_at, updated_at
```

Todas com RLS habilitado e politicas para authenticated users com `check_user_access`.

### Novos componentes

- `ProspectFullModal.tsx` - Modal fullscreen com Tabs (substitui ProspectDetailDialog)
- `LeadResumoIA.tsx` - Aba 1
- `LeadSubtarefas.tsx` - Aba 2 com checklist e barra de progresso
- `LeadWhatsAppHistory.tsx` - Aba 3 com interface de chat
- `LeadActivityLog.tsx` - Aba 4 com timeline
- `InternalTicketsPage.tsx` - Pagina da Central de Demandas
- `InternalTicketCard.tsx` - Card com glow effect

### Edge Function (IA)

- `lead-insight`: recebe prospect_id, consulta dados + atividades, gera resumo via Lovable AI (gemini-3-flash-preview)

### Dados mock

- Inserir mensagens simuladas de WhatsApp e logs de auditoria para demonstracao visual

### Arquivos modificados

- `KanbanBoard.tsx` - usar novo modal + registrar log + criar ticket automatico ao mover para "ganho"
- `ProspectCard.tsx` - sem alteracoes significativas
- Rotas: adicionar rota para Central de Demandas Internas

### Design

- Estilo limpo inspirado em Linear.app: bordas finas, espacamento generoso, tipografia precisa
- Uso de Shadcn/UI + Tailwind + Lucide Icons (ja instalados)
- Glow effect CSS para urgencias: `animate-pulse` + `ring-2 ring-red-500/50`

