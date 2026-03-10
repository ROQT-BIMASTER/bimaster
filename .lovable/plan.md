

## Plano: Corrigir CORS e Garantir Funcionamento das APIs

### Resultados dos Testes

Ambas as Edge Functions estão **deployed e respondendo**:
- **Pull API** (`contas-pagar-export-api`): Autenticação via `x-api-key` funcionando (401 para chaves inválidas/ausentes)
- **Push** (`erp-export-payment`): Autenticação via JWT funcionando (401 sem Authorization header)
- **Payloads**: Ambos usam o mesmo formato JSON agrupado profissional com `api_version`, `fornecedor`, `documento`, `pagamento`
- **config.toml**: `verify_jwt = false` configurado corretamente para ambas

### Problema Encontrado

Os CORS headers de ambas as funções estão **incompletos**. O SDK do Supabase envia headers `x-supabase-client-*` que não estão listados, o que pode causar falhas de preflight no frontend.

| Função | Headers CORS Atuais | Problema |
|--------|---------------------|----------|
| `erp-export-payment` | `authorization, x-client-info, apikey, content-type` | Falta `x-supabase-client-*` |
| `contas-pagar-export-api` | `authorization, x-client-info, apikey, content-type, x-api-key` | Falta `x-supabase-client-*` |

### Correção

Atualizar os CORS headers de ambas as funções para o padrão completo:

```
authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

### Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/erp-export-payment/index.ts` | Atualizar CORS headers (linha 6) |
| `supabase/functions/contas-pagar-export-api/index.ts` | Atualizar CORS headers (linha 6) |

### Validação

Após as correções, ambas as APIs estarão com:
- Autenticação validada (Push via JWT, Pull via x-api-key)
- CORS completo e compatível com o SDK
- Payload profissional padronizado idêntico
- Tratamento de erros em todas as rotas

