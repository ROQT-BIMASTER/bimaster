

## Módulo Meeting Intelligence — Plano de Implementação

### Visão Geral

Novo módulo completo para gravação, transcrição e análise inteligente de reuniões, com painel de riscos por departamento e notificações automáticas para gestores.

---

### Banco de Dados (5 tabelas + 1 enum + 1 bucket)

**Enum:** `meeting_risk_level` (low, medium, high, critical)

**Tabelas:**

| Tabela | Função |
|--------|--------|
| `meetings` | Reunião principal (title, date, duration, audio_url, transcription, summary, status, created_by) |
| `meeting_participants` | Participantes vinculados à reunião (user_id, role: host/participant) |
| `meeting_insights` | Itens extraídos pela IA (type: risco/oportunidade/decisão/bloqueio, description, department, impact_level, urgency_level) |
| `meeting_tasks` | Tarefas geradas pela IA (task, department, responsible_user_id, priority, deadline, status) |
| `meeting_risks` | Riscos classificados (title, description, department, risk_level, impact_level, urgency_level, responsible_user_id, status: open/in_progress/resolved) |

**Storage:** Bucket `meeting-recordings` (privado) para áudios gravados.

**RLS:** Todos protegidos por `authenticated` + filtro por `created_by` ou participação na reunião. Admin/supervisor veem tudo.

---

### Edge Functions (3 funções)

**1. `meeting-transcribe`**
- Recebe audio_url do storage
- Usa Lovable AI Gateway (Gemini) para transcrição via descrição de áudio
- OU integra com API de Speech-to-Text (Whisper via gateway)
- Salva transcrição na tabela `meetings`

**2. `meeting-analyze`**
- Recebe transcrição da reunião
- Usa Lovable AI Gateway (Gemini 2.5 Pro) com prompt estruturado
- Extrai via tool calling: resumo, problemas, oportunidades, decisões, tarefas, riscos
- Classifica por departamento automaticamente
- Salva em `meeting_insights`, `meeting_tasks`, `meeting_risks`

**3. `meeting-risk-alerts`**
- Triggered após análise completa
- Consulta riscos HIGH/CRITICAL por departamento
- Envia notificação in-app via tabela `notifications` existente
- Pode expandir para email/Slack futuramente

---

### Frontend — Páginas e Componentes

**Páginas:**

| Rota | Página | Descrição |
|------|--------|-----------|
| `/dashboard/reunioes` | `Reunioes.tsx` | Landing page do módulo com lista de reuniões |
| `/dashboard/reunioes/:id` | `ReuniaoDetalhe.tsx` | Detalhe: transcrição, insights, mapa mental, tarefas |
| `/dashboard/reunioes/riscos` | `ReuniaoRiscos.tsx` | Painel de riscos por departamento |

**Componentes principais:**

1. **`MeetingRecorder`** — Gravação via MediaRecorder API (reutiliza padrões do `RealtimeAudioCall.ts` existente). Botão gravar/pausar/parar + timer + upload automático para storage.

2. **`MeetingTranscript`** — Exibição da transcrição com timestamps e identificação de falantes (diarização).

3. **`MeetingInsightsPanel`** — Cards com resumo executivo, problemas, oportunidades, decisões extraídas pela IA.

4. **`MeetingMindMap`** — Mapa mental renderizado com Mermaid.js (já usado no projeto via `lov-mermaid`). IA gera a sintaxe Mermaid automaticamente.

5. **`MeetingTasksList`** — Lista de tarefas geradas com departamento, responsável, prazo. Botão para converter em tarefa real no módulo de Projetos.

6. **`RisksDashboard`** — Painel executivo com:
   - KPIs: riscos críticos abertos, % resolvidos, índice de risco organizacional
   - Gráfico de riscos por departamento (Recharts, bar chart)
   - Tabela filtrável por departamento/nível/status
   - Timeline de reuniões com riscos

7. **`RiskCard`** — Card individual de risco com nível visual (cores), departamento, ação recomendada, status.

8. **`OrganizationalRiskIndex`** — Gauge/score 0-100 calculado com base em riscos abertos, criticidade e tempo de resolução.

---

### Fluxo do Usuário

```text
1. Usuário acessa "Reuniões" no menu
2. Clica "Nova Reunião" → abre gravador
3. Grava a reunião (MediaRecorder API)
4. Ao parar → upload automático para storage
5. Clica "Analisar com IA"
6. Edge function transcreve + analisa
7. Tela de detalhe mostra:
   - Transcrição completa
   - Resumo executivo
   - Mapa mental (Mermaid)
   - Tarefas extraídas
   - Riscos identificados
8. Riscos ALTO/CRÍTICO → notificação para gestor
9. Painel de Riscos consolida tudo
```

---

### Integração com Sistema Existente

- **Menu lateral:** Nova seção "Reuniões" com ícone Mic
- **Rotas:** Protegidas por `ModuleProtectedRoute` com moduleCode `reunioes`
- **Projetos:** Tarefas de reunião podem ser convertidas em tarefas de projeto
- **Departamentos:** Usa os departamentos já existentes no sistema para classificação
- **Notificações:** Usa o sistema de notificações existente (`notifications` table)

---

### Implementação em Fases

**Fase 1 (esta sessão):**
- Tabelas + bucket + RLS
- Gravação de áudio (MediaRecorder)
- Upload para storage
- Edge function `meeting-analyze` (transcrição + análise com Gemini)
- Página de listagem + detalhe
- Mapa mental com Mermaid

**Fase 2 (próxima sessão):**
- Painel de Riscos por departamento
- Índice de risco organizacional
- Notificações automáticas para gestores
- Conversão de tarefas para módulo de Projetos

**Fase 3 (futura):**
- Detecção de assuntos recorrentes entre reuniões
- Radar estratégico (tendências)
- Upload de áudio externo (reuniões Zoom/Meet)
- Integração com calendário

