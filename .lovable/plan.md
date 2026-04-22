

# Cronograma Mestre AP + Relatório de Prontidão Go-Live

Dois entregáveis em um único pacote, gerados como artefatos para download. Sem alteração de código, schema ou Edge Functions.

## Entregável 1 — Cronograma Mestre AP (PDF + Markdown)

Consolidação de **todas as 22 tarefas** do projeto "API Contas a Pagar — Hardening & Go-Live", ordenadas por **prioridade** (urgente → alta → media → baixa) e agrupadas por **seção**.

### Estrutura do documento

1. **Capa** — projeto, janela 22/abr → 21/jun, totalizadores (4 concluídas / 18 pendentes / 0 atrasadas).
2. **Visão por sprint** (5 sprints quinzenais) com Gantt textual:
   ```text
   Sprint 1 (22/abr–05/mai)  ████░░░░░░  N8N + smoke tests
   Sprint 2 (06/mai–19/mai)  ██████░░░░  Dashboard Health + Pen test + RLS/WAF
   Sprint 3 (20/mai–02/jun)  ████████░░  Carga + Idempotência + Drill-down
   Sprint 4 (03/jun–16/jun)  ████████░░  Rotação chaves + LGPD + Slack + Postman
   Sprint 5 (17/jun–21/jun)  ██████████  Smoke final + ApiDoc v1.0 + Changelog
   ```
3. **Tabela mestre por prioridade** (urgente primeiro), colunas: Seção · Título · Status · Prazo · Responsável.
4. **Tabela por seção** (1→5), respeitando `ordem` original.
5. **Resumo de marcos críticos**:
   - 25/abr: ajustes N8N aplicados
   - 18/jun: smoke test de aceitação (urgente)
   - 20/jun: ApiDocumentation v1.0 publicada

### Ajustes opcionais de status/datas

Após análise dos dados atuais, **nenhum ajuste é necessário**:
- 100% das tarefas já estão dentro da janela 22/abr → 21/jun.
- Status coerentes (4 `concluida`, 1 `em_andamento`, 17 `pendente`).
- Ordens e prioridades respeitam a cadência de sprint.

Nada será reescrito no banco — o cronograma é um snapshot leitura.

## Entregável 2 — Relatório de Prontidão Go-Live (PDF + Markdown)

Documento executivo no formato **Go/No-Go** estruturado para apresentação a stakeholders.

### Seções do relatório

1. **Sumário executivo**
   - Status geral: **AMARELO** (pronto para hardening final, ainda não para go-live)
   - Data alvo: **21/jun/2026**
   - Confiança: 18% concluído / 82% pendente em 60 dias

2. **Concluído (4 itens)** — checklist verde
   - 16 endpoints públicos AP implementados
   - Hardening `/sync` (limite 5k + log origem N8N)
   - Auditoria de prontidão regulatória
   - Telas administrativas AP (Painel, Fila, Conciliação, Sync)

3. **Pendente por categoria**
   - Integração & Observabilidade (5)
   - Performance & Segurança (4)
   - Compliance (3)
   - Documentação (3)
   - Aceitação final (3)

4. **Riscos bloqueantes para produção** (matriz Probabilidade × Impacto)
   | # | Risco | Prob. | Impacto | Mitigação | Prazo |
   |---|---|---|---|---|---|
   | R1 | Idempotência ausente em `/upsert-lote` causa duplicidade | Média | Alto | Implementar `Idempotency-Key` | 02/jun |
   | R2 | `/sync` não validado com 20k registros | Alta | Alto | Testes de carga 5k/10k/20k | 30/mai |
   | R3 | Sem rotação programada de API Keys | Média | Médio | Procedimento + cron | 06/jun |
   | R4 | Pen test caixa-preta não executado | Alta | Crítico | Pen test 16 endpoints | 25/mai |
   | R5 | RLS/WAF não revisados pós-hardening | Média | Alto | Revisão da rota `/contas-pagar-api/*` | 28/mai |
   | R6 | LGPD: PII fornecedor sem auditoria | Baixa | Alto | Auditoria CPF/CNPJ | 05/jun |
   | R7 | Sem alertas Slack para falhas consecutivas | Alta | Médio | Webhook + thresholds | 10/jun |
   | R8 | Runbook de incidentes inexistente | Média | Médio | Documentar | 13/jun |

5. **Critérios de aceitação Go-Live** (checklist binário)
   - [ ] 100% dos 16 endpoints com testes de carga aprovados
   - [ ] Pen test sem findings críticos/altos
   - [ ] RLS + WAF revisados e auditados
   - [ ] LGPD compliance assinada
   - [ ] Idempotência ativa em rotas de escrita em lote
   - [ ] Dashboard Health AP em produção
   - [ ] Alertas Slack ativos
   - [ ] Postman collection + Guia integrador publicados
   - [ ] Changelog grep-verifiable em `ApiDocumentation.tsx`
   - [ ] APP_VERSION → 1.0 com aprovação técnica

6. **Recomendação final** — go-live condicionado à conclusão dos 18 itens pendentes até 20/jun, com smoke test de aceitação em 18/jun como gate.

7. **Anexo** — Glossário (RLS, WAF, idempotência, LGPD, sync_control).

## Implementação técnica

Script Python único em `/tmp/build_ap_reports.py`:

1. Consulta `projeto_tarefas` + `projeto_secoes` do projeto `b76fda11-f45a-48d4-92f4-d08b5f07afa5` via `psql`.
2. Gera 4 arquivos em `/mnt/documents/`:
   - `cronograma_ap_mestre.pdf` (ReportLab)
   - `cronograma_ap_mestre.md`
   - `relatorio_prontidao_ap_golive.pdf` (ReportLab)
   - `relatorio_prontidao_ap_golive.md`
3. QA: converte cada PDF para PNG (ImageMagick), inspeciona páginas para validar layout, ajusta se houver overflow.
4. Emite tags `<lov-artifact>` para os 4 arquivos.

Estilo visual: tipografia sóbria, sem emojis, paleta corporativa (#1e293b / #2563eb / âmbar para riscos altos), tabelas com zebra-striping.

## Não-escopo

- Nenhuma alteração no banco (sem `INSERT`/`UPDATE`).
- Nenhuma alteração de código, Edge Function, SDK, OpenAPI ou `APP_VERSION`.
- Nenhuma rotação de API Key (apenas listada como pendência R3).
- Sem mudança nas APIs públicas do Portal.

