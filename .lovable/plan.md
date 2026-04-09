

# Dashboard de Segurança API + Agente IA Sentinel

## Visao Geral

Dois entregaveis:
1. **Dashboard visual** com grafico de tentativas bloqueadas vs autorizadas (24h), agrupadas por IP e endpoint
2. **Agente IA Sentinel** — Edge Function que analisa logs com IA, detecta anomalias avancadas e executa defesas automaticas (bloqueio de IP, desativacao de token)

## Componentes

### 1. Dashboard de Seguranca API (Frontend)

**Novo componente**: `src/components/erp/ApiSecurityDashboard.tsx`

Conteudo:
- **Grafico principal** (BarChart empilhado): Bloqueadas vs Autorizadas por hora nas ultimas 24h
- **Tabela Top 10 IPs**: IP, total de tentativas, bloqueadas, autorizadas, status (normal/suspeito/bloqueado)
- **Tabela Top 10 Endpoints**: Endpoint, chamadas autorizadas, bloqueadas, taxa de erro
- **KPIs**: Total 24h, % bloqueadas, IPs unicos, endpoints mais atacados

Dados: consulta direta a `api_security_log` (ultimas 24h) com agrupamento client-side por IP e endpoint.

**Integracao**: Nova aba "Seguranca API" no `IntegracaoERP.tsx` (visivel apenas para admin).

### 2. Agente IA Sentinel (Backend)

**Nova Edge Function**: `supabase/functions/security-ai-sentinel/index.ts`

Fluxo:
1. Busca logs das ultimas 2h de `api_security_log` e `security_incidents`
2. Envia para Lovable AI (gemini-2.5-flash) com prompt especializado em seguranca
3. A IA analisa e retorna JSON estruturado via tool calling:
   - `anomalies`: lista de anomalias detectadas (tipo, severidade, IP/endpoint, descricao)
   - `defenses`: acoes recomendadas (block_ip, disable_token, alert_only)
   - `risk_assessment`: avaliacao geral do periodo
4. Para riscos reais (confidence >= 0.8), executa defesas automaticas:
   - Insere IP na `security_ip_blocklist` (soft ou hard)
   - Registra incidente em `security_incidents`
5. Retorna relatorio completo

**Prompt da IA**: Especializado em detectar:
- Scanning de endpoints (muitos 401 em endpoints diferentes)
- Credential stuffing (mesmo IP, tokens diferentes)
- API abuse (volume anomalo de um token valido)
- Exfiltracao (GET massivo em endpoints de dados)
- Evasao (alternar IPs com mesmo padrao de User-Agent)

### 3. Painel do Sentinel no Frontend

**Novo componente**: `src/components/erp/SecuritySentinelPanel.tsx`

- Botao "Executar Analise IA" — chama a Edge Function
- Exibe resultado: anomalias encontradas, acoes tomadas, risk assessment
- Historico das ultimas analises (salvo em `security_audit_log`)
- Badge com status: "Sem anomalias" (verde), "Alerta" (amarelo), "Defesa ativa" (vermelho)

Integrado como sub-secao dentro da aba "Seguranca API" do portal ERP.

## Detalhes Tecnicos

| Item | Arquivo | Tipo |
|------|---------|------|
| Dashboard de seguranca API | `src/components/erp/ApiSecurityDashboard.tsx` | Novo |
| Painel Sentinel IA | `src/components/erp/SecuritySentinelPanel.tsx` | Novo |
| Edge Function Sentinel | `supabase/functions/security-ai-sentinel/index.ts` | Novo |
| Aba no portal ERP | `src/pages/IntegracaoERP.tsx` | Edicao |

Nenhuma migracao de banco necessaria — usa tabelas existentes (`api_security_log`, `security_ip_blocklist`, `security_incidents`).

