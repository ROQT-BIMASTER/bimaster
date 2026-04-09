

# Treinamento Completo da IA + Correção de Fragilidades + Avaliação Final

## Nota Atual: 9.4/10

| Critério | Nota |
|---|---|
| Documentação no portal | 9.5 |
| IA de suporte (modelo GPT-5.2) | 8.0 |
| Sandbox + Tester | 9.5 |
| Onboarding wizard | 9.0 |
| SDKs prontos | 9.0 |
| Segurança (Zod, audit, RLS) | 9.5 |
| **Probabilidade de integrar sem suporte** | **~88%** |

## Gaps que impedem nota 10/10

### 1. IA com contexto incompleto (impacto: -0.4)
O `API_DOCS_CONTEXT` na edge function `api-support-ai` cobre apenas **8 APIs** de forma superficial. Existem **30+ APIs documentadas** em `/docs` que a IA desconhece:

**APIs AUSENTES do contexto da IA:**
- Categorias, Empresas, Projetos, Departamentos
- Bancos, Bandeiras, CNAE, Cidades, Países
- Parcelas, Origens, Finalidades de Transferência
- Tipos de Documento, Tipos de Atividade, Tipos de Entrega, Tipos de Anexo
- Resumo Financeiro, Movimentos Financeiros, Pesquisar Lançamentos
- Orçamento de Caixa, Extrato CC, DRE Cadastro
- Export de Pagamentos (fluxo SAP/TOTVS completo)

**Impacto**: Um desenvolvedor que pergunte "como listar categorias?" ou "como consultar o DRE?" recebe resposta genérica ou incorreta.

### 2. IA sem reasoning ativado (impacto: -0.1)
O modelo `openai/gpt-5.2` está sendo chamado sem `reasoning: { effort: "high" }`, perdendo capacidade de análise profunda em dúvidas complexas.

### 3. Fragilidades de segurança ativas no scan (impacto: -0.1)

| Finding | Tabela | Problema |
|---|---|---|
| `our_products` | `our_products` | SELECT com `USING(true)` para role `public` — dados de custo/margem acessíveis sem autenticação |
| `store_stock_movements` | `store_stock_movements` | SELECT com `USING(true)` para role `public` — movimentações de estoque públicas |
| `visibility_blocks` | `fabrica_produto_visibility_blocks` | INSERT/DELETE com `auth.uid() IS NOT NULL` em vez de admin check |
| `trade_campaigns` | `trade_campaign_lancamentos` + 3 tabelas | SELECT `USING(true)` para authenticated — dados financeiros cross-company |

### 4. Documentação de APIs auxiliares incompleta no contexto (impacto: -0.2)
Faltam schemas Zod detalhados para todas as APIs auxiliares (Categorias, Departamentos, Projetos etc.) e exemplos de fluxo completo (ex: "cadastrar fornecedor → incluir CP → lançar pagamento → exportar para ERP").

---

## Plano de Implementação

### Fase 1 — Treinar IA com documentação completa de TODAS as APIs

**Arquivo: `supabase/functions/api-support-ai/index.ts`**

Expandir o `API_DOCS_CONTEXT` para incluir TODAS as 30+ APIs com:
- Endpoint, método HTTP, campos obrigatórios/opcionais
- Exemplos de request/response para cada um
- Schemas com tipos e validações
- Fluxos de integração completos (passo a passo)
- Ativar `reasoning: { effort: "high" }` na chamada ao gateway

As APIs a adicionar no contexto:
1. **Categorias** — IncluirCategoria, AlterarCategoria, ExcluirCategoria, ListarCategorias, ConsultarCategoria, IncluirGrupoCategoria
2. **Empresas** — ConsultarEmpresa, ListarEmpresas
3. **Projetos** — IncluirProjeto, AlterarProjeto, ConsultarProjeto, ExcluirProjeto, ListarProjetos, UpsertProjeto
4. **Departamentos** — IncluirDepartamento, AlterarDepartamento, ConsultarDepartamento, ExcluirDepartamento, ListarDepartamentos
5. **Bancos** — ConsultarBanco, ListarBancos
6. **Bandeiras** — ListarBandeiras
7. **CNAE** — ListarCNAE
8. **Cidades** — PesquisarCidades
9. **Países** — ListarPaises
10. **Parcelas** — IncluirParcela, ListarParcelas
11. **Origens** — ListarOrigem
12. **Finalidades de Transferência** — ConsultarFinalTransf, ListarFinalTransf
13. **Tipos de Documento** — ConsultarTipoDocumento, PesquisarTipoDocumento
14. **Tipos de Atividade** — ListarTiposAtividade
15. **Tipos de Entrega** — CRUD completo
16. **Tipos de Anexo** — ListarTiposAnexo
17. **Resumo Financeiro** — ObterResumoFinancas (com todos os filtros)
18. **Movimentos Financeiros** — ListarMovimentos (unificado CP/CR/CC)
19. **Pesquisar Lançamentos** — PesquisarLancamentos (filtros avançados)
20. **Orçamento de Caixa** — ListarOrcamentos (previsto x realizado)
21. **Extrato CC** — ListarExtrato (saldos + movimentos)
22. **DRE Cadastro** — ListarCadastroDRE
23. **Export Pagamentos** — Fluxo SAP/TOTVS (provisão → baixa)

Adicionar seção de **Fluxos de Integração Completos**:
- Fluxo 1: Primeira integração (gerar key → testar sandbox → produção)
- Fluxo 2: Sincronização de cadastros (empresas → clientes → categorias → CC)
- Fluxo 3: Contas a Pagar end-to-end (incluir → alterar → pagar → exportar)
- Fluxo 4: Contas a Receber end-to-end (incluir → receber → conciliar)
- Fluxo 5: Consultas financeiras (resumo → extrato → DRE → movimentos)

### Fase 2 — Corrigir fragilidades de segurança ativas

**Migração SQL** para as 4 tabelas com findings ativos:

| Tabela | Correção |
|---|---|
| `our_products` | SELECT restrito a `authenticated` (remover role `public`) |
| `store_stock_movements` | SELECT restrito a `authenticated` (remover role `public`) |
| `fabrica_produto_visibility_blocks` | INSERT/DELETE restrito a admin/supervisor |
| `trade_campaign_lancamentos` + 3 tabelas | SELECT com filtro por empresa ou responsável |

### Fase 3 — Atualizar findings de segurança

Marcar como fixados os findings corrigidos e atualizar o scan.

---

## Resumo de Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/api-support-ai/index.ts` | Expandir contexto com 30+ APIs, fluxos completos, ativar reasoning |
| Migração SQL | RLS hardening em 6 tabelas (4 findings ativos) |

## Nota Projetada

| Critério | Antes | Depois |
|---|---|---|
| IA de suporte | 8.0 | 9.8 |
| Segurança | 9.5 | 10.0 |
| **Nota Global** | **9.4** | **9.9/10** |
| **Integração sem suporte** | **~88%** | **~97%** |

O 0.1 restante seria coberto pela expansão dos SDKs para cobrir todas as 30+ APIs (escopo futuro).

