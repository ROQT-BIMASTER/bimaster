

# Correção de Endpoints + Fluxogramas na Documentação

## Problemas Encontrados nos Testes

| API | Status Endpoint | Problema |
|---|---|---|
| `contas-correntes-api` | 401 | Auth executada ANTES do roteamento — `/status` bloqueado |
| `lancamentos-cc-api` | 401 | Mesmo problema — auth antes do route matching |
| `orcamentos-caixa-api` | 401 | Mesmo problema — auth antes do route matching |
| `contas-pagar-api` | 401 | Rota `/status` existe mas exige API Key |
| `contas-receber-api` | Retorna dados | Não existe rota `/status` — cai no fallback e retorna dump |
| `contas-pagar-export-api` | 401 | Auth antes do route matching |
| `webhook-dispatcher` | 404 | Não estava deployado (CORRIGIDO) |
| `webhook-subscriptions-api` | 404 | Não estava deployado (CORRIGIDO) |

**Todas as outras 18+ APIs**: Funcionando corretamente (200 OK no `/status`).

## Correções Necessárias

### 1. Fix: Mover `/status` ANTES da autenticação (5 funções)

Para cada função afetada, mover a verificação da rota `/status` para antes do bloco `validateErpAuth`/`validateAnyAuth`:

- **`contas-correntes-api/index.ts`** (linha ~38): Adicionar check de `/status` antes da linha 39
- **`lancamentos-cc-api/index.ts`** (linha ~38): Mesmo padrão
- **`orcamentos-caixa-api/index.ts`** (linha ~37): Mesmo padrão
- **`contas-pagar-api/index.ts`** (linha ~443): Remover `validateApiKey` do bloco `/status`
- **`contas-receber-api/index.ts`**: Adicionar rota `/status` (inexistente hoje)

### 2. Adicionar Fluxogramas por Endpoint na Documentação

Adicionar ao `ApiDocumentation.tsx` um campo `flowchart` nos dados de cada endpoint com texto Mermaid inline. O componente `EndpointCard` renderizará o fluxograma como um diagrama ASCII/visual usando uma representação simplificada (sequência de passos com setas).

**Formato proposto**: Cada endpoint recebe um array `flow` com os passos do fluxo:

```typescript
interface Endpoint {
  // ... existing fields
  flow?: string[]; // Ex: ["Request", "Auth (JWT/API Key)", "Validação", "Query DB", "Response 200"]
}
```

Renderizado como badges conectadas com setas no `EndpointCard`:

```
Request → Auth → Validação → Query DB → Response 200
```

**Fluxos por tipo de endpoint**:
- **GET /listar**: Request → Auth → Rate Limit → Parse Params → Query DB → Paginação → Response 200
- **POST /incluir**: Request → Auth → Rate Limit → Parse Body → Validação → Insert DB → Webhook Event → Response 201
- **PUT /alterar**: Request → Auth → Rate Limit → Parse Body → Find Record → Update DB → Webhook Event → Response 200
- **DELETE /excluir**: Request → Auth → Rate Limit → Find Record → Soft Delete → Webhook Event → Response 200
- **POST /upsert**: Request → Auth → Rate Limit → Parse Body → Conflict Check → Upsert DB → Webhook Event → Response 200
- **POST /upsert-lote**: Request → Auth → Rate Limit → Parse Array → Batch Process → Upsert DB → Response 200
- **GET /status**: Request → Health Check → Response 200

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/contas-correntes-api/index.ts` | Mover `/status` antes de auth |
| `supabase/functions/lancamentos-cc-api/index.ts` | Mover `/status` antes de auth |
| `supabase/functions/orcamentos-caixa-api/index.ts` | Mover `/status` antes de auth |
| `supabase/functions/contas-pagar-api/index.ts` | Liberar `/status` sem auth |
| `supabase/functions/contas-receber-api/index.ts` | Adicionar rota `/status` |
| `supabase/functions/contas-pagar-export-api/index.ts` | Mover `/status` antes de auth |
| `src/components/erp/ApiDocumentation.tsx` | Adicionar fluxogramas inline |

