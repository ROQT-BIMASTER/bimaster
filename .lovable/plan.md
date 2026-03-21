
# Auditoria APIs ERP — Status: ✅ IMPLEMENTADO

## Resumo das Correções Aplicadas

### Fase 1 — Segurança ✅
1. **Auth centralizado**: `_shared/auth.ts` agora tem `validateErpAuth()` com fallback erp_config → erp_api_keys → env keys
2. **Timing-safe**: Todas as comparações de API key usam `timingSafeEqual`
3. **CORS**: APIs migradas para `_shared/cors.ts` com whitelist de origens
4. **Security headers**: `withSecurityHeaders()` aplicado em todas as respostas

### Fase 2 — Resiliência ✅
5. **Rate limiting**: `checkRateLimit()` adicionado em fornecedores, portadores, plano-contas
6. **Payload limit**: POST /sync em portadores limitado a 5000 registros
7. **Imports padronizados**: Todas as APIs migradas para `npm:@supabase/supabase-js@2`

### Fase 3 — Observabilidade ✅
8. **Response metadata**: `duration_ms` e `processed_at` em todas as respostas das 3 APIs menores
9. **Formato de erro unificado**: `{ error: string, message: string, meta: {...} }`

## Arquivos Modificados

| Arquivo | Mudanças |
|---|---|
| `_shared/auth.ts` | +`validateErpAuth()` com fallback erp_api_keys |
| `_shared/response.ts` | **NOVO** - Helper unificado de response |
| `erp-fornecedores-query/index.ts` | Reescrito: shared auth, CORS, rate limit, security headers, metadata |
| `erp-portadores-api/index.ts` | Reescrito: idem + payload limit 5000 |
| `erp-plano-contas-api/index.ts` | Reescrito: shared auth, CORS, rate limit, metadata |
| `contas-pagar-export-api/index.ts` | timing-safe, CORS, rate limit, security headers |
| `contas-receber-api/index.ts` | Import padronizado, timing-safe em key comparison |
| `estoque-api/index.ts` | Fallback erp_api_keys, timing-safe, CORS, security headers |
| `erp-export-payment/index.ts` | CORS, security headers, import padronizado |
| `contas-pagar-api/index.ts` | Import padronizado, timing-safe no N8N_API_KEY |
