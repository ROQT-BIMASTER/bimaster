

# Mascarar URL do Supabase no API Tester

## Problema

O campo de URL do API Tester exibe a URL real do backend (`https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/...`), permitindo identificar o Supabase. Isso acontece porque o componente usa `BASE_URL` (URL real) tanto para exibição quanto para execução.

## Solução

Criar uma camada de tradução: o usuário vê e edita URLs com `https://api.bimaster.online/v1`, mas internamente o componente converte para a URL real antes de fazer a requisição.

### Arquivo: `src/components/erp/ApiTester.tsx`

1. **Criar constante de exibição**: `const DOC_BASE_URL = "https://api.bimaster.online/v1"`
2. **Estado inicial**: trocar `useState(BASE_URL + "/contas-pagar-api/status")` para usar `DOC_BASE_URL`
3. **Presets**: `handlePreset()` monta URL com `DOC_BASE_URL` em vez de `BASE_URL`
4. **Eventos externos**: quando `ApiDocumentation` envia URL via evento, substituir `BASE_URL` por `DOC_BASE_URL` antes de setar no estado
5. **Envio da requisição**: antes de fazer o fetch, converter `DOC_BASE_URL` de volta para `BASE_URL` na URL
6. **Histórico**: exibir URLs no histórico com `DOC_BASE_URL`
7. **Validação de body**: na função que verifica campos obrigatórios, converter para path relativo corretamente

Resultado: o integrador nunca vê a URL real do Supabase, nem no input, nem no histórico, nem nos presets.

