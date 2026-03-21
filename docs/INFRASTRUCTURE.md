# Infraestrutura e Segurança

> **Última atualização:** 2026-03-21 | **Versão:** 2.0.0

---

## 1. Visão Geral

| Métrica | Valor |
|---------|-------|
| Edge Functions | 108 |
| Tabelas | ~453 |
| Views | ~20 |
| Funções PostgreSQL | ~254 |
| Políticas RLS | ~1.252 |
| Páginas React | ~265 |

---

## 2. Edge Functions — Catálogo Completo

### 2.1 Vendas e Sincronização

| Function | Método | Auth | Descrição |
|----------|--------|------|-----------|
| `vendas-union-api` | POST | API Key (x-api-key) | Ingestão de vendas (n8n → Union) |
| `sync-dimensao-vendedores` | POST | JWT | Popula dim_vendedor, dim_supervisor, dim_empresa |
| `estoque-n8n-sync` | POST | API Key | Sincronização de estoque via n8n |
| `estoque-api` | GET/POST | JWT | API de estoque |
| `produtos-api` | GET/POST | API Key | API de produtos |

### 2.2 Finanças (AP/AR/ERP)

| Function | Método | Auth | Descrição |
|----------|--------|------|-----------|
| `contas-pagar-api` | POST | API Key | Ingestão de títulos AP (n8n) |
| `contas-pagar-export-api` | GET | API Key | Exportação AP para ERP (inclui /cancelled) |
| `contas-receber-api` | POST | API Key | Ingestão de títulos AR |
| `n8n-contas-receber` | POST | API Key | Sync AR via n8n |
| `erp-webhook-inbound` | POST | HMAC/API Key | Webhook genérico ERP |
| `erp-export-payment` | POST | API Key | Exportação de pagamentos |
| `erp-fornecedores-query` | GET | API Key | Consulta fornecedores no ERP |
| `erp-portadores-api` | POST | API Key | Sync portadores bancários |
| `erp-plano-contas-api` | POST | API Key | Sync plano de contas |
| `processar-transacao-n8n` | POST | API Key | Processa transações financeiras |
| `auditoria-contas-pagar` | POST | JWT | Auditoria AP |
| `auditoria-contas-receber` | POST | JWT | Auditoria AR |
| `conciliacao-bancaria` | POST | JWT | Conciliação bancária |
| `expense-ai-assistant` | POST | JWT | Assistente IA para despesas |
| `contas-pagar-ai-chat` | POST | JWT | Chat IA para AP |
| `send-department-expense-notification` | POST | JWT | Notificação de despesas |

### 2.3 Classificação IA (DRE)

| Function | Descrição |
|----------|-----------|
| `classificar-categoria-dre` | Classifica categoria DRE |
| `classificar-contas-batch` | Classificação em lote |
| `classificar-contas-pagar-ia` | Classificação IA de AP |
| `classificar-conta-departamento` | Classifica por departamento |
| `analisar-planilha-ia` | Analisa planilhas com IA |
| `ai-map-csv-columns` | Mapeia colunas de CSV com IA |

### 2.4 Fábrica

| Function | Descrição |
|----------|-----------|
| `extrair-materia-prima-ia` | Extrai MPs de documentos via IA |
| `extrair-insumos-imagem` | Extrai insumos de imagens |
| `extrair-produto-ia` | Extrai dados de produto via IA |
| `process-nfe-xml` | Processa XML NF-e |
| `fiscal-iva-api` | Consulta/simulação IVA Dual |

### 2.5 China e Projetos

| Function | Descrição |
|----------|-----------|
| `parse-china-excel` | Processa Excel da China |
| `cofre-share` | Compartilhamento de cofre |
| `gerar-despacho-oficial` | Gera despacho oficial |
| `projeto-ia-assistant` | Assistente IA de projetos |
| `projeto-monitor-atrasos` | Monitor de atrasos |
| `audit-china-vinculo` | Auditoria China ↔ Projeto |
| `audit-produto-tarefa` | Auditoria produto ↔ tarefa |
| `audit-briefing-tarefa` | Auditoria briefings |
| `importar-briefing-ia` | Importa briefing via IA |

### 2.6 Trade Marketing

| Function | Descrição |
|----------|-----------|
| `trade-marketing-api` | API geral de trade |
| `analyze-shelf-photos` | Análise de prateleira |
| `analyze-competitor-photo` | Análise de concorrentes |
| `analyze-gondola-competition` | Competição em gôndola |
| `trigger-photo-queue` | Enfileira análises |
| `process-photo-analysis-queue` | Processa fila |
| `price-table-approval` | Aprovação tabela de preços |

### 2.7 IA e Analytics

| Function | Descrição |
|----------|-----------|
| `ai-analytics` | Analytics com IA |
| `ai-filter` | Filtros inteligentes |
| `ai-insights` | Geração de insights |
| `lead-insight` | Insights de leads |
| `marketing-insights` | Insights de marketing |
| `huggs-agent-chat` | Agente Huggs (chat IA) |
| `qa-agent` | Agente QA |

### 2.8 Geo e CNPJ

| Function | Descrição |
|----------|-----------|
| `geocode-address` | Geocodifica endereço |
| `geocode-batch` | Geocodificação em lote |
| `get-google-maps-key` | Chave Google Maps |
| `get-mapbox-token` | Token Mapbox |
| `google-places-search` | Busca Google Places |
| `ibge-sync` | Sincroniza dados IBGE |
| `opencnpj-consulta` | Consulta CNPJ |
| `cnpjbiz-consulta` | Consulta CNPJ.biz |
| `padronizar-municipio` | Padroniza municípios |
| `padronizar-nome-cliente` | Padroniza nomes |

### 2.9 Social Media e Marketing

| Function | Descrição |
|----------|-----------|
| `social-media-metrics` | Métricas de redes sociais |
| `social-media-cron` | Sync periódico |
| `sync-all-accounts` | Sync todas as contas |
| `publish-scheduled-posts` | Publica posts agendados |
| `analyze-brand-website` | Análise de website |
| `save-brand-analysis` | Salva análise de marca |
| `analyze-whatsapp-sentiment` | Sentimento WhatsApp |

### 2.10 Mídia e Criação

| Function | Descrição |
|----------|-----------|
| `elevenlabs-tts` | Text-to-Speech |
| `elevenlabs-sfx` | Efeitos sonoros |
| `elevenlabs-music` | Música IA |
| `generate-product-creative` | Criativo de produto |
| `generate-video` | Geração de vídeo |
| `nano-banana-video` | Vídeo NanoBanana |
| `pollo-analyze-website` | Análise de website |
| `pollo-check-status` | Status Pollo |
| `pollo-generate-image` | Geração de imagem |
| `pollo-generate-video` | Geração de vídeo |
| `sofia-voice-token` | Token Sofia Voice |

### 2.11 Comunicação

| Function | Descrição |
|----------|-----------|
| `whatsapp-business-api` | API WhatsApp Business |
| `whatsapp-webhook` | Webhook WhatsApp |
| `cobranca-automation-api` | Automação de cobrança |
| `cobranca-whatsapp-webhook` | Webhook cobrança |
| `send-notifications` | Envio de notificações |

### 2.12 Reuniões

| Function | Descrição |
|----------|-----------|
| `meeting-transcribe` | Transcrição de reunião |
| `meeting-analyze` | Análise de reunião |
| `meeting-analyze-phase2` | Análise fase 2 |
| `meeting-search` | Busca em reuniões |
| `realtime-call-session` | Sessão de chamada em tempo real |
| `process-call-result` | Processa resultado de chamada |

### 2.13 Aprovação de Artes e Processos

| Function | Descrição |
|----------|-----------|
| `integration-router` | Roteador de integrações |
| `export-all-data` | Exportação de dados |
| `export-conversion-rates` | Taxas de conversão |
| `export-datawarehouse` | Export DW |
| `export-pdf` | Export PDF |
| `export-prospects` | Export prospects |
| `datawarehouse-api` | API do DW |

### 2.14 Admin e Segurança

| Function | Descrição |
|----------|-----------|
| `admin-reset-password` | Reset de senha admin |
| `update-user-password` | Atualiza senha |
| `create-admin-users` | Cria usuários admin |
| `api-health-check` | Health check de APIs |
| `ddos-shield` | Proteção DDoS |
| `auth-email-hook` | Hook de email de autenticação |
| `seed-demo-data` | Dados de demonstração |
| `team-form-submit` | Formulário de equipe |
| `pluggy-proxy` | Proxy Pluggy |
| `pluggy-webhook` | Webhook Pluggy |

---

## 3. Módulo `_shared` (Edge Functions)

| Arquivo | Descrição |
|---------|-----------|
| `auth.ts` | Validação de auth: `validateAny()` (JWT OU API Key), `validateJWT()`, `validateAPIKey()` |
| `cors.ts` | Headers CORS padrão (`Access-Control-Allow-Origin: *`) |
| `rate-limit.ts` | Rate limiting (100 req/min por chave) |
| `ssrf-guard.ts` | Proteção contra SSRF (bloqueia IPs internos) |
| `timing-safe.ts` | Comparação de strings timing-safe (evita timing attacks) |
| `validate.ts` | Validação de schemas (Zod-like) |
| `error-handler.ts` | Tratamento centralizado de erros |
| `erp-key-validator.ts` | Validação de chaves ERP (multi-padrão) |
| `security-headers.ts` | Headers de segurança HTTP |
| `email-templates/` | Templates de email (HTML) |

### Padrão de Autenticação: `validateAny()`

```typescript
// Aceita JWT OU API Key — usado em funções que atendem tanto frontend quanto n8n
const { user, isApiKey } = await validateAny(req);

if (isApiKey) {
  // Acesso via API Key (n8n, ERP) — opera com service_role
} else {
  // Acesso via JWT — respeita RLS do usuário
}
```

---

## 4. Autenticação e Autorização

### Métodos de Autenticação

| Método | Uso | Validação |
|--------|-----|-----------|
| **JWT** | Frontend (React) | `supabase.auth.getUser()` |
| **API Key** | n8n, ERP, integrações | Header `x-api-key` ou `authorization: Bearer <key>` |
| **HMAC** | Webhooks ERP | Assinatura HMAC-SHA256 no body |
| **MFA TOTP** | Usuários críticos | Segundo fator via app autenticador |

### Account Lockout

```
Tentativas de login falhadas
  ├─ 5 falhas → bloqueio temporário (15 min)
  └─ 10 falhas → bloqueio permanente (admin desbloqueia)
```

### Hierarquia de Roles

```
admin
  └─ Acesso total a todos módulos e telas
       └─ Pode impersonar qualquer usuário

supervisor
  └─ Vê dados de sua equipe (subordinados recursivos)
       └─ Pode aprovar dentro de alçada

vendedor
  └─ Vê apenas seus próprios dados
       └─ CRUD em prospects/atividades

promotor
  └─ Execução de campo (trade)
       └─ Fotos, visitas, medições
```

### RLS — Row Level Security (1.252 políticas)

Padrões de políticas:

```sql
-- Padrão 1: Dados próprios
CREATE POLICY "own_data" ON tabela
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Padrão 2: Hierarquia (supervisor vê equipe)
CREATE POLICY "team_data" ON tabela
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT get_subordinates(auth.uid()))
  );

-- Padrão 3: Admin vê tudo
CREATE POLICY "admin_all" ON tabela
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Padrão 4: Empresa isolada
CREATE POLICY "empresa_isolation" ON tabela
  FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
```

---

## 5. Multi-Empresa

### EmpresaContext

```typescript
// Contexto que gerencia empresa ativa
const { empresaAtiva, setEmpresaAtiva, empresas } = useEmpresa();
```

### Tabela: `user_empresas`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| user_id | uuid | FK → auth.users |
| empresa_id | integer | FK → empresas |
| is_default | boolean | Empresa padrão do usuário |

### Isolamento

Todas as queries financeiras, de estoque e operacionais filtram por `empresa_id` da empresa ativa.

---

## 6. PWA e Offline

### Service Worker (Workbox via vite-plugin-pwa)

```
Estratégias de Cache:
  ├─ CacheFirst → assets estáticos (JS, CSS, imagens)
  ├─ NetworkFirst → API calls (Supabase queries)
  ├─ StaleWhileRevalidate → fontes, ícones
  └─ NetworkOnly → autenticação, mutations
```

### IndexedDB (Offline Database)

```typescript
// offlineDatabase.ts
export const offlineDB = {
  prospects: { table: 'offline_prospects', syncTable: 'prospects' },
  atividades: { table: 'offline_atividades', syncTable: 'atividades' },
  visits: { table: 'offline_visits', syncTable: 'trade_visits' },
};
```

### Sync Queue

```
Operação offline
  └─ Salva em IndexedDB + adiciona à sync queue
       └─ Quando online:
            └─ syncManager processa fila (FIFO)
                 ├─ Sucesso → remove da fila
                 └─ Conflito → detecção e resolução
```

### PWA Features

- **Splash Screen**: Animação de carregamento inicial
- **Install Prompt**: Botão "Instalar App" (`/dashboard/instalar-app`)
- **Update Prompt**: Notificação de nova versão disponível
- **Offline Badge**: Indicador visual de status de conexão

---

## 7. Integrações Externas

### n8n (Automação)

| Endpoint | Direção | Dados |
|----------|---------|-------|
| `vendas-union-api/sync` | n8n → CRM | Itens de pedido (SQL Server) |
| `contas-pagar-api` | n8n → CRM | Títulos a pagar |
| `contas-receber-api` | n8n → CRM | Títulos a receber |
| `estoque-n8n-sync` | n8n → CRM | Saldos de estoque |
| `erp-webhook-inbound` | ERP → CRM | Webhooks genéricos |
| `contas-pagar-export-api` | CRM → ERP | Exportação de títulos |
| `erp-export-payment` | CRM → ERP | Exportação de pagamentos |

### Pluggy (Open Banking)

| Endpoint | Descrição |
|----------|-----------|
| `pluggy-proxy` | Proxy para API Pluggy |
| `pluggy-webhook` | Webhook de atualização de dados |

### Mapbox / Google Maps

| Endpoint | Descrição |
|----------|-----------|
| `get-mapbox-token` | Retorna token Mapbox para o frontend |
| `get-google-maps-key` | Retorna chave Google Maps |

### Stripe (Pagamentos)

Integração via Supabase para gestão de assinaturas (`assinaturas`, `planos`).

---

## 8. Sidebar Dinâmico

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `sidebar_categories` | Categorias do menu (nome, ícone, ordem, colapsável) |
| `sidebar_category_modules` | Vínculos categoria → módulo (ordem) |
| `modulos` | Cadastro de módulos (código, nome, ativo) |
| `telas` | Cadastro de telas (código, módulo_id, nome) |
| `perfil_modulos` | Permissão perfil → módulo |
| `perfil_telas` | Permissão perfil → tela |

### Fluxo de Renderização

```
AppSidebar
  └─ Busca sidebar_categories (ordenado)
       └─ Para cada categoria:
            └─ Busca sidebar_category_modules (ordenado)
                 └─ Filtra por hasModulePermission/hasScreenPermission
                      └─ Renderiza SidebarMenuItem (com ícone, badge, rota)
```

---

## 9. Memory Management

### MemoryManager

Gerencia alocação de memória para evitar memory leaks:
- Limpeza de queries inativas a cada 5 minutos
- Force cleanup via evento `force-memory-cleanup`
- Monitoramento de uso de memória via `MemoryMonitor`

### QueryClient Config

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 min — dados ficam frescos
      gcTime: 10 * 60 * 1000,       // 10 min — cache mantido
      refetchOnWindowFocus: false,   // Não recarrega ao focar
      retry: 1,                      // 1 retry em falha
      refetchOnReconnect: false,     // Sem refetch ao reconectar
    },
  },
});
```

---

## 10. Build e Performance

### Lazy Loading

Todas as ~265 páginas usam `lazyWithRetry()` — retry automático (3 tentativas, 1.5s intervalo) com force reload para novos manifests pós-deploy.

### Code Splitting (Vite)

```
Chunks:
  ├─ vendor-react (React, ReactDOM)
  ├─ vendor-ui (Radix, Shadcn)
  ├─ vendor-supabase (Supabase JS)
  ├─ vendor-charts (Recharts)
  └─ páginas individuais (lazy loaded)
```

### Otimizações de Produção

- Tree shaking automático
- Terser para minificação
- Remoção de `console.log` em produção
- Source maps ocultos
- Target: < 500KB initial bundle

---

## Referências

- [Mapa de Módulos](./MODULES_OVERVIEW.md)
- [Central de Inteligência](./MODULE_CENTRAL_INTELIGENCIA.md)
- [Módulo Fábrica](./MODULE_FABRICA.md)
- [China + Projetos](./MODULE_CHINA_PROJETOS.md)
- [Módulo Financeiro](./MODULE_FINANCEIRO.md)
- [Trade + Comercial](./MODULE_TRADE_COMERCIAL.md)
- [Edge Functions (legacy)](./EDGE_FUNCTIONS.md)
- [Arquitetura (legacy)](./ARCHITECTURE.md)
