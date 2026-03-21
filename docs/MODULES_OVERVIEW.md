# Mapa Geral de Módulos — BiMaster/Union CRM

> **Última atualização:** 2026-03-21 | **Versão:** 2.0.0

---

## 1. Arquitetura de Contextos React

```
ErrorBoundary
  └─ QueryClientProvider (TanStack Query — staleTime: 5min, gcTime: 10min)
       └─ PWAProvider (Service Worker, install status, offline detection)
            └─ LanguageProvider (i18n — pt-BR, en, es)
                 └─ AuthProvider (session JWT, login/logout, auto-refresh)
                      └─ ThemeProvider (light/dark, CSS custom properties)
                           └─ PermissionsProvider (modules[], screens[], role)
                                └─ ImpersonationProvider (admin "ver como" outro usuário)
                                     └─ EmpresaProvider (multi-empresa, empresa_id ativo)
                                          └─ MeetingRecordingProvider (gravação de reuniões)
                                               └─ TourProvider (onboarding tour com driver.js)
                                                    └─ TooltipProvider + Toasters
                                                         └─ AppContent (BrowserRouter + Routes)
```

### Hierarquia de Guards nas Rotas

```
┌──────────────────────────────────────────────────────────────┐
│  ProtectedRoute — verifica auth.getUser() (sessão JWT)       │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ModuleProtectedRoute — hasModulePermission(moduleCode)  ││
│  │ ┌──────────────────────────────────────────────────────┐ ││
│  │ │ ScreenProtectedRoute — hasScreenPermission(code)    │ ││
│  │ │ ┌────────────────────────────────────────────────┐   │ ││
│  │ │ │ RLS Backend — Row Level Security (1252 rules) │   │ ││
│  │ │ └────────────────────────────────────────────────┘   │ ││
│  │ └──────────────────────────────────────────────────────┘ ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

- **ProtectedRoute**: Sessão JWT ativa obrigatória
- **ModuleProtectedRoute**: Permissão a nível de módulo (tabela `modulos` + `perfil_modulos`)
- **ScreenProtectedRoute**: Permissão granular de tela (tabela `telas` + `perfil_telas`)
- **ClienteProtectedRoute**: Guard isolado para Portal do Cliente

---

## 2. Catálogo de Módulos

| # | Código | Nome | Guard | Rota Base | Páginas |
|---|--------|------|-------|-----------|---------|
| 1 | `prospects` | CRM / Prospects | Module | `/dashboard/prospects` | 6 |
| 2 | `trade` | Trade Marketing | Module | `/dashboard/trade` | 40+ |
| 3 | `marketing` | Marketing Digital | Module | `/dashboard/marketing` | 4 |
| 4 | `fabrica` | Fábrica Brasil | Module+Screen | `/dashboard/fabrica` | 18 |
| 5 | `china` | Fábrica China | Module | `/dashboard/fabrica-china` | 7 |
| 6 | `financeiro` | Financeiro | Module+Screen | `/dashboard/financeiro` | 20+ |
| 7 | `comercial` | Comercial / Inteligência | Module | `/dashboard/comercial` | 8 |
| 8 | `precos` | Tabelas de Preços | Module+Screen | `/dashboard/precos` | 6 |
| 9 | `estoque` | Estoque | Module | `/dashboard/estoque` | 5 |
| 10 | `projetos` | Projetos / PLM | Module | `/dashboard/projetos` | 8 |
| 11 | `eventos` | Eventos Corporativos | Module | `/dashboard/eventos` | 4 |
| 12 | `departamentos` | Departamentos | Module | `/dashboard/departamentos` | 5 |
| 13 | `aprovacao_artes` | Aprovação de Artes | Module | `/dashboard/aprovacao-artes` | 3 |
| 14 | `composicao` | Checklist Composição | Module | `/dashboard/composicao` | 1 |
| 15 | `amostras` | Recebimento de Amostras | Module | `/dashboard/amostras` | 1 |
| 16 | `analise_embalagem` | Análise de Embalagem | Module | `/dashboard/analise-embalagem` | 1 |
| 17 | `etiqueta_bula` | Checklist Etiqueta/Bula | Module | `/dashboard/etiqueta-bula` | 1 |
| 18 | `reunioes` | Reuniões | Module | `/dashboard/reunioes` | 2 |
| 19 | — | Central de Inteligência | Protected | `/dashboard/painel-executivo` | 8 |
| 20 | — | Admin / Configurações | Screen(`admin`) | `/dashboard/configuracoes` | 10+ |

---

## 3. Mapa de Dependências Inter-Módulos

```
                    ┌─────────────────────┐
                    │  AUTH / PERMISSIONS  │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌───────────┐  ┌───────────────┐
        │ PROFILES │  │ EMPRESAS  │  │  USER_ROLES   │
        │ dim_*    │  │ multi-emp │  │  perfil_*     │
        └────┬─────┘  └─────┬─────┘  └───────────────┘
             │              │
    ┌────────┼──────────────┼────────────────────┐
    ▼        ▼              ▼                    ▼
┌────────┐ ┌─────────┐ ┌──────────┐      ┌───────────┐
│PROSPECTS│ │  TRADE  │ │ FÁBRICA  │      │ FINANCEIRO│
│  CRM   │ │Marketing│ │  Brasil  │      │  AP / AR  │
└───┬────┘ └────┬────┘ └────┬─────┘      └─────┬─────┘
    │           │           │                   │
    │     ┌─────┴────┐  ┌───┴──────┐     ┌─────┴──────┐
    │     │CAMPANHAS │  │  CHINA   │     │   DRE /    │
    │     │ VERBAS   │  │ Submiss. │     │  PLANO     │
    │     │ PDV/Fotos│  └───┬──────┘     │  CONTAS    │
    │     └──────────┘      │            └─────┬──────┘
    │                  ┌────┴────┐         ┌───┴───────┐
    │                  │PROJETOS │         │ ERP INTEG │
    │                  │  PLM    │         │ n8n sync  │
    │                  └─────────┘         └───────────┘
    │
    ├──────────────────────────────────────────┐
    ▼                                          ▼
┌───────────────────┐              ┌──────────────────────┐
│ CENTRAL DE        │              │   COMERCIAL          │
│ INTELIGÊNCIA      │              │ IBGE/Leads/Whitespace│
│ (8 dashboards)    │              └──────────────────────┘
│ vendas_union(fato)│
│ dim_vendedor      │
│ dim_supervisor    │
│ dim_empresa       │
└───────────────────┘
```

---

## 4. Módulo × Tabelas Principais × Edge Functions × Hooks

### 4.1 Prospects / CRM

| Tabela | Função | Edge Function |
|--------|--------|---------------|
| `prospects` | Gestão de leads/clientes | — |
| `atividades` | Histórico de interações | — |
| `ai_calls` | Chamadas IA | `process-call-result`, `realtime-call-session` |
| `ai_call_transcriptions` | Transcrições | `meeting-transcribe` |
| `ai_insights` | Insights IA | `ai-insights`, `lead-insight` |

**Hooks**: `useProspects`, `useAtividades`, `useKanban`, `useAICalls`

### 4.2 Trade Marketing

| Tabela | Função | Edge Function |
|--------|--------|---------------|
| `trade_pdvs` | Pontos de venda | `trade-marketing-api` |
| `trade_visits` | Visitas a campo | — |
| `trade_photos` | Fotos de gôndola | `analyze-shelf-photos`, `trigger-photo-queue` |
| `trade_investments` | Investimentos trade | — |
| `trade_campaigns` | Campanhas | — |
| `trade_verbas_semestrais` | Verbas | — |
| `trade_approval_hub` | Aprovações | — |
| `trade_contas_correntes` | Contas financeiras | — |

**Hooks**: `useTradeStores`, `useTradeVisits`, `useTradePhotos`, `useTradeCampaigns`, `useTradeFinanceiro`

### 4.3 Fábrica Brasil

| Tabela | Função | Edge Function |
|--------|--------|---------------|
| `fabrica_materias_primas` | Insumos | `extrair-materia-prima-ia` |
| `fabrica_formulas` | Fórmulas/receitas | — |
| `fabrica_ordens_producao` | Ordens de produção | — |
| `fabrica_nf_entrada` | NFs entrada | `process-nfe-xml` |
| `fabrica_nf_saida` | NFs saída | — |
| `fabrica_tax_rates_iva` | IVA Dual | `fiscal-iva-api` |
| `fabrica_qualidade_*` | Controle de qualidade | — |

**Hooks**: `useMateriasPrimas`, `useFormulas`, `useOrdensProducao`, `useNotasFiscais`

### 4.4 Fábrica China

| Tabela | Função | Edge Function |
|--------|--------|---------------|
| `china_produto_submissoes` | Fichas de produto | `parse-china-excel` |
| `china_produto_documentos` | Documentos anexos | — |
| `china_ordens_compra` | Ordens de compra | — |
| `china_embarques` | Embarques/logística | — |
| `china_doc_revisoes` | Revisões de documentos | — |
| `china_cofre_produto` | Cofre digital | `cofre-share` |

**Hooks**: `useSubmissoes`, `useChinaOrdens`, `useChinaEmbarques`

### 4.5 Financeiro

| Tabela | Função | Edge Function |
|--------|--------|---------------|
| `contas_pagar` | Títulos a pagar | `contas-pagar-api`, `contas-pagar-export-api` |
| `parcelas` | Parcelamento AP | — |
| `pagamentos` | Baixas AP | — |
| `contas_receber` | Títulos a receber | `contas-receber-api`, `n8n-contas-receber` |
| `parcelas_receber` | Parcelamento AR | — |
| `recebimentos` | Baixas AR | — |
| `trade_chart_of_accounts` | Plano de Contas | `erp-plano-contas-api` |
| `financial_payment_queue` | Central de Pagamentos | — |
| `bank_connections` | Conexões bancárias | `pluggy-proxy`, `pluggy-webhook` |

**Hooks**: `useContasPagar`, `useContasReceber`, `usePlanoContas`, `useSaldosBancarios`

### 4.6 Comercial

| Tabela | Função | Edge Function |
|--------|--------|---------------|
| `ibge_municipios` | Dados IBGE | `ibge-sync` |
| `lead_mining_results` | Mineração de leads | `opencnpj-consulta`, `cnpjbiz-consulta` |
| `whitespace_analysis` | Análise de espaços em branco | — |

**Hooks**: `useIBGEData`, `useLeadMining`, `useWhitespace`

### 4.7 Central de Inteligência

| Tabela/View | Dashboard | Hook |
|-------------|-----------|------|
| `vendas_union` / `Union` | Todos | `useVendasUnion` |
| `vw_dashboard_kpis` | Painel Executivo | `useDashboardKPIs` |
| `vw_receita_empresa` | Consolidado | `useReceitaEmpresa` |
| `vw_ranking_supervisores` | Performance | `useRankingSupervisores` |
| `vw_ranking_vendedores` | Performance | `useRankingVendedores` |
| `dim_vendedor` | Todos (filtro) | `useDimensaoVendedores` |
| `dim_supervisor` | Todos (filtro) | `useDimensaoSupervisores` |
| `dim_empresa` | Todos (filtro) | `useDimensaoEmpresas` |
| `metas_vendas` | Metas | `useMetasVendas` |
| `config_tabelas_usuario` | Todos (filtro) | `useConfigTabelasUsuario` |

### 4.8 Projetos / PLM

| Tabela | Função | Edge Function |
|--------|--------|---------------|
| `projetos` | Projetos master | `projeto-ia-assistant`, `projeto-monitor-atrasos` |
| `projeto_secoes` | Seções do projeto | — |
| `projeto_tarefas` | Tarefas | — |
| `produtos_brasil` | Onboarding produto BR | — |
| `produtos_brasil_custos` | Custos do produto | — |
| `produtos_brasil_precos` | Preços do produto | — |

**Hooks**: `useProjetos`, `useProjetoDetalhe`, `useProdutosBrasil`

---

## 5. Rotas Públicas (sem autenticação)

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Index | Landing page |
| `/auth/login` | Auth | Login/Signup |
| `/formulario-equipe` | FormularioEquipe | Formulário público de equipe |
| `/cofre-share` | CofreSharePage | Compartilhamento de cofre |
| `/politica-privacidade` | PoliticaPrivacidade | LGPD |
| `/termos-de-uso` | TermosDeUso | Termos de uso |

---

## 6. Portal do Cliente (isolado)

| Rota | Guard | Página |
|------|-------|--------|
| `/portal` | ClienteProtectedRoute | PortalPrecos |
| `/portal/precos` | ClienteProtectedRoute | PortalPrecos |
| `/portal/perfil` | ClienteProtectedRoute | PortalPerfil |

---

## 7. Sidebar Dinâmico

O menu lateral é montado dinamicamente a partir de duas tabelas:

- **`sidebar_categories`**: categorias do menu (ícone, ordem, colapsável)
- **`sidebar_category_modules`**: vinculação `categoria → módulo` com ordem

Componentes: `AppSidebar.tsx`, `SidebarMenuItems.tsx`
Filtragem automática por `hasModulePermission` e `hasScreenPermission`.

---

## 8. Estatísticas do Sistema

| Métrica | Valor |
|---------|-------|
| Tabelas no banco | ~453 |
| Views | ~20 |
| Funções PostgreSQL | ~254 |
| Políticas RLS | ~1.252 |
| Edge Functions | 108 |
| Páginas React | ~265 |
| Contextos React | 10 |
| Módulos protegidos | 18+ |

---

## Referências Cruzadas

- [Central de Inteligência](./MODULE_CENTRAL_INTELIGENCIA.md)
- [Módulo Fábrica](./MODULE_FABRICA.md)
- [China + Projetos](./MODULE_CHINA_PROJETOS.md)
- [Módulo Financeiro](./MODULE_FINANCEIRO.md)
- [Trade + Comercial](./MODULE_TRADE_COMERCIAL.md)
- [Infraestrutura](./INFRASTRUCTURE.md)
