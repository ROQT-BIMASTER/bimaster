

# Plano: Documentacao Tecnica Completa por Modulos

## Contexto

O sistema BiMaster/Union CRM esta operacional com ~265 rotas, 453 tabelas, 108 Edge Functions e 8 contextos React. A analise do codigo confirma que todos os componentes da Etapa 7 (Central de Inteligencia) estao implementados e funcionais. O trabalho pendente e exclusivamente a criacao da documentacao tecnica detalhada.

## Entregaveis

Criar **7 arquivos Markdown** na pasta `docs/` cobrindo todo o sistema:

### 1. `docs/MODULES_OVERVIEW.md` — Mapa Geral de Modulos
- Lista dos 16+ modulos com codigo, guard type, rota base
- Diagrama de dependencias inter-modulos (ASCII)
- Arvore de contextos React (Auth > Permissions > Impersonation > Empresa > PWA)
- Tabela: modulo x tabelas principais x edge functions x paginas

### 2. `docs/MODULE_CENTRAL_INTELIGENCIA.md` — Central de Inteligencia
- 8 dashboards: PainelExecutivo, PerformanceVendas, AnaliseClientes, DetalhamentoVendas, AnaliseGeografico, AnaliseProdutos, MetasProjecoes, Consolidado
- Para cada: rota, hook, tabela fonte, filtros, graficos, formula receita
- Modelo dimensional: Union (fato) + dim_vendedor + dim_supervisor + dim_empresa
- Views analiticas: vw_dashboard_kpis, vw_receita_empresa, etc.
- Logica de operacoes visiveis (useOperacaoFilter, multipliers)

### 3. `docs/MODULE_FABRICA.md` — Modulo Fabrica
- 16 sub-paginas com screenCode e rota
- ~90 tabelas (prefixo fabrica_): materias-primas, formulas, OPs, qualidade, fiscal, NF-e
- Reforma Tributaria IVA Dual (feature flag, triggers CBS/IBS)
- Fluxo de revisao de fichas e comunicacao
- Edge Functions: extrair-materia-prima-ia, process-nfe-xml, fiscal-iva-api

### 4. `docs/MODULE_CHINA_PROJETOS.md` — China + Projetos + Onboarding Brasil
- Fluxo de submissao China (rascunho > em_revisao > aprovado)
- Caixa de Validacao IA, Cofre do Produto, parse-china-excel
- Governanca Brasil: rodadas aprovacao, assinatura eletronica (bimaster2026)
- Projetos: hierarquia Projeto > Secao > Tarefa, vinculacao modulos
- Pasta Digital TJSP: arvore documental, pareceres departamentais
- Onboarding Brasil (PLM): produtos_brasil, custos, precos, grade

### 5. `docs/MODULE_FINANCEIRO.md` — Modulo Financeiro
- Contas a Pagar: tabelas (contas_pagar, parcelas, pagamentos), RPCs, status lifecycle
- Contas a Receber: tabelas, trigger fn_sync_titulo_receber_status
- Plano de Contas DE-PARA, DRE Analitico, Classificacao IA
- Fluxo de Caixa, Saldos Bancarios, Conciliacao (Pluggy)
- Central de Pagamentos (financial_payment_queue): governanca, aprovacoes
- Integracao ERP bidirecional: contas-pagar-api, erp-webhook-inbound, export

### 6. `docs/MODULE_TRADE_COMERCIAL.md` — Trade Marketing + Comercial
- Trade: 30+ paginas, hierarquia (vendedor < supervisor < gerente < admin)
- Campanhas, verbas, lancamentos, approval hub
- Financeiro Trade: contas correntes, extrato, dashboard
- Fotos PDV, analise IA (shelf, competitor, gondola)
- Comercial: IBGE, mineracao leads, whitespace, reativacao, mapa
- Precos: matriz comparativa, simulador, portal cliente, aprovacao

### 7. `docs/INFRASTRUCTURE.md` — Infraestrutura e Seguranca
- 108 Edge Functions categorizadas (vendas, IA, finance, factory, geo)
- _shared: auth.ts (validateAny), cors, rate-limit, ssrf-guard, timing-safe
- Autenticacao: JWT + API Key + HMAC, account lockout, MFA TOTP
- RLS: 1252 policies, hierarquia roles (admin/supervisor/vendedor/promotor)
- Multi-empresa: EmpresaContext, user_empresas, isolamento RLS
- PWA/Offline: Service Worker, IndexedDB, sync queue
- Integracao n8n: vendas-union-api, contas-pagar-api, estoque-n8n-sync
- Sidebar dinamico: sidebar_categories + sidebar_category_modules

## Detalhes Tecnicos

- Cada arquivo ~800-1500 linhas de Markdown
- Incluir tabelas de referencia rapida (rota | guard | hook | tabela)
- Diagramas ASCII para fluxos criticos
- Listar TODAS as Edge Functions com path, metodo, autenticacao
- Documentar formulas criticas (receita = COALESCE(venda, preco_venda * quantidade, 0))
- Referenciar tabelas reais do banco com colunas principais
- Nao alterar nenhum codigo existente

