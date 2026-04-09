

# Remover Referências N8N do Portal ERP — Contas a Pagar

## Contexto

O N8N é usado internamente, mas não deve aparecer no Portal ERP (documentação para integradores externos). As referências a N8N estão concentradas em um único arquivo do portal.

## Alterações

### `src/components/erp/ApiDocumentation.tsx`

1. **Exportação ERP (Push)** — linha 514: Trocar `"channel": "n8n"` por `"channel": "rest_api"` no body e response de exemplo
2. **Exportação ERP (Push)** — linha 586: Remover "N8N" da description, mudar de `"Envio direto de pagamentos ao ERP via N8N, REST ou SQL Direct"` para `"Envio direto de pagamentos ao ERP via REST API ou SQL Direct"`
3. **Exportação ERP (Push)** — section description na linha 586: Remover `n8n` dos canais, mudar de `"Canais: n8n, rest_api, sql_direct"` para `"Canais: rest_api, sql_direct"`

Nenhuma alteração no backend (edge functions) ou nos painéis internos de sync — o N8N continua funcionando internamente, apenas sai da documentação pública do Portal ERP.

