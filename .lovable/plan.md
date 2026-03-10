

## Plano: Testar, Padronizar e Documentar APIs de Exportação ERP em Configurações

### Problemas Identificados

**1. Inconsistência de payload entre as duas Edge Functions:**
- `contas-pagar-export-api` (Pull API): Inclui campo `id` no payload raiz. Correto.
- `erp-export-payment` (Push): **Falta** o campo `id` no payload. O `paymentQueueId` não é incluído no JSON enviado ao ERP.

**2. Documentação da API de Exportação não existe em Configurações:**
- A aba "Integrações ERP" (`DocumentacaoIntegracaoERP.tsx`) documenta apenas as APIs de **importação** (Contas a Receber, Contas a Pagar, Estoque — ERP → CRM).
- Não há documentação da API de **exportação** de pagamentos (CRM → ERP), que é a `contas-pagar-export-api` (Pull) e `erp-export-payment` (Push).

### O que será feito

**1. Corrigir payload do `erp-export-payment` (Push)**
- Adicionar campo `id: paymentQueueId` ao payload para paridade com a Pull API.

**2. Adicionar nova aba "Exportação ERP" no `DocumentacaoIntegracaoERP.tsx`**
- Expandir o grid de tabs de 6 para 7 colunas.
- Nova aba `exportacao-erp` com documentação completa:
  - **API Pull** (`contas-pagar-export-api`): Endpoints `GET /paid`, `POST /confirm`, `GET /status` com exemplos de payload e curl.
  - **Push automático** (`erp-export-payment`): Explica o fluxo automático ao marcar como pago, canais disponíveis (N8N, REST API), e o payload enviado.
  - **Payload padrão**: Exibir o JSON profissional agrupado (fornecedor, documento, pagamento) com botão de copiar.
  - **Mapeamento de campos**: Tabela com todos os campos, tipos e descrições.
  - **Fluxo recomendado**: Diagrama textual do ciclo Pull (consultar → processar → confirmar).
  - **Autenticação**: `x-api-key` para Pull, JWT para Push.

**3. Testar edge functions via `curl_edge_functions`**
- Testar `contas-pagar-export-api` endpoints (`/paid`, `/status`) para garantir funcionamento.

### Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/erp-export-payment/index.ts` | Adicionar `id` ao payload |
| `src/components/configuracoes/DocumentacaoIntegracaoERP.tsx` | Adicionar aba "Exportação ERP" com documentação Pull + Push |

