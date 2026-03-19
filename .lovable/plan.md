

# Migration 6: Adicionar colunas ERP à `financial_payment_queue`

A tabela `financial_payment_queue` ainda não possui nenhuma coluna ERP. Com base no que você descreveu até agora e no padrão das outras tabelas, a migration adicionará:

- `titulo_numero` (varchar, nullable) — número do título retornado pelo ERP

Porém, parece que você ainda está listando as colunas uma a uma. Para evitar múltiplas migrations, seria ideal receber a lista completa. Com base no padrão ERP já aplicado nas outras tabelas, as colunas prováveis seriam:

- `erp_titulo_id` (varchar 50) — ID do título no ERP
- `erp_response_code` (varchar 20) — código de resposta do ERP
- `titulo_numero` (varchar) — número do título retornado pelo ERP
- `erp_synced_at` (timestamptz) — última sincronização
- `erp_sync_status` (varchar 20, default 'pending')

**Aguardando confirmação**: por favor envie a lista completa de colunas que deseja adicionar à `financial_payment_queue` para que eu crie uma única migration limpa com todas elas.

