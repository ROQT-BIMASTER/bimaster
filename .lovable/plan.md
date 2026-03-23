

# Auditoria do Portal de Integração ERP — Análise de Qualidade

## Nota Geral: **8.5 / 10**

O portal é bem estruturado, com fluxogramas, exportação Excel, chat de suporte por endpoint e cobertura ampla. Existem pontos de melhoria específicos abaixo.

---

## Problemas Encontrados

### 1. Duplicidades no ApiTester (Nota: 6/10)

| Problema | Detalhe |
|---|---|
| **Movimentos duplicados** | "Movimentos — Listar CP", "Listar CR", "Listar CC" e "Listar Todos" apontam para o **mesmo path** `/movimentos-financeiros-api/listar` sem body diferenciado no preset |
| **Resumo duplicados** | "Resumo — Em Aberto CP" e "Em Aberto CR" usam o mesmo path `/resumo-financeiro-api/em-aberto` sem distinção |
| **Pesquisar duplicado** | "Pesquisar — Contas a Receber" e "Pesquisar — Contas a Pagar" apontam para o mesmo path `/pesquisar-lancamentos-api/pesquisar` |
| **DRE duplicados** | "DRE — Listar Ativas" e "DRE — Listar Todas" apontam para o mesmo path |
| **Origens duplicados** | "Origens — Listar Todas" e "Listar por Código" apontam para o mesmo path |

**Solução**: Diferenciar os bodies default de cada preset ou unificar em um só com body editável.

### 2. Sobreposição Funcional entre APIs (Nota: 7/10)

| Sobreposição | APIs Envolvidas | Risco para o ERP |
|---|---|---|
| **Webhook Push vs Webhook Subscriptions** | `exportAdvanced` tem `/webhook-push` (em Exportação ERP) E existe `webhook-subscriptions-api/incluir` (em Complementar) | Confusão: 2 formas de configurar webhooks outbound |
| **Fornecedores Query vs Clientes** | `erp-fornecedores-query` lista fornecedores, mas `clientes-api` também gerencia clientes/fornecedores | Precisa nota explicativa de que Clientes = cadastro geral, Fornecedores = subset para AP |
| **Plano de Contas vs Categorias** | `erp-plano-contas-api` e `categorias-api` são entidades diferentes mas podem confundir o ERP | Precisa nota explicativa |

### 3. APIs desnecessárias para o ERP (Nota: 8/10)

Estas APIs são **tabelas de referência estáticas** que raramente mudam e provavelmente o ERP já tem internamente:

| API | Justificativa |
|---|---|
| **CNAE** | Tabela IBGE pública, todo ERP já tem |
| **Cidades** | Tabela IBGE pública |
| **Países** | Lista estática |
| **Bandeiras de Cartão** | Lista estática (Visa, Master, etc.) |
| **Origens de Lançamento** | Interno do BiMaster |

**Sugestão**: Mover para uma seção "Tabelas de Referência (Opcional)" com nota explicativa de que são read-only e opcionais.

### 4. Inconsistências de Convenção HTTP (Nota: 7/10)

| API | Problema | Correto |
|---|---|---|
| Empresas | `POST /consultar`, `POST /listar` | Deveria ser `GET` com query params |
| Departamentos | Tudo é `POST` (incluir, alterar, excluir, listar) | `PUT` para alterar, `DELETE` para excluir, `GET` para listar |
| Categorias | Tudo é `POST` | Idem |
| Projetos | Tudo é `POST` | Idem |

**Nota**: Isso segue o padrão Omie/Huggs (tudo POST), que pode ser intencional para compatibilidade. Se for intencional, adicionar uma nota no portal explicando a convenção.

---

## Sugestões de Melhoria

### Prioridade Alta
1. **Remover `/webhook-push` de `exportAdvanced`** — já existe em `webhook-subscriptions-api`. Ter dois endpoints para a mesma função vai confundir o ERP.
2. **Deduplicar presets no ApiTester** — Unificar os que apontam para o mesmo path, diferenciando apenas o body default.
3. **Adicionar notas explicativas** em "Fornecedores" e "Plano de Contas" esclarecendo a diferença para Clientes e Categorias.

### Prioridade Média
4. **Criar seção "Tabelas de Referência (Opcional)"** para CNAE, Cidades, Países, Bandeiras, Origens — reduz ruído para o dev do ERP.
5. **Adicionar nota sobre convenção POST** nos módulos que seguem padrão Huggs (tudo POST).

### Prioridade Baixa
6. **Versionamento da API** — Adicionar `v1/` nos paths para facilitar evolução futura.

---

## Resumo por Módulo

| Módulo | APIs | Nota | Observação |
|---|---|---|---|
| **Geral** | 5 (Clientes, Fornecedores Q+S, Empresas, Projetos) | 9/10 | Completo e bem documentado |
| **Cadastros Auxiliares** | 14 | 7/10 | Muitas tabelas de referência que o ERP já tem |
| **Finanças** | 10 | 9/10 | Core do sistema, muito bem coberto |
| **Complementar** | 4 (Anexos, Webhooks) | 8/10 | Sobreposição webhook-push |

## Plano de Ação

### Arquivo: `src/components/erp/ApiDocumentation.tsx`
1. Remover endpoint `/webhook-push` de `exportAdvanced` (duplica webhook-subscriptions)
2. Reorganizar Cadastros Auxiliares: separar "Essenciais" (Plano de Contas, Portadores, Categorias, Departamentos, Parcelas, DRE, Bancos) de "Referência Opcional" (CNAE, Cidades, Países, Bandeiras, Origens, Tipos diversos)
3. Adicionar notas explicativas nas APIs de Fornecedores e Plano de Contas

### Arquivo: `src/components/erp/ApiTester.tsx`
1. Deduplicar 10 presets que apontam para o mesmo path (Movimentos, Resumo, Pesquisar, DRE, Origens) — diferenciar pelo body default ou unificar

