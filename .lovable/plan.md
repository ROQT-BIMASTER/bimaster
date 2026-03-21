

# Revisão do Prompt: O que já existe vs O que falta

## Auditoria completa

| Item do Prompt | Status |
|---|---|
| Paleta rosa/pink Méliuz, gradientes, tipografia | **Implementado** |
| Cards arredondados 16px, sombras suaves, espaçamento | **Implementado** |
| Barra de busca pill no topo | **Implementado** (`TradeSearchBar`) |
| Banner carrossel horizontal | **Implementado** (`TradeHeroBanner`) |
| Seções com título + "Abrir todas" | **Implementado** (`TradeSectionHeader`) |
| Hover/press scale(1.02) nos cards | **Implementado** |
| Loading skeleton em cards | **Implementado** |
| Banners com slide automático | **Implementado** (5s) |
| Admin Banners (CRUD, agendamento, toggle) | **Implementado** |
| Admin Incentivos da Semana (CRUD, metas, período) | **Implementado** |
| Seção Incentivos na home do usuário (cards, progresso, badge) | **Implementado** (`IncentivosWeekSection`) |
| Catálogo de Displays | **Implementado** |
| Bottom navigation 5 ícones | **N/A** — o app usa sidebar (DashboardLayout), bottom nav não se aplica |
| Grid de parceiros/lojas 4 colunas com ícones circulares | **Parcial** — KPIs existem mas em formato card, não ícone circular |
| Cupons em formato ticket/voucher | **Não implementado** — mas não há dados de cupons no sistema |
| **Catálogo de Materiais — Visão Gerente** | **Não existe** |
| **Catálogo de Materiais — Landing Page Usuário** | **Não existe** |
| **Central de Solicitações de Materiais** | **Não existe** |

---

## Recomendação

Os itens 1 a 3 do prompt (visual, banners, incentivos) já estão implementados. O único grande bloco novo são os itens **4, 5 e 6**: o sistema completo de **Catálogo de Materiais de Trade** com gestão pelo gerente, landing page para o usuário solicitar, e central administrativa de solicitações.

Este é um recurso grande (6 novas tabelas, ~10 novos componentes, 3 novas páginas). Sugiro dividir a implementação em **3 fases**:

### Fase 1 — Banco de dados + Hook + Admin do Catálogo

**Migração SQL** — 2 tabelas:
- `trade_materiais` (id, nome, descricao, categoria, foto_url, fotos_extras JSONB, estoque_total, estoque_minimo, max_por_solicitacao, max_por_loja_mes, prazo_entrega, politica_uso, exibir_estoque, permitir_sem_estoque, requer_aprovacao, ativo, created_by, created_at, updated_at)
- `trade_material_solicitacoes` (id, material_id FK, user_id FK, store_id FK, quantidade, observacoes, status ENUM [pendente, aprovado, em_separacao, enviado, entregue, recusado], motivo_recusa, codigo_rastreio, obs_interna, aprovado_por, created_at, updated_at)

**RLS**: Admin CRUD em ambas; usuário SELECT materiais ativos + INSERT/SELECT próprias solicitações.

**Novos arquivos**:
- `src/hooks/useTradeMateriais.ts` — queries + mutations
- `src/pages/trade/TradeMateriaisAdmin.tsx` — tabela de materiais com filtros (categoria, status, estoque)
- `src/components/trade/materiais/MaterialFormDialog.tsx` — form com upload de fotos, campos de estoque/política
- Rota + sidebar + link no TradeAdminModule

### Fase 2 — Landing Page do Usuário

**Novos arquivos**:
- `src/pages/trade/TradeMateriaisCatalogo.tsx` — hero banner, busca pill, chips de categoria, grid de cards (foto, nome, badge estoque, botão "Solicitar")
- `src/components/trade/materiais/MaterialDetailDialog.tsx` — carrossel de fotos, descrição, accordion de políticas, formulário de solicitação (loja, quantidade, observações)
- `src/components/trade/materiais/MinhasSolicitacoes.tsx` — histórico com timeline/stepper de status
- Rota + link no TradeModule

### Fase 3 — Central de Solicitações (Admin)

**Novos arquivos**:
- `src/pages/trade/TradeSolicitacoesAdmin.tsx` — dashboard com KPIs (total, pendentes, em andamento, concluídas) + tabela com filtros avançados
- `src/components/trade/materiais/SolicitacaoDetailDrawer.tsx` — drawer lateral com detalhes + ações (aprovar, recusar com motivo, atualizar status, rastreio) + log de histórico
- Exportação CSV/Excel
- Badge de pendentes no sidebar
- Rota + sidebar

---

## Arquivos alterados (resumo)

| Arquivo | Mudança |
|---|---|
| Migração SQL | 2 tabelas + RLS + enum de status |
| `src/hooks/useTradeMateriais.ts` | Novo — hooks de materiais e solicitações |
| `src/pages/trade/TradeMateriaisAdmin.tsx` | Novo — admin do catálogo |
| `src/components/trade/materiais/MaterialFormDialog.tsx` | Novo — form CRUD |
| `src/pages/trade/TradeMateriaisCatalogo.tsx` | Novo — landing page usuário |
| `src/components/trade/materiais/MaterialDetailDialog.tsx` | Novo — detalhe + solicitação |
| `src/components/trade/materiais/MinhasSolicitacoes.tsx` | Novo — histórico |
| `src/pages/trade/TradeSolicitacoesAdmin.tsx` | Novo — central admin |
| `src/components/trade/materiais/SolicitacaoDetailDrawer.tsx` | Novo — drawer de ação |
| `src/App.tsx` | 3 novas rotas |
| `src/components/dashboard/AppSidebar.tsx` | 2 novos itens no tradeSubMenus |
| `src/pages/modules/TradeAdminModule.tsx` | 2 novos links |
| `src/pages/modules/TradeModule.tsx` | Seção "Catálogo de Materiais" |

Dado o tamanho, recomendo aprovar e implementar **fase por fase**. Posso começar pela Fase 1?

