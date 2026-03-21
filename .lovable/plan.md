
Objetivo: eliminar o erro “CORS / Network Error” recorrente no API Tester (principalmente nos endpoints de exportação) e fazer o tester mostrar erros reais de API (401/400) em vez de “Failed to fetch”.

1) Diagnóstico confirmado
- O problema não está nos endpoints em si: há registros de `OPTIONS 200` e `GET 401` para `contas-pagar-export-api/reconciliation`.
- Isso indica duas causas combinadas:
  - CORS inconsistente entre funções (lockdown por origem em `_shared/cors.ts` vs respostas com `*` em funções específicas).
  - API Tester enviando headers desnecessários/ vazios (ex.: `x-api-key: ""`, `Content-Type` em GET), o que aumenta preflight e mascara erros.
- Resultado prático: o usuário vê “Failed to fetch” em vários presets, mesmo quando o backend está respondendo.

2) Correção de CORS (backend)
- Arquivo: `supabase/functions/_shared/cors.ts`
- Ajustar a validação de origem para incluir o domínio do ambiente de edição (`*.lovableproject.com`) além de `*.lovable.app|dev`.
- Manter fallback por `ALLOWED_ORIGINS`.
- Garantir que `OPTIONS` continue retornando:
  - `Access-Control-Allow-Origin`
  - `Access-Control-Allow-Headers` (dinâmico)
  - `Access-Control-Allow-Methods`

3) Padronização de resposta nas APIs ERP
- Arquivo: `supabase/functions/contas-pagar-export-api/index.ts`
- Refatorar `jsonResponse` para usar `getCorsHeaders(req)` (em vez de headers hardcoded), garantindo o mesmo comportamento do preflight no response final (200/400/401/500).
- Arquivo: `supabase/functions/contas-pagar-api/index.ts`
- Remover divergência de CORS local e alinhar ao helper compartilhado para evitar comportamento diferente entre APIs irmãs.

4) Correção do API Tester (frontend)
- Arquivo: `src/components/erp/ApiTester.tsx`
- Não enviar headers vazios:
  - se `x-api-key` estiver vazio, não incluir no request.
- Não enviar `Content-Type` para `GET/DELETE` sem body.
- Validar antes de enviar:
  - URL vazia/inválida.
  - endpoints que exigem parâmetro obrigatório (ex.: `conta_pagar_id`) mostrando aviso claro.
- Melhorar tratamento de erro:
  - separar “CORS/preflight bloqueado” de “401 Unauthorized” e “400 campo_obrigatorio”.
  - exibir dica contextual (“Preencha x-api-key”, “Informe conta_pagar_id”, etc.).

5) Critério de aceite
- Presets `Export — Reconciliação`, `History`, `Summary`, `Pending`, `Paid` devem responder com status HTTP real (200/401/400), sem “status 0 / Failed to fetch”.
- Presets de `contas-pagar-api` devem manter comportamento igual.
- Erros de uso (chave ausente, parâmetro faltante) devem aparecer no corpo da resposta, não como erro de rede.

Detalhes técnicos (resumo)
- Causa raiz: política de CORS e montagem do request não padronizadas.
- Solução: unificar CORS no helper compartilhado + higienizar request no tester.
- Impacto: elimina loop de “quase todas com o mesmo erro” e torna o diagnóstico da integração previsível.
