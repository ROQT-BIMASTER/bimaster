

# API Tester — Ambiente de Teste tipo Postman no Portal ERP

## O que será criado

Um componente interativo de teste de API embutido na página do Portal de Integração ERP, entre o card "Testar a API" e a tabela de chaves. Funciona como um mini-Postman onde o usuário pode:

1. Selecionar o método HTTP (GET, POST, PUT, DELETE)
2. Digitar a URL do endpoint (com autocomplete dos endpoints disponíveis)
3. Adicionar headers (x-api-key pré-preenchido, Authorization, Content-Type)
4. Editar o body JSON (para POST/PUT)
5. Adicionar query params
6. Enviar a requisição e ver o response (status, headers, body formatado, tempo de resposta)
7. Ver histórico das últimas requisições

## UI/UX

- Card com título "Testar API" e ícone de terminal
- Barra superior: dropdown de método (colorido como Postman) + input de URL + botão "Enviar"
- Abas abaixo: **Headers** | **Body** | **Params**
- Seção de resposta: status badge colorido (2xx verde, 4xx amarelo, 5xx vermelho), tempo em ms, body JSON com syntax highlight
- Dropdown de endpoints pré-configurados para facilitar testes rápidos
- Headers padrão já incluídos: `x-api-key`, `Content-Type: application/json`

## Implementação

### Arquivo novo
- `src/components/erp/ApiTester.tsx` — Componente completo do testador

### Arquivo modificado
- `src/pages/IntegracaoERP.tsx` — Importar e renderizar `<ApiTester />` entre o card do Postman e a tabela de chaves

### Detalhes técnicos
- Usa `fetch()` direto do browser para chamar as Edge Functions
- Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1`
- Lista de endpoints pré-configurados extraída do `ApiDocumentation.tsx`
- Body editor usa `<Textarea>` com formatação JSON
- Response body renderizado com `JSON.stringify(data, null, 2)` em `<pre>` com estilo mono
- Mede `duration_ms` com `performance.now()`
- Histórico salvo em state local (últimas 10 requisições)

