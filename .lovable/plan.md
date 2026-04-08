

# Corrigir API Offline: `contas-receber-api`

## Diagnóstico

O Status Global mostra **36/37 online** com **1 offline**. A API offline é `/contas-receber-api` — ela está documentada no Portal ERP (ApiDocumentation.tsx, linha 578) com endpoints de integração CRUD, mas **a Edge Function nunca foi criada**. O diretório `supabase/functions/` não contém `contas-receber-api/`.

## Solução

Criar a Edge Function `contas-receber-api` seguindo o mesmo padrão arquitetural da `contas-pagar-api` (imports compartilhados, autenticação `validateAnyAuth`, CORS, retry, roteamento por path).

### Endpoints a implementar (conforme documentação existente)

Os endpoints definidos em `contasReceberIntegracao`:
- `GET /consultar` — Consultar título por ID ou código de integração
- `POST /incluir` — Incluir conta a receber
- `PUT /alterar` — Alterar conta a receber
- `DELETE /excluir` — Excluir conta a receber
- `POST /upsert` — Inserir ou atualizar
- `POST /recebimento` — Registrar recebimento
- `GET /status` — Health check (necessário para o api-health-check funcionar)

### Tabela de dados

A função operará sobre a tabela `contas_receber` (se existir) ou será verificada antes da implementação.

### Arquivo

| Arquivo | Ação |
|---|---|
| `supabase/functions/contas-receber-api/index.ts` | Criar — Edge Function completa com CRUD, auth, CORS, health check |

### Resultado esperado

Após deploy, o Status Global passará a mostrar **37/37 online**.

