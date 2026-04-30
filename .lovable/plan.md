# Atualização do ambiente de projetos — 30/abr/2026

Escopo restrito aos **projetos de sistema** (BiMaster). Projetos de cliente (Criação, Ruby Rose, Marketing B2B, _AFs Trade, Produto Namorados, Projeto Alpha) **não serão tocados**.

## Etapa 1 — Lote-âncora: registrar entregas de hoje

### Projeto A: Módulo: Projetos
**Tarefa 1: "Resumo do projeto — KPIs completos e fix do relatório"** (concluída, 30/abr)
- KPIs renderizam sempre que há dados (remoção do early-return)
- Grid responsivo, labels sem truncamento
- Suporte a layout com >6 cards (auto-fit)
- Fix da resposta do `projeto-copilot-relatorio`
- Validação no preview

**Tarefa 2: "Copiloto de Projeto v2 — memória, retenção 30d, salvar e vincular"** (concluída, 30/abr)
- Tabelas `projeto_copilot_threads/_mensagens/_user_profile/_relatorios/_relatorio_tarefas` com RLS
- Edge `projeto-copilot` com aprendizado de perfil (gemini-2.5-flash-lite)
- Edge `projeto-copilot-salvar-relatorio` (flag `salvo` + cópia para `projeto-anexos`)
- RPCs `copilot_set_thread_salvo` / `copilot_set_relatorio_salvo`
- Componente `VincularRelatorioTarefaDialog`
- Cron diário `projeto-copilot-cleanup` (purge 30d)
- Memória `mem://features/projects/copilot-memory-and-saved-reports`

### Projeto B: Módulo: Central de Inteligência
**Tarefa 3: "Copiloto Central — assistente pessoal multi-projeto"** (concluída, 30/abr)
- Migrações `central_copilot_*` (6 tabelas, RLS user-isolated, `expires_at`)
- Edge `central-copilot` (tools `metricas_pessoais`, `listar_minhas_tarefas`, `listar_delegadas`, `listar_inbox`, `agenda_periodo`)
- Edge `central-copilot-aplicar` (proposals com senha)
- Edge `central-copilot-relatorio` (PDF/XLSX cross-projeto)
- Edge `central-copilot-salvar-relatorio` + RPCs `copilot_set_central_*_salvo`

**Tarefa 4: "Central de Trabalho — Copiloto integrado (UI + Cmd+J)"** (concluída, 30/abr)
- Hook `useCentralCopilot`
- `CentralCopilotPanel` com sugestões pessoais e indicador de retenção 30d
- `VincularRelatorioCentralDialog`
- Launcher + atalho global `Cmd/Ctrl+J` no `CentralHeader`
- Cleanup unificado em `projeto-copilot-cleanup` (escopo `projeto` + `central`)

> Apresento o SQL completo (4 tarefas + 22 subtarefas) inline antes de aplicar. Aprovou → executo.

## Etapa 2 — Varredura lote a lote (apenas projetos de sistema)

| Lote | Projetos | Tarefas ativas |
|---|---|---|
| L1 | Módulo: Financeiro, Padrões de Segurança — BiMaster, Segurança Global — BiMaster | 105 |
| L2 | Arquitetura Geral — BiMaster, Módulo: Integração ERP, API Contas a Pagar — Hardening & Go-Live | 66 |
| L3 | Módulo: Fábrica Brasil, Módulo: Fábrica China, Módulo: Trade Marketing | 58 |
| L4 | Módulo: Prospects & CRM, Módulo: Comercial, Módulo: Marketing | 49 |
| L5 | Módulo: Estoque, Módulo: Eventos, Módulo: Reuniões | 39 |
| L6 | Performance & Observabilidade — BiMaster, Experiência do Admin — BiMaster | 9 |

**Projetos NÃO incluídos** (são de cliente / fora do escopo): Criação, Instuticional Ruby Rose, K Ruby Rose, Sazonais Ruby Rose, Marketing B2B, _AFs Trade Marketing, Produto Namorados, Projeto Alpha, BiMaster - Implantação (finalizado).

### Fluxo por lote

1. Listar candidatas a cancelar: `status != 'concluida'` E `updated_at < now() - 60 dias` E sem subtarefas ativas; ou duplicatas de tarefas concluídas; ou escopo já entregue por outra tarefa.
2. Identificar tarefas com status desatualizado (subtarefas concluídas, pai aberto).
3. Apresentar relatório-resumo do lote em markdown na chat: `id`, `título`, `ação proposta`, `motivo`.
4. Aguardar seu OK explícito → aplicar via `UPDATE`: `status='cancelada'`, `data_conclusao=2026-04-30`, descrição prefixada com `[Cancelada em 30/abr/2026 — escopo não vigente]`.
5. Fechar o lote, seguir para o próximo.

### Tarefas que NÃO entram em nenhum lote (intocáveis)

- Tarefas com `asana_gid` (sync externo)
- Tarefas com `validacao_status='aprovado'`
- Tarefas vinculadas a `produto_id`

## Detalhes técnicos

- Inserts/updates via tool `supabase--insert` (são dados, não schema).
- Status `'cancelada'` (visível ao cliente, conforme sua escolha).
- Audit trail no campo `descricao` com prefixo de data.
- Subtarefas: `parent_tarefa_id` aponta para a pai; `secao_id` herda; `ordem` sequencial.
- Seções: reuso da seção "Entregas — Abr/26" se existir, senão crio.

## Diagrama

```text
Etapa 1 (âncora — hoje)        Etapa 2 (housekeeping)
─────────────────────          ──────────────────────
Mód. Projetos                  L1 → relatório → OK → aplicar
  ├ T1 + 5 subs                       │
  └ T2 + 7 subs                       ▼
Mód. Central Inteligência      L2 → relatório → OK → aplicar
  ├ T3 + 5 subs                       │
  └ T4 + 5 subs                       ▼ ... até L6
```

## Entregáveis

- 4 tarefas + 22 subtarefas registradas hoje em 2 projetos-âncora → seu Relatório de Produtividade da Central reflete imediatamente (`MinhasTarefasKPIs.concluidasHoje`).
- 6 lotes de housekeeping, cada um com aprovação isolada e trilha auditável.

## O que NÃO está neste plano

- Nenhuma alteração em projetos de cliente (L7 removido).
- Não mexo em `projeto_horas_lancamentos` — se quiser horas alocadas, me diga quantas por tarefa.
- Não disparo notificação automática ao cliente; posso rodar `projeto-resumo-diario` nos 2 projetos-âncora ao final, se quiser.
