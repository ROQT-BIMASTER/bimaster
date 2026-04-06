

# Auditoria IA de Anomalias — Análise Premium por Plano de Redução

## Objetivo

Criar uma experiência de auditoria IA com gráficos de nível executivo e posicionamento técnico. Ao clicar "Auditoria IA", o sistema analisa todos os itens do plano selecionado contra o histórico de pagamentos, gerando um relatório visual completo com anomalias, tendências e recomendações estratégicas.

## Experiência do Usuário

1. Botão **"Auditoria IA"** (ícone ShieldAlert) ao lado dos botões existentes
2. Ao clicar, abre um Dialog full-screen (estilo Modo Foco) com:
   - **Header** com nome do plano, data da auditoria e score geral de risco
   - **KPIs** no topo: Score de Risco, Anomalias Detectadas, Potencial de Economia Não Capturado, Itens Críticos
   - **Gráfico Radar** — Perfil de risco multidimensional (custos crescentes, prazos vencidos, metas irrealistas, duplicidades, concentração de fornecedor)
   - **Gráfico de Barras Horizontais** — Top 10 fornecedores por severidade de anomalia, com gradientes por nível (alta/média/baixa)
   - **Gráfico de Linha Temporal** — Evolução mensal dos gastos dos fornecedores anômalos vs média histórica
   - **Tabela de Anomalias** — Lista detalhada com tipo, severidade, item afetado, descrição técnica e recomendação
3. Botão de exportar relatório em Excel

## Alterações

### 1. Edge Function `expense-ai-assistant` — Nova action `audit_reduction_plan`

Handler que:
- Recebe `planoId` e `authHeader`
- Usa `getSupabaseAdmin()` para buscar:
  - Itens de `contas_pagar_revisao` do plano (com joins em departamentos e plano de contas)
  - Últimos 12 meses de `contas_pagar` por `fornecedor_codigo` dos itens
  - Métricas via `get_fornecedor_metricas_reducao`
- Monta prompt técnico para Gemini 2.5 Pro pedindo análise estruturada via tool calling:
  - `risk_score` (0-100)
  - `anomalies[]` com: type (cost_spike, stalled_item, overdue, unrealistic_target, duplicate, concentration), severity, fornecedor, description, recommendation, data_points (valores numéricos para gráficos)
  - `trend_data[]` para gráfico temporal (mês, fornecedor, valor_real, valor_medio)
  - `radar_dimensions` com scores para cada dimensão de risco
  - `summary` texto executivo
- Retorna JSON estruturado para renderização no frontend

### 2. `PlanoReducaoGastos.tsx` — Botão + Dialog de Auditoria Premium

- Estado: `showAuditDialog`, `auditResult`, `isAuditing`
- Botão com ícone ShieldAlert e texto "Auditoria IA"
- Dialog full-screen usando `DialogContent className="max-w-[98vw] w-[98vw] h-[95vh]"`
- Componente interno `AuditReportContent` que renderiza:
  - 4 KPI cards no topo (score com gauge visual, contadores)
  - `RadarChart` (Recharts) para perfil de risco multidimensional
  - `BarChart` horizontal para top fornecedores por severidade
  - `ComposedChart` (Line + Area) para evolução temporal
  - Tabela de anomalias com badges de severidade coloridos e ícones por tipo
- Usa `chartColors` e gradientes (`linearGradient`) do design system
- Exportar Excel com ExcelJS (já importado)

### 3. `useExpenseAI.ts` — Novo hook `useAuditReductionPlan`

- `audit(planoId)` → chama `invokeAI("audit_reduction_plan", { planoId })`
- Retorna `{ audit, isAuditing, result, clearResult }`

## Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/expense-ai-assistant/index.ts` | Nova action `audit_reduction_plan` com consulta DB + análise IA via tool calling |
| `src/hooks/useExpenseAI.ts` | Novo hook `useAuditReductionPlan` |
| `src/components/financeiro/PlanoReducaoGastos.tsx` | Botão "Auditoria IA" + Dialog full-screen com gráficos Recharts premium |

