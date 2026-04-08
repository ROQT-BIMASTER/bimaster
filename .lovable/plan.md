# Automatizar Monitoramento de Oportunidades pelo Autopilot

## Situação Atual
- O Autopilot calcula scores e gera oportunidades, mas **apenas quando o usuário clica manualmente** em "Atualizar Análise"
- Os resultados ficam apenas em memória (estado React) — não são salvos no banco
- Não há execução automática periódica

## Solução

### 1. Criar tabela `influencer_opportunities`
Persistir oportunidades, alertas e tendências geradas pela IA para consulta futura:
- `influencer_id`, `opportunity_score`, `reason` (oportunidades)
- `alert_type`, `alert_message` (alertas)
- `trends`, `suggested_actions` (dados gerais)
- `generated_at`, `status` (new/viewed/actioned)

### 2. Modificar Edge Function `influencer-autopilot`
- Na action `analyze_opportunities`: salvar resultados na tabela `influencer_opportunities`
- Nova action `auto_monitor`: executa scores + oportunidades + atualiza `last_autopilot_run`
- Retornar dados persistidos

### 3. Agendar execução automática via `pg_cron`
- Cron job diário (08:00 UTC) que chama o autopilot para cada usuário com `autopilot_enabled = true`
- Frequência respeitando a configuração do perfil (daily/weekly)

### 4. Modificar `AIOpportunitiesPanel`
- Carregar oportunidades salvas do banco ao abrir (sem precisar clicar)
- Exibir badge com novas oportunidades não visualizadas
- Manter botão "Atualizar" para forçar nova análise

### 5. Atualizar `AutopilotMiningPanel`
- Incluir contagem de oportunidades mineradas na visão geral

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `influencer_opportunities` com RLS |
| `supabase/functions/influencer-autopilot/index.ts` | Modificar — persistir oportunidades + nova action `auto_monitor` |
| `src/components/marketing/influencers/AIOpportunitiesPanel.tsx` | Modificar — carregar dados do banco automaticamente |
| `src/components/marketing/influencers/AutopilotMiningPanel.tsx` | Modificar — incluir oportunidades nos stats |
| SQL Insert (pg_cron) | Agendar execução automática |
