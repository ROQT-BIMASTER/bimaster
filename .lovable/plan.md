

# Projeto "API Contas a Pagar — Produção" + Replanejamento Geral (60 dias)

## 1. Novo projeto: **"API Contas a Pagar — Hardening & Go-Live"**

Tipo: `generico` · Prioridade: **alta** · Janela: 22/abr → 21/jun (60 dias) · Responsável padrão: Felipe ROQT.

### Estrutura (5 seções)

**Seção 1 — Concluído (registro histórico)**
- Tarefas marcadas `concluida` com data 22/abr:
  - 16 endpoints públicos AP implementados (`/query`, `/consultar`, `/incluir`, `/upsert`, `/upsert-lote`, `/lancar-pagamento`, `/cancelar`, `/estornar`, `/parcelas`, `/pagamentos`, `/anexos`, `/conciliar`, `/desconciliar`, `/status`, `/health`, `/sync`)
  - Hardening `/sync` com limite 5.000 registros e log de origem N8N
  - Auditoria de prontidão regulatória nos 16 endpoints
  - Fila Exportação ERP, Painel AP Central, Conciliação Manual AP, Sync Cadastros AP

**Seção 2 — Em andamento (prazo 22/abr → 22/mai)**
- Aplicar ajustes N8N (timeout 300s, batch 3.000, cron 15min) — **alta** · 25/abr
- Smoke test pós-ajuste N8N + validação `sync_control` — **alta** · 28/abr
- Adicionar nota de segregação N8N vs Portal no `ApiDocumentation.tsx` — **media** · 02/mai
- Dashboard Health Integrações AP (latência, erros, rate-limit hits) — **alta** · 15/mai
- Logs de Sync com drill-down por workflow — **media** · 22/mai

**Seção 3 — Falta para produção (prazo 23/mai → 21/jun)**
- Testes de carga `/sync` (5k, 10k, 20k registros) — **alta** · 30/mai
- Idempotência centralizada para `/upsert-lote` (chave `Idempotency-Key`) — **alta** · 02/jun
- Rotação programada de API Keys + procedimento documentado — **alta** · 06/jun
- Observabilidade: alertas Slack para falhas consecutivas — **media** · 10/jun
- Runbook de incidentes AP (timeout, payload>5k, lock ERP) — **media** · 13/jun
- Smoke test de aceitação final + assinatura de go-live — **urgente** · 18/jun
- Publicação versão 1.0 no `ApiDocumentation.tsx` (changelog) — **alta** · 20/jun

**Seção 4 — Segurança & Compliance**
- Pen test caixa-preta nos 16 endpoints — **alta** · 25/mai
- Revisão RLS + WAF rules da rota `/contas-pagar-api/*` — **alta** · 28/mai
- Auditoria LGPD nos campos PII expostos (CPF/CNPJ fornecedor) — **media** · 05/jun

**Seção 5 — Documentação**
- Changelog grep-verifiable (per `release-changelog-discipline`) — **alta** · 19/jun
- Guia "Integrador Externo AP em 5 minutos" — **media** · 17/jun
- Postman collection oficial AP — **media** · 12/jun

## 2. Replanejamento dos projetos em andamento (datas em 60 dias: 22/abr → 21/jun)

Ajustes diretos via SQL:

| Projeto | Tarefas pendentes | Ação |
|---|---|---|
| Módulo: Integração ERP | 3 (1 em 06/mai, 1 em 20/jun, 1 em 03/set) | Mover a de set/2026 para **15/jun** |
| Módulo: Projetos | 4 (até 03/set) | Redistribuir entre **10/mai → 18/jun** |
| Módulo: Fábrica Brasil | 3 (até 03/set) | Redistribuir entre **12/mai → 17/jun** |
| Módulo: Marketing | 3 (até 03/set) | Redistribuir entre **08/mai → 14/jun** |
| Módulo: Estoque | 3 (até 03/set) | Redistribuir entre **09/mai → 16/jun** |
| Módulo: Eventos | 3 (até 03/set) | Redistribuir entre **11/mai → 19/jun** |
| Módulo: Reuniões | 3 (até 03/set) | Redistribuir entre **07/mai → 13/jun** |
| Módulo: Financeiro | 3 (até 20/jun) | Já dentro da janela — manter |
| Módulo: Trade Marketing, Fábrica China, Comercial, Prospects, Central Intel. | 3 cada (até 20/jun) | Já na janela — manter |
| Marketing B2B, Ecomm | 25 sem prazo + 15 atrasadas | Atribuir prazos escalonados 28/abr → 21/jun |
| K \| Ruby Rose | 117 sem prazo + 11 atrasadas | Distribuir em sprints quinzenais 30/abr → 18/jun |
| Instuticional \| Ruby Rose | 268 sem prazo + 4 atrasadas | Distribuir em 6 ondas (≈45/onda) 02/mai → 20/jun |
| Sazonais \| Ruby Rose | 51 sem prazo + 1 atrasada | Distribuir 05/mai → 19/jun |
| BiMaster — Implantação | 24 sem prazo | Distribuir 28/abr → 16/jun |
| Criação | 1 sem prazo | Definir 30/abr |

Regra de distribuição: ordem por `prioridade` (urgente→alta→media→baixa) + `ordem` da seção, espaçamento linear até 21/jun.

## 3. Cronograma consolidado por prioridade

```text
Sprint 1 (22/abr–05/mai) — URGENTE
  • Aplicar ajustes N8N CR + AP
  • Sanear 286 tarefas sem prazo (Ruby Rose + Implantação)
  • Smoke tests pós-N8N

Sprint 2 (06/mai–19/mai) — ALTA
  • Dashboard Health AP
  • Pen test 16 endpoints AP
  • Revisão RLS/WAF
  • Tarefas alta dos módulos ERP/Projetos/Marketing

Sprint 3 (20/mai–02/jun) — ALTA
  • Testes de carga /sync
  • Idempotência /upsert-lote
  • Logs com drill-down

Sprint 4 (03/jun–16/jun) — MEDIA + ALTA
  • Rotação chaves + alertas
  • Postman + Guia integrador
  • Auditoria LGPD

Sprint 5 (17/jun–21/jun) — URGENTE GO-LIVE
  • Smoke aceitação final
  • Changelog + ApiDocumentation v1.0
  • Assinatura de produção
```

## 4. Implementação técnica (no modo default)

1. **INSERT** em `projetos` para "API Contas a Pagar — Hardening & Go-Live" (tipo `generico`, status `ativo`, criador Felipe ROQT, cor azul).
2. **INSERT** em `projeto_secoes` (5 seções) e `projeto_tarefas` (~25 tarefas com prazos definidos acima).
3. **INSERT** em `projeto_membros` adicionando Felipe e Daniel Vilanova como responsáveis.
4. **UPDATE** em massa em `projeto_tarefas` para os 14 projetos em andamento, distribuindo `data_prazo` conforme tabela acima usando `ROW_NUMBER()` por prioridade/ordem dentro de cada projeto.
5. **UPDATE** específico nas 8 tarefas com prazo `2026-09-03` (após janela de 60 dias) movendo para o intervalo 13/jun → 20/jun.

Sem alterações de schema, sem alterações de código, sem alterações nas Edge Functions de AP. Operação puramente de dados.

## Não-escopo

- Endpoints públicos AP (`/query`, `/incluir`, etc.) não são tocados — apenas catalogados.
- `ApiDocumentation.tsx`, SDK e `APP_VERSION` permanecem na versão atual; bump só ocorre ao concluir a tarefa "Publicação versão 1.0" em 20/jun.
- Projetos `documentacao` (Arquitetura, Segurança Global, Padrões) sem tarefas pendentes ficam intactos.

