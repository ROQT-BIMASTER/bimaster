

# Para chegar a 10/10 — Portal de Integração ERP

## Nota Atual: 8.5/10

## Gaps Identificados

### 1. Sem seção "Getting Started" (impacto alto)
O dev do ERP abre o portal e vê 40+ endpoints sem saber por onde começar. Falta um guia rápido com:
- Como obter a API Key
- Primeiro request (curl de exemplo)
- Convenção de autenticação (x-api-key vs Bearer)
- Rate limits (60 req/min)
- Códigos de erro padrão (401, 429, 400, 404, 500)

### 2. Sem nota sobre convenção POST (impacto médio)
Empresas, Departamentos, Categorias, Projetos usam POST para tudo (padrão Huggs/Omie). Dev REST puro vai estranhar. Precisa de um banner explicativo no topo do módulo "Cadastros Auxiliares" e "Geral".

### 3. Sem catálogo de eventos webhook (impacto médio)
O endpoint `/webhook-subscriptions-api/eventos` retorna a lista, mas o portal não documenta quais eventos existem (ex: `conta_pagar.criado`, `conta_pagar.pago`, `cliente.alterado`). O dev precisa saber quais eventos pode assinar sem fazer um request primeiro.

### 4. Sem guia de paginação (impacto baixo-médio)
Algumas APIs usam `pagina` + `registros_por_pagina`, outras `nPagina` + `nRegPorPagina`, outras `limit` + `offset`. Precisa de uma nota consolidada sobre os padrões de paginação.

### 5. Sem "Ordem Sugerida de Integração" (impacto alto)
O ERP precisa saber: primeiro cadastrar Empresas → Fornecedores → Categorias → Plano de Contas → Portadores → depois Contas a Pagar/Receber → depois Webhooks. Sem isso, o dev pode tentar incluir um título sem ter cadastrado o fornecedor.

## Plano de Ação

### Arquivo: `src/components/erp/ApiDocumentation.tsx`

1. **Adicionar seção "Início Rápido"** no topo (antes dos módulos):
   - Card com 4 passos: Obter Chave → Testar Health Check → Sync Cadastros Base → Integrar Financeiro
   - Tabela de códigos de erro HTTP
   - Nota sobre convenção POST (padrão Huggs)
   - Nota sobre paginação (2 padrões)

2. **Adicionar lista de eventos webhook** na API webhook-subscriptions:
   - Tabela com evento, descrição e payload de exemplo
   - Eventos: conta_pagar.criado/alterado/pago/cancelado, conta_receber.criado/alterado/recebido, cliente.criado/alterado, fornecedor.criado

3. **Adicionar "Ordem de Integração Sugerida"** como diagrama de fluxo no Getting Started:
   ```text
   Empresas → Fornecedores/Clientes → Categorias + Plano de Contas
     → Portadores → Contas a Pagar/Receber → Webhooks
   ```

### Arquivo: `src/components/erp/ApiTester.tsx`
Sem alterações necessárias — já está completo.

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Adicionar Getting Started, catálogo de eventos, nota de convenção POST |

## Resultado Esperado
- Dev do ERP abre o portal → vê exatamente por onde começar
- Entende as convenções sem precisar perguntar
- Sabe quais eventos webhook pode assinar
- Nota final: **9.5-10/10**

