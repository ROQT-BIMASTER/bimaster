## Parte 1 — Painel Sync de Atualização do Estoque

### Diagnóstico
A tela `EstoqueErpSyncPage` já existe em `/dashboard/estoque/sync-erp` (3 abas: ERP Engine, Métricas, Monitor) e está protegida por `ScreenRoute screenCode="admin"`. Ela **não aparece no menu** porque o submenu "Estoque" da sidebar (`AppSidebar.tsx` linhas 1143–1153) lista apenas Painel, Distribuidoras, Produtos Master, Saldos, Consolidado e Vinculações — sem entrada para Sync ERP.

### Ação
Adicionar item de menu (admin-only) no submenu Estoque apontando para a tela existente, sem mexer no conteúdo da tela.

```
src/components/dashboard/AppSidebar.tsx — submenu "estoque"
+ {isAdmin && (
+   <MenuItemLink to="/dashboard/estoque/sync-erp" icon={RefreshCw} title="Sync ERP" />
+ )}
```

Após você abrir e avaliar, decidimos se precisa refatorar/expandir o conteúdo (abas atuais, KPIs, agendamento etc.).

---

## Parte 2 — Projetos de Desenvolvimento de Sistema (Admin) — Roadmap 30 dias

### Diagnóstico
Levantamento dos 3 projetos `BiMaster` ativos:

| Projeto | Total tarefas | Sem prazo | Status sem prazo |
|---|---|---|---|
| Arquitetura Geral — BiMaster | 18 | 18 | 100% `concluida` |
| Segurança Global — BiMaster | 28 | 28 | 100% `concluida` |
| Padrões de Segurança — BiMaster | 36 | 36 | 100% `concluida` |

**Achado importante:** as 82 tarefas sem prazo já estão **todas concluídas** — não há tarefa pendente em aberto sem prazo. Logo, o trabalho real é:
1. **Backfill histórico**: preencher `data_prazo` das tarefas concluídas (usar `data_conclusao` quando existir, senão `updated_at::date`) — apenas para higiene visual nos gantts/relatórios.
2. **Roadmap forward 30 dias**: criar novas tarefas pendentes com prazos priorizados por criticidade (Segurança > Bug > Feature) e, se necessário, abrir projetos novos para temas ausentes.

### Backfill de prazos (tarefas já concluídas)
Update SQL nos 3 projetos:
```
data_prazo = COALESCE(data_conclusao, updated_at::date)
WHERE projeto_id IN (...) AND excluida_em IS NULL AND data_prazo IS NULL
```

### Novas tarefas — distribuição por criticidade nos próximos 30 dias

Critério de prazos (a partir de hoje, 2026-04-29):
- **crítica (segurança)** → +3 a +7 dias
- **alta (bug/regressão)** → +7 a +14 dias
- **média (feature)** → +14 a +30 dias

#### Projeto: Segurança Global — BiMaster (4 novas tarefas)
| Tarefa | Prioridade | Prazo |
|---|---|---|
| Auditoria trimestral de RLS em tabelas novas (Q2/26) | crítica | +5d |
| Rotação de chaves de API e tokens de service role | crítica | +7d |
| Scanner automatizado de vazamento de PII em logs | alta | +14d |
| Painel de findings de segurança (severidade/owner/SLA) | média | +28d |

#### Projeto: Padrões de Segurança — BiMaster (4 novas tarefas)
| Tarefa | Prioridade | Prazo |
|---|---|---|
| Hardening de `secureHandler` em Edge Functions restantes | crítica | +5d |
| Política `.strict()` Zod em todas rotas de mutation | alta | +10d |
| Documentar matriz ABAC de permissões de processos | alta | +14d |
| Guia de revisão de código com checklist OWASP Top 10 | média | +25d |

#### Projeto: Arquitetura Geral — BiMaster (4 novas tarefas)
| Tarefa | Prioridade | Prazo |
|---|---|---|
| Padronização de uso de `supervisor_id` (deprecação `gerente_id`) | crítica | +7d |
| Convenção de migrations com semi-joins em RLS | alta | +12d |
| Quebra de bundles pesados (lazyWithRetry para rotas restantes) | média | +21d |
| Adoção de `usePageBgColor` em páginas restantes | média | +28d |

#### Novo projeto: Performance & Observabilidade — BiMaster
Tema ausente nos projetos atuais. Status `ativo`, criador admin.
| Tarefa | Prioridade | Prazo |
|---|---|---|
| Índices faltantes em queries lentas do Supabase Linter | crítica | +7d |
| Dashboard de p95/p99 das Edge Functions principais | alta | +14d |
| Alertas Slack/Email para falhas em sync ERP | alta | +14d |
| Profiling de páginas com tempo de render >1s | média | +21d |
| SLO inicial: disponibilidade 99,5% e latência p95 <800ms | média | +28d |

#### Novo projeto: Experiência do Admin — BiMaster
Cobre UX recorrente do admin (sync, impersonation, permissions).
| Tarefa | Prioridade | Prazo |
|---|---|---|
| Painel unificado de Sync (Estoque + Vendas + AP + AR) | alta | +14d |
| Tela de auditoria de impersonation com filtros | alta | +14d |
| Editor visual de matriz de permissões granulares | média | +28d |
| Centro de relatórios exportáveis em XLSX/PDF | média | +28d |

### Como será executado tecnicamente
- 1 migration para o backfill de `data_prazo` nas 82 tarefas concluídas.
- 1 inserção de dados (insert tool) criando os 2 projetos novos + ~25 novas tarefas com `responsavel_id = admin do sistema`, `status='pendente'`, `prioridade` conforme tabelas, `data_prazo` calculado por `now() + interval`.
- Sidebar: 1 linha adicionada em `AppSidebar.tsx` (admin-only) para expor `EstoqueErpSyncPage`.

### Fora do escopo
- Refatoração visual da `EstoqueErpSyncPage` (você avaliará a tela atual primeiro).
- Mudanças na página `/dashboard/projetos/central` (visualização — apenas a base de dados muda).
- Notificações automáticas para responsáveis das novas tarefas.
