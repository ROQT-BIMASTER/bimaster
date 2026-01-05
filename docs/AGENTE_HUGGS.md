# 🤖 Agente Huggs - Documentação Completa

## Visão Geral

O **Agente Huggs** é um assistente de análise de dados empresariais integrado ao sistema, conectado ao n8n via MCP (Model Context Protocol). Ele permite que usuários façam perguntas em linguagem natural sobre dados da empresa e recebam respostas inteligentes, relatórios e visualizações.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA HUGGS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Frontend    │───▶│ Edge Function│───▶│  Lovable AI  │  │
│  │  (React)     │    │  (Deno)      │    │  Gateway     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│         ▼                   ▼                    ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Supabase    │◀───│   n8n MCP    │───▶│ Gemini 2.5   │  │
│  │  Database    │    │  Workflow    │    │   Flash      │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Estrutura do Banco de Dados

### Tabelas Criadas

| Tabela | Descrição |
|--------|-----------|
| `huggs_agent_config` | Configurações do agente (prompt, modelo, etc.) |
| `huggs_chat_sessions` | Sessões de conversa por usuário |
| `huggs_chat_messages` | Mensagens individuais de cada sessão |
| `huggs_reports` | Relatórios gerados pelo agente |
| `huggs_charts` | Gráficos e visualizações gerados |
| `huggs_feedback` | Feedback dos usuários sobre respostas |
| `huggs_usage_logs` | Logs de uso para analytics |

### Políticas RLS

Todas as tabelas possuem Row Level Security configurado:
- Usuários só veem seus próprios dados
- Admins/Supervisores podem gerenciar configurações
- Sistema pode inserir logs de uso

---

## ⚙️ Configurações Necessárias

### 1. n8n - Workflow

O workflow **"Agente de Atendimento Huggs"** já está configurado no n8n com:

| Componente | Função |
|------------|--------|
| Chat Trigger | Recebe mensagens do chat |
| AI Consultant Agent | Agente principal com IA |
| OpenAI Chat Model | GPT-4.1-mini (via n8n) |
| Simple Memory | Histórico de conversa |
| Generate Report Tool | Gera relatórios estruturados |
| Generate Chart Tool | Cria visualizações |
| Lovable MCP Tools | Acessa dados do sistema |

#### Configurar MCP no n8n

1. Acesse **Settings → MCP access** no n8n
2. Ative **Enable MCP access**
3. Copie a URL MCP (já configurada: `https://huggs.app.n8n.cloud`)
4. Para cada workflow que deseja expor:
   - Abra o workflow
   - Vá em **Settings**
   - Ative **Available in MCP**

### 2. Lovable AI

O sistema usa **Lovable AI Gateway** que já está configurado automaticamente:
- Modelo: `google/gemini-2.5-flash`
- API Key: `LOVABLE_API_KEY` (automática)
- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`

### 3. Edge Function

A edge function `huggs-agent-chat` está configurada em:
```
supabase/functions/huggs-agent-chat/index.ts
```

Com `verify_jwt = true` para autenticação.

---

## 🎨 Componentes Frontend

### HuggsChat
```typescript
import { HuggsChat } from '@/components/huggs/HuggsChat';

// Uso básico
<HuggsChat />

// Com departamento específico
<HuggsChat department="Financeiro" />

// Embedded (sem borda)
<HuggsChat embedded={true} />
```

### HuggsAgentConfig
```typescript
import { HuggsAgentConfig } from '@/components/huggs/HuggsAgentConfig';

// Somente para admins
<HuggsAgentConfig />
```

### Hook useHuggsAgent
```typescript
import { useHuggsAgent } from '@/hooks/useHuggsAgent';

const {
  messages,           // Lista de mensagens
  sessions,           // Histórico de sessões
  currentSession,     // Sessão atual
  config,             // Configurações do agente
  isLoading,          // Estado de carregamento
  isStreaming,        // Streaming ativo
  sendMessage,        // Enviar mensagem
  startNewSession,    // Nova conversa
  loadSession,        // Carregar sessão existente
  submitFeedback,     // Enviar feedback
} = useHuggsAgent();
```

---

## 🚀 Acesso

O Agente Huggs está disponível em:
- **URL**: `/dashboard/agente-huggs`
- **Menu**: Dashboard → Ferramentas → Agente Huggs

---

## 📝 Exemplos de Uso

### Perguntas que o Agente pode responder:

1. **Análise de Dados**
   - "Qual foi o faturamento do último mês?"
   - "Compare as vendas entre departamentos"
   - "Mostre a evolução de receitas trimestrais"

2. **Relatórios**
   - "Gere um relatório de vendas do Q4"
   - "Crie um resumo executivo financeiro"
   - "Liste os top 10 clientes"

3. **Visualizações**
   - "Crie um gráfico de vendas por região"
   - "Mostre a distribuição de despesas"
   - "Faça um dashboard de KPIs"

4. **Insights**
   - "Quais são as tendências de mercado?"
   - "Identifique oportunidades de melhoria"
   - "O que está impactando negativamente?"

---

## 🔧 Troubleshooting

### Erro: "Agente desativado"
- Verifique se `is_active = true` na tabela `huggs_agent_config`

### Erro: "LOVABLE_API_KEY não configurada"
- A chave é automática em projetos Lovable Cloud
- Verifique se o projeto está conectado ao Cloud

### Erro: "Rate limit excedido"
- Aguarde alguns segundos e tente novamente
- Considere upgrade do plano Lovable se frequente

### Mensagens não aparecem
- Verifique se há sessão ativa
- Confirme que RLS está permitindo acesso

---

## 📈 Métricas e Analytics

O sistema registra automaticamente:
- Total de sessões por usuário
- Número de mensagens trocadas
- Tempo médio de resposta
- Tokens consumidos
- Taxa de sucesso/erro

Acessível em: **Agente Huggs → Configurações** (admin only)

---

## 🔒 Segurança

- Autenticação JWT obrigatória
- RLS em todas as tabelas
- Usuários só acessam próprios dados
- Configurações restritas a admins
- Logs de auditoria completos

---

## 📚 Referências

- [Documentação n8n MCP](https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/)
- [Lovable AI Gateway](https://docs.lovable.dev/features/ai)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
