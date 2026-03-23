

# De 90 para 100 — Gaps Remanescentes do Portal de Integração

## Avaliacao Atual por Criterio (90/100)

| Criterio | Nota | Gap |
|---|---|---|
| Auth documentada | 9/10 | Falta exemplo de rotacao de chave |
| Health checks | 10/10 | Completo |
| Inicio Rapido | 9/10 | Falta SDK/wrapper oficial |
| Exemplos request/response | 9/10 | Falta glossario de campos para CR e Fornecedores (so tem CP) |
| Tratamento de erros | 7/10 | Falta mapa completo de codigos de erro por endpoint |
| Paginacao | 8/10 | Badges OK, mas falta exemplo de iteracao completa (loop por todas as paginas) |
| Completude | 8/10 | Falta glossario de campos em mais endpoints |
| Postman/Sandbox | 9/10 | Testar funciona, falta collection JSON importavel |
| Webhooks | 9/10 | Falta exemplo de payload completo recebido |
| Versionamento | 2/10 | Todos mostram "v1" hardcoded, sem politica de versionamento documentada |

## 10 Pontos Faltantes

### 1. Glossario de Campos para CR e Fornecedores (+1 pt)
Hoje so existe glossario para CP `/incluir`. Adicionar tabelas campo-a-campo para:
- CR `/incluir` (campos do contas-receber-api)
- Fornecedores `/incluir` (campos do erp-fornecedores-sync)

### 2. Exemplo de Iteracao Completa de Paginacao (+1 pt)
Falta um snippet mostrando como percorrer todas as paginas de uma API paginada (loop `while pagina <= total_de_paginas`). Adicionar em JS e Python na secao de paginacao.

### 3. Mapa de Erros por Endpoint (+1.5 pt)
A secao de erros e generica (400/401/404/429/500). Falta documentar erros especificos por endpoint:
- CP `/incluir`: `fornecedor_nao_encontrado`, `categoria_invalida`, `data_invalida`
- CP `/upsert`: `empresa_id_obrigatorio`, `conflito_integracao`
- CR: erros equivalentes
Implementar como tabela expandivel na secao de autenticacao ou em cada endpoint.

### 4. Collection JSON Importavel (Postman/Insomnia) (+1.5 pt)
O botao "Exportar Excel" existe mas nao e importavel em ferramentas de API. Gerar um JSON no formato OpenAPI 3.0 ou Postman Collection v2.1 que o dev possa importar diretamente.

### 5. Payload de Webhook Documentado (+1 pt)
O catalogo lista eventos mas nao mostra o formato do payload recebido. Adicionar exemplo:
```json
{
  "event": "conta_pagar.criado",
  "timestamp": "2026-03-23T22:00:00Z",
  "data": { "id": "uuid", "valor_documento": 100, ... },
  "signature": "sha256=..."
}
```

### 6. Politica de Versionamento (+1 pt)
Badge "v1" hardcoded sem contexto. Adicionar uma nota explicando: "Todas as APIs estao em v1. Mudancas breaking serao comunicadas com 30 dias de antecedencia e disponibilizadas em /v2."

### 7. Exemplo de Rotacao de API Key (+0.5 pt)
Na secao de autenticacao, adicionar guia de como rotacionar chaves sem downtime (gerar nova → atualizar sistema → desativar antiga).

### 8. Limites e Quotas Consolidados (+0.5 pt)
Espalhados pelo portal. Consolidar numa tabela unica:
- Rate limit: 60 req/min
- Upsert lote: max 500 registros
- Sync: max 5000 registros
- Payload max: 200KB
- Timeout: 30s

### 9. Status Page Consolidada (+0.5 pt)
Os badges de status estao em cada API individualmente. Adicionar uma secao "Status Global" no sidebar que mostre um resumo: X online, Y offline, latencia media.

### 10. Idioma/Traducao da Documentacao (+0.5 pt)
O portal e 100% em portugues. Para nota maxima de conectividade internacional, seria ideal um toggle EN/PT. Mas esse e um gap menor dado o publico-alvo.

---

## Plano de Implementacao (Priorizado)

### Fase 1 — Alto Impacto (itens 1-5)

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**
1. Adicionar glossarios de campos para CR `/incluir` e Fornecedores
2. Adicionar snippet de iteracao de paginacao (JS + Python) na secao "Padroes de Paginacao"
3. Expandir secao de erros com tabela de erros especificos por endpoint
4. Adicionar botao "Exportar Postman Collection" que gera JSON v2.1
5. Adicionar exemplo de payload completo na secao de webhooks

### Fase 2 — Complementos (itens 6-9)

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**
6. Nota de versionamento no header ou changelog
7. Guia de rotacao de chaves na secao de autenticacao
8. Tabela consolidada de limites/quotas
9. Componente de status global no sidebar

### Arquivos Afetados

| Arquivo | Acao |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Glossarios CR/Fornecedores, paginacao iterativa, erros por endpoint, payload webhook, versionamento, quotas, rotacao de chaves |
| `src/components/erp/ApiDocumentation.tsx` | Botao Postman Collection (gera JSON client-side) |
| `src/components/erp/ApiStatusBadge.tsx` | Expor dados para status global (opcional) |

