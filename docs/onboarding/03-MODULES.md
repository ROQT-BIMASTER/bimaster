---
title: Módulos de negócio
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 03 — Módulos de negócio

Cada subseção lista: **escopo**, **pastas**, **regras-chave**, **referência de memória**.

---

## 3.1 Projetos / PLM

- **Escopo**: criação e gestão de projetos de produto, com tarefas, processos,
  briefing, equipe, copilot, anexos, calendário, kanban.
- **Pastas**: `src/pages/projetos/`, `src/pages/ProjetoHome.tsx`,
  `src/pages/ProjetoInbox.tsx`, `src/components/projetos/` (~80 componentes).
- **Regras**:
  - **Prazo** em tarefa é **obrigatório**.
  - **Criador + admin** sempre veem o projeto; demais via `projeto_membros`.
  - Adição de membros **somente via RPC dedicada** (não insert direto).
  - `useTarefaDensity` — modos `compact`/`comfortable` persistidos em
    `localStorage`.
  - `usePageBgColor` para fundo configurável por página.
  - Copilot do Projeto (Cmd/Ctrl+J): threads e relatórios expiram em 30d se
    `salvo=false`. Ações destrutivas exigem confirmação por senha.
- **Memória**: Project UI Standards, Project Personal Environment, Project
  Team Management, Project Access Visibility, Composition Module Governance,
  Process Permission Matrix, Process Official Folder, Regulatory Approval Logic,
  Copilot Memory & Saved Reports.

---

## 3.2 Trade Marketing

- **Escopo**: PDVs, lojas (CNPJ), bandeiras, vendedores, displays, banners,
  incentivos, materiais, fotos ideais, formulários dinâmicos.
- **Pastas**: `src/pages/trade/`, `src/pages/Trade*.tsx`,
  `src/components/trade/`.
- **Regras**:
  - **Tema rosa `#E91E78`** (via token), bordas 16px, banners 3:1.
  - **CNPJ duplicado por marca** é bloqueado no cadastro de loja.
  - Vendedores vinculados a lojas (PDVs); ver PDV Categories & Management.
  - Formulários dinâmicos com RLS própria + rate-limit por IP.
- **Memória**: Trade Marketing UI, Dynamic Forms RLS, CNPJ Onboarding
  Governance, PDV Categories & Management.

---

## 3.3 Marketing & Influencers

- **Escopo**: planejamento de marca, AI Creative Studio (imagens/vídeos),
  Phyllo (Instagram, TikTok, YouTube), Apify (enrichment), análise 360 de
  influencer, brand safety, ranking autopilot, painéis salvos.
- **Pastas**: `src/pages/marketing/`, `src/pages/Marketing*.tsx`,
  `src/components/marketing/`.
- **Regras**:
  - Geração de mídia via fal.ai (imagens) e modelos do gateway.
  - Brand Safety com fórmula própria (ver memória).
  - Painéis salvos têm escopo pessoal/compartilhado.
- **Memória**: AI Creative Studio, Bimaster Studio, Social Networks Hub
  (Phyllo), Agency Strategy Hub, Influencer 360 Analysis, Influencer
  Intelligence, Influencer Panels.

---

## 3.4 Fábrica / PLM industrial

- **Escopo**: BOM, custo, MRP, fiscal/IVA, NF-e (parser XML), fórmulas,
  margens, ficha de análise, catálogo de produtos, comunicação, máquinas,
  revisões, dashboards executivos.
- **Pastas**: `src/pages/fabrica/`, `src/pages/Fabrica*.tsx`,
  `src/pages/FichaCustoProduto.tsx`, `src/components/fabrica/`,
  `src/lib/fabrica/`.
- **Regras**:
  - **`DecimalInput` com 4 casas** (custo, alíquotas, IVA).
  - **Focus Mode** na Ficha de Análise: 10–11px, padding mínimo.
  - Catálogo: painel esquerdo colapsável; lógica de coluna oculta.
  - Cofre de fichas com snapshots versionados.
- **Memória**: Product Catalog UI, Analysis Sheet Focus Mode, Cost Sheet
  Governance, Fabrica Price Limits Per Table.

---

## 3.5 Financeiro

- **Escopo**: DRE IFRS-18, Chart of Accounts v2 hierárquico, Contas a Pagar
  (AP), Contas a Receber (AR), conciliação bancária, sync com ERP Huggs,
  provisões PDD, projeções de caixa (DPO/DSO), redução de custos com IA,
  Sofia (agente IA), market compliance fiscal.
- **Pastas**: `src/pages/financeiro/`, `src/pages/ContasPagarGestao.tsx`,
  `src/pages/Pagamentos.tsx`, `src/components/financeiro/`,
  `src/components/dre/`, `src/components/conciliacao/`.
- **Regras** (resumo — detalhe em [`09-FINANCE-DEEP-DIVE.md`](./09-FINANCE-DEEP-DIVE.md)):
  - AP/AR pagas/canceladas são **imutáveis**.
  - Telas de governança AP são **admin-only**.
  - Sofia: markdown + Recharts + voz; segue `mem://ai/sofia-agente-financeiro-avancado`.
  - DRE segue IFRS-18 com grupos analíticos próprios.
  - Provisões PDD têm regras contábeis específicas.

---

## 3.6 Operações China–Brasil

- **Escopo**: submissões a fornecedores chineses, fichas de produto, ordens,
  recebimentos, torre de controle de containers, integração Shipsgo, checklist
  de etiqueta/bula.
- **Pastas**: `src/pages/China*.tsx`, `src/pages/ChinaProdutoChecklist.tsx`,
  `src/components/china/`.
- **Regras**:
  - Protocolo de submissão com bloqueios por etapa.
  - Torre de controle integra Shipsgo (containers, BL, ETA).
- **Memória**: International Transit, Asana Sync (algumas tarefas espelhadas),
  Shipsgo (em `src/hooks/useShipsgoIntegration.ts`).

---

## 3.7 Vendas / Sales Intelligence

- **Escopo**: análise de clientes, mapa comercial, dashboards, KPIs, CRM,
  reativação de cliente.
- **Pastas**: `src/pages/AnaliseClientes.tsx`, `src/pages/ComercialMapa.tsx`,
  `src/pages/DetalhamentoVendas.tsx`, `src/pages/ClientReactivation.tsx`,
  `src/components/comercial/`, `src/components/clientes-dashboard/`,
  `src/components/crm/`.
- **Memória**: Sales Intelligence Formulas.

---

## 3.8 Portal Cliente

- **Escopo**: portal externo (preços, anexos) acessado por clientes via token.
- **Pastas**: `src/pages/PortalCliente.tsx`, `src/pages/portal/`,
  `src/components/portal/`.
- **Regras**:
  - Acesso somente leitura, escopo restrito por cliente.
  - Sidebar isolada (Portal só vê seu menu) — ver Sidebar Isolation.

---

## 3.9 Admin

- **Escopo**: configurações de acesso, permissões por módulo, custos de
  tecnologia, visibilidade de tarefas, MFA, segurança, integração Shipsgo,
  visibilidade ERP.
- **Pastas**: `src/pages/admin/`, `src/pages/dashboard/configuracoes/`,
  `src/pages/security/`, `src/components/admin/`,
  `src/components/configuracoes-acesso/`.
- **Regras**:
  - **Impersonation**: admin pode atuar como outro usuário com filtros UI por
    papel.
  - Telas AP de governança: **admin-only enforce**.
- **Memória**: Impersonation System, Admin AP Screens.

---

## 3.10 Central de Trabalho

- **Escopo**: hub pessoal cross-projeto com Copilot Central (Cmd/Ctrl+J),
  inbox, tarefas, preferências.
- **Pastas**: `src/pages/CentralTrabalho.tsx`,
  `src/pages/CentralPreferenciasConfig.tsx`, e componentes em
  `src/components/projetos/` que se aplicam fora de projeto.
- **Memória**: Central Copilot, Command Palette.

---

## 3.11 IA & Copilots transversais

- **Sofia** (financeiro), **Copilot Projeto**, **Copilot Central**,
  **Document Auditor**, **Ingredient Extraction (INCI)**, **Support Assistant**,
  **QA Agent**, **AI Insights**, **AI Filter**, **AI Map CSV Columns**,
  **Auto Classificar Contas**, etc.
- Padrão: ver [`06-AI-AND-COPILOT.md`](./06-AI-AND-COPILOT.md).
