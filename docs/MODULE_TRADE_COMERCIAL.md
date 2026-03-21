# Módulo: Trade Marketing + Comercial

> **Última atualização:** 2026-03-21 | **Versão:** 2.0.0

---

## 1. Visão Geral

Este documento cobre dois módulos:

1. **Trade Marketing** (`trade`) — Execução de campo, PDVs, fotos, investimentos, campanhas
2. **Comercial** (`comercial`) — Inteligência de mercado, mineração de leads, preços

---

## PARTE A: TRADE MARKETING

### Guard: `moduleCode="trade"` | Rota Base: `/dashboard/trade`

### Hierarquia de Acesso

```
Admin (visão global)
  └─ Gerente (visão regional)
       └─ Supervisor (visão da equipe)
            └─ Vendedor/Promotor (visão própria)
```

Visibilidade filtrada automaticamente por RLS usando árvore recursiva de subordinados.

---

### Rotas Trade (40+ páginas)

#### Hub e Administração

| Rota | Guard | Página |
|------|-------|--------|
| `/dashboard/trade` | Module | `TradeModule` — Hub |
| `/dashboard/trade/admin` | Screen(`trade_admin`) | `TradeAdminModule` — Admin hub |
| `/dashboard/trade/admin/users` | Screen | `TradeAdminUsers` |
| `/dashboard/trade/admin/approval-levels` | Screen | `TradeAdminApprovalLevels` |
| `/dashboard/trade/admin/executivo` | Screen | `TradeExecutiveDashboard` |
| `/dashboard/trade/admin/reports/campaigns` | Screen | `TradeReportCampaigns` |
| `/dashboard/trade/admin/reports/clients` | Screen | `TradeReportClients` |
| `/dashboard/trade/admin/reports/sellers` | Screen | `TradeReportSellers` |

#### Operação de Campo

| Rota | Guard | Página |
|------|-------|--------|
| `/dashboard/trade/stores` | Module | `TradeStores` — PDVs |
| `/dashboard/trade/store-chains` | Module | `TradeStoreChains` — Redes |
| `/dashboard/trade/visits` | Module | `TradeVisits` — Visitas |
| `/dashboard/trade/photos` | Module | `TradePhotos` — Fotos gôndola |
| `/dashboard/trade/competitors` | Module | `TradeCompetitors` — Concorrentes |
| `/dashboard/trade/promotions` | Module | `TradePromotions` — Promoções |
| `/dashboard/trade/insights` | Module | `TradeInsights` — Insights IA |
| `/dashboard/trade/calendar` | Module | `TradeCalendar` — Calendário |
| `/dashboard/trade/ideal-photos` | Module | `TradeIdealPhotos` — Fotos ideais |
| `/dashboard/trade/sellout` | Module | `TradeSellOut` — Sell-out |
| `/dashboard/trade/shelf-measurements` | Module | `TradeShelfMeasurements` — Medições |
| `/dashboard/trade/measurement-guide` | Module | `TradeMeasurementGuide` — Guia |
| `/dashboard/trade/our-brands` | Module | `TradeOurBrands` — Nossas marcas |
| `/dashboard/trade/brand-share` | Module | `TradeBrandShareDashboard` — Brand share |
| `/dashboard/trade/relatorio-competitivo` | Module | `TradeRelatorioCompetitivo` |
| `/dashboard/trade/comparacao-produtos` | Module | `TradeComparacaoProdutos` |
| `/dashboard/trade/performance` | Module | `TradePerformance` |
| `/dashboard/trade/team-performance` | Module | `TradeTeamPerformance` |
| `/dashboard/trade/rewards` | Module | `TradeRewards` — Gamificação |
| `/dashboard/trade/auditorias` | Module | `TradeAuditorias` |
| `/dashboard/trade/minha-equipe` | Module | `TradeSupervisorDashboard` |

#### Financeiro Trade

| Rota | Guard | Página |
|------|-------|--------|
| `/dashboard/trade/financeiro` | Screen(`trade_admin`) | `TradeFinanceiro` |
| `/dashboard/trade/financeiro/dashboard` | Screen | `TradeFinanceiroDashboard` |
| `/dashboard/trade/financeiro/campanhas` | Screen | `TradeCampaigns` |
| `/dashboard/trade/financeiro/campanhas/:id` | Screen | `TradeCampaignDetail` |
| `/dashboard/trade/financeiro/lancamentos-campanhas` | Screen | `TradeLancamentosCampanhas` |
| `/dashboard/trade/financeiro/contas` | Screen | `TradeContasCorrentes` |
| `/dashboard/trade/financeiro/extrato/:accountId` | Screen | `TradeExtratoBancario` |
| `/dashboard/trade/financeiro/verbas` | Screen | `TradeVerbasSemestrais` |
| `/dashboard/trade/financeiro/lancamentos` | Screen | `TradeLancamentos` |
| `/dashboard/trade/financeiro/aprovacoes` | Screen | `TradeAprovacoes` |
| `/dashboard/trade/financeiro/extrato` | Screen | `TradeExtratosPessoais` |
| `/dashboard/trade/aprovacoes` | Screen | `TradeApprovalHub` |
| `/dashboard/trade/campanhas/aprovacoes` | Screen | `TradeAprovarCampanhas` |

---

### Tabelas Trade (~30 tabelas)

#### PDVs e Visitas

| Tabela | Colunas-Chave |
|--------|--------------|
| `trade_pdvs` | id, nome, cnpj, endereco, cidade, uf, rede_id, vendedor_id, supervisor_id, latitude, longitude |
| `trade_pdv_redes` | id, nome, segmento |
| `trade_visits` | id, pdv_id, vendedor_id, data_visita, duracao, status, checklist_completo, observacoes |
| `trade_visit_photos` | id, visit_id, foto_path, tipo, analise_ia |

#### Fotos e Análise IA

| Tabela | Descrição |
|--------|-----------|
| `trade_photos` | Fotos de gôndola/prateleira |
| `trade_photo_analysis` | Resultado da análise IA (produtos, facings, compliance) |
| `trade_ideal_photos` | Fotos de referência (layout ideal) |
| `trade_competitors` | Cadastro de concorrentes |

**Edge Functions de Análise**:

| Function | Descrição |
|----------|-----------|
| `analyze-shelf-photos` | Análise de prateleira (share of shelf) |
| `analyze-competitor-photo` | Identificação de produtos concorrentes |
| `analyze-gondola-competition` | Análise competitiva de gôndola |
| `trigger-photo-queue` | Enfileira análises em lote |
| `process-photo-analysis-queue` | Processa fila de análise |

#### Investimentos e Verbas

| Tabela | Descrição |
|--------|-----------|
| `trade_investments` | Investimentos trade por PDV/período |
| `trade_verbas_semestrais` | Verbas alocadas por semestre |
| `trade_lancamentos` | Lançamentos financeiros trade |
| `trade_contas_correntes` | Contas correntes de clientes/PDVs |
| `trade_extrato` | Extrato de movimentações |

#### Campanhas

| Tabela | Descrição |
|--------|-----------|
| `trade_campaigns` | Campanhas de trade (nome, período, orçamento, status) |
| `trade_campaign_pdvs` | PDVs participantes da campanha |
| `trade_campaign_products` | Produtos da campanha |
| `trade_campaign_results` | Resultados mensurados |

#### Aprovações

| Tabela | Descrição |
|--------|-----------|
| `trade_approval_hub` | Hub centralizado de aprovações |
| `trade_approval_levels` | Níveis de aprovação (valores/alçadas) |
| `trade_approval_history` | Histórico de aprovações |

### Fluxo de Aprovação

```
Lançamento/Campanha/Investimento criado
  │
  ▼
Verificar valor vs alçada do usuário
  │
  ├─ Dentro da alçada → Aprovação automática
  └─ Acima da alçada → Enviar para Approval Hub
       │
       ├─ Supervisor aprova (se dentro de sua alçada)
       ├─ Gerente aprova
       └─ Admin aprova
            │
            └─ Aprovado → Sincroniza registros automaticamente
```

### Financeiro Trade — Dashboard Multi-Tab

```
┌─────────────┬─────────────┬──────────────┐
│ Consolidada │  Clientes   │ Fornecedores │
├─────────────┴─────────────┴──────────────┤
│                                          │
│  Resumo: Orçamento vs Realizado          │
│  Inline expansion por conta              │
│  Modo Foco (fullscreen)                  │
│                                          │
└──────────────────────────────────────────┘
```

---

## PARTE B: MÓDULO COMERCIAL

### Guard: `moduleCode="comercial"` | Rota Base: `/dashboard/comercial`

### Rotas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/dashboard/comercial` | `ComercialModule` | Hub comercial |
| `/dashboard/comercial/lancamentos` | `FabricaLancamentos` | Lançamentos comerciais |
| `/dashboard/comercial/ibge` | `IBGEData` | Dados IBGE |
| `/dashboard/comercial/mineracao` | `LeadMining` | Mineração de leads (CNPJ) |
| `/dashboard/comercial/inteligencia` | `MarketIntelligence` | Inteligência de mercado |
| `/dashboard/comercial/reativacao` | `ClientReactivation` | Reativação de clientes |
| `/dashboard/comercial/mapa` | `ComercialMapa` | Mapa de atuação |
| `/dashboard/comercial/municipios-inteligencia` | `MunicipiosIntelligence` | Inteligência por município |
| `/dashboard/comercial/whitespace` | `WhitespaceAnalysis` | Análise de espaços brancos |

### Tabelas Comerciais

| Tabela | Descrição |
|--------|-----------|
| `ibge_municipios` | Dados demográficos IBGE |
| `ibge_setores_censitarios` | Setores censitários |
| `lead_mining_results` | Resultados de mineração CNPJ |
| `lead_mining_campaigns` | Campanhas de mineração |
| `whitespace_analysis` | Análise de cobertura territorial |

### Edge Functions Comercial

| Function | Descrição |
|----------|-----------|
| `ibge-sync` | Sincroniza dados do IBGE |
| `opencnpj-consulta` | Consulta CNPJ (OpenCNPJ) |
| `cnpjbiz-consulta` | Consulta CNPJ (CNPJ.biz) |
| `google-places-search` | Busca Google Places |
| `geocode-address` | Geocodifica endereço |
| `geocode-batch` | Geocodificação em lote |
| `padronizar-municipio` | Padroniza nomes de municípios |
| `padronizar-nome-cliente` | Padroniza nomes de clientes |

---

## PARTE C: TABELAS DE PREÇOS

### Guard: `moduleCode="precos"` | Rota Base: `/dashboard/precos`

### Rotas

| Rota | Guard | Página |
|------|-------|--------|
| `/dashboard/precos` | Module | `TabelasPrecosModule` — Hub |
| `/dashboard/precos/matriz` | Screen(`precos_matriz`) | `PrecosMatrizComparativa` |
| `/dashboard/precos/tabelas` | Screen(`precos_tabelas`) | `FabricaTabelasPreco` |
| `/dashboard/precos/aprovacao` | Screen(`precos_tabelas`) | `FabricaAprovacaoPrecos` |
| `/dashboard/precos/portal-cliente` | Module | `PortalCliente` |
| `/dashboard/precos/acesso` | Screen(`precos_tabelas`) | `GerenciamentoAcessoPrecos` |
| `/dashboard/precos/simulador` | Screen(`precos_simulador`) | `SimuladorCenariosPrecos` |

### Funcionalidades

- **Matriz Comparativa**: Comparação de preços entre tabelas/períodos
- **Simulador de Cenários**: Simula impacto de alterações de preço
- **Portal do Cliente**: Portal isolado (`/portal`) para clientes consultarem preços
- **Aprovação**: Fluxo de aprovação de alterações de preço
- **Acesso**: Gerenciamento de quem pode ver quais tabelas

**Edge Function**: `price-table-approval` — processa aprovações de tabela de preços.

---

## PARTE D: EVENTOS CORPORATIVOS

### Guard: `moduleCode="eventos"` | Rota Base: `/dashboard/eventos`

| Rota | Página |
|------|--------|
| `/dashboard/eventos` | `CorporateEvents` |
| `/dashboard/eventos/aprovacoes` | `EventsApprovalHub` |
| `/dashboard/eventos/:id` | `CorporateEventDetail` |
| `/dashboard/eventos/dashboard` | `CorporateEventsDashboard` |

---

## Referências

- [Mapa de Módulos](./MODULES_OVERVIEW.md)
- [Módulo Financeiro](./MODULE_FINANCEIRO.md)
- [Infraestrutura](./INFRASTRUCTURE.md)
