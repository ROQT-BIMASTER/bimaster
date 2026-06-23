# MODULES_REVIEW — Auditoria 2026-Q2

> Snapshot dos módulos com contagens atuais (junho/2026). Comparar com a tabela
> de `docs/MODULES_OVERVIEW.md` §2. Este documento não substitui o catálogo —
> serve como insumo para o refresh a ser feito no PR-3 (com base no script
> automatizado do PR-4).

## 1. Snapshot de pastas

Diretórios em `src/components/` (66 no total):

```
admin           ai           ai-elements   atividades   auditoria
auth            briefings    calendario    chat         china
clientes-dash.  cobranca     comercial     common       composicao
compras         conciliacao  config.-acesso configurações controladoria
copilot         crm          dashboard     departments  detalhamento
dre             erp          estoque       events       fabrica
financeiro      fluxocaixa   forms         huggs        inbox
kanban          mapa         marketing     meetings     minhas-tarefas
navigation      notifications painel-execu performance  portal
processo        processos    produto-brasil profile     projetos
prospects       pwa          qa            relatorios   rr-tasks
security        shared       simulador     tarefas      theme
tour            trade        ui            vendas       whatsapp
```

Diretórios em `src/pages/` (21 subdiretórios temáticos + páginas raiz).

## 2. Inventário por módulo (snapshot)

| # | Código | Diretório principal | Páginas raiz aprox. | Observações |
| -- | --- | --- | ---: | --- |
| 1 | `prospects` | `src/pages/prospects/` + raiz | 6 | OK |
| 2 | `trade` | `src/pages/trade/` + `src/components/trade/` | 40+ | Recontar — vários novos PDV/CNPJ |
| 3 | `marketing` | `src/components/marketing/` | 10+ | Subdivide em `studio/`, `influencers/`, `social/` |
| 4 | `fabrica` | `src/pages/fabrica*` + `src/components/fabrica/` | 18+ | Inclui Focus Mode da Ficha |
| 5 | `china` | `src/pages/China*` + `src/components/china/` | 12+ | Recontar — `ChinaChecklist*`, `ChinaAuditoria*`, etc. |
| 6 | `financeiro` | `src/pages/financeiro/` + `src/pages/Contas*` | 30+ | Inclui DRE, Plano Reducao, AP, AR |
| 7 | `comercial` | `src/pages/comercial/` | 8 | OK |
| 8 | `precos` | `src/components/fabrica/MatrizPrecos*` | 6 | OK |
| 9 | `projetos` | `src/pages/projetos/` + `src/components/projetos/` | 25+ | **Audit-only — não editar** |
| 10 | `portal` | `src/pages/portal/` + `ClienteProtectedRoute` | 8+ | Guard separado |
| 11 | `admin` | `src/pages/admin/` + `src/components/admin/` | 20+ | Inclui versões de cliente, impersonation |
| 12 | `central-trabalho` | `src/pages/CentralTrabalho.tsx` + `copilot/` | 1 | Copilot pessoal cross-projeto |
| 13 | `qa` | `src/components/qa/` | n/a | Hub interno |
| 14 | `huggs` | `src/components/huggs/` | n/a | Agente |
| 15 | `meetings` | `src/components/meetings/` | n/a | Gravação |
| 16 | `composicao` | `src/components/composicao/` | n/a | Vinculado a `projetos` |
| 17 | `auditoria` | `src/components/auditoria/` | n/a | Logs administrativos |
| 18 | `processos` / `processo` | `src/components/processo*/` | n/a | Pasta oficial de processos |

(*) Contagens "aproximadas" intencionais — o número exato sai do
`scripts/audit/list-modules.ts` do PR-4.

## 3. Módulo Projetos — observações da auditoria

**Restrição do ciclo:** zero edição de código.

Pontos observados:
- Arquivos `ProjetoTarefaDetalhe.tsx` (1.943 LoC), `MinhasTarefasContent.tsx`
  (1.674 LoC) e `useProjetoTarefas.ts` (1.265 LoC) estão acima do limite saudável,
  mas o tamanho reflete densidade legítima (Kanban + alçadas + RLS + RPCs).
- Padrão `useTarefaDensity` (compact/comfortable persistido) e
  `usePageBgColor` estão sólidos e documentados em memória.
- Hierarquia de aprovação por **lotes** (RPCs `rpc_criar_lote_aprovacao`,
  `rpc_avancar_etapa_aprovacao`, `rpc_mover_lote_para_tarefa`) é consistente.
- Copilot por projeto + Copilot pessoal cross-projeto (Ctrl/Cmd+J) compartilham
  cleanup de retenção de 30 dias (`mem://features/projects/central-copilot`).

**Conclusão:** módulo saudável arquiteturalmente. Decomposição dos arquivos
grandes é desejável, mas fora deste ciclo.

## 4. Itens recomendados para o PR-3

1. Refresh integral da tabela §2 de `MODULES_OVERVIEW.md` com números exatos.
2. Documentar guards alternativos (`ClienteProtectedRoute`, impersonation).
3. Criar `docs/modules/<modulo>.md` para módulos sem ficha individual
   (Central Trabalho, Composição, Huggs, QA, Meetings).
4. Trazer Copilot v2 (`mem://ai/copilot-v2-architecture`) para o catálogo —
   hoje só aparece em memórias.
