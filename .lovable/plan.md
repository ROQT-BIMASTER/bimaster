

# Correcao: Detalhes de Envio/Aprovacao e Erro 404 nos Anexos

## Problema 1: Falta de detalhes sobre quem enviou e quem aprovou

Atualmente, o dialog de "Revisao de Pagamento" mostra dados do fornecedor, valor, vencimento e origem, mas **nao mostra quem solicitou o pagamento nem quem aprovou/revisou**. Os campos `requested_by` e `reviewed_by` existem na tabela `financial_payment_queue` como UUIDs, mas nao sao resolvidos para nomes de perfis.

**Solucao:**
- Modificar o hook `useFinancialPaymentQueue` para fazer uma consulta adicional e resolver os nomes dos usuarios (`requested_by` -> nome, `reviewed_by` -> nome) a partir da tabela `profiles`
- Como nao existe foreign key entre `financial_payment_queue` e `profiles`, faremos a resolucao manualmente: apos buscar os itens, coletamos os IDs unicos de `requested_by` e `reviewed_by`, consultamos a tabela `profiles` uma unica vez, e mapeamos os nomes de volta
- Adicionar uma nova secao no `PaymentReviewDialog` chamada "Rastreabilidade" com:
  - Nome do solicitante e data da solicitacao
  - Nome do revisor, data da revisao e status dado (quando aplicavel)
  - Empresa/filial de origem

---

## Problema 2: Erro 404 ao visualizar arquivo anexo

O erro `{"statusCode":"404","error":"not_found","message":"Object not found"}` ocorre porque a URL publica armazenada no campo `attachments` aponta para um caminho que nao existe no storage.

Investigacao no banco:
- A URL salva aponta para: `.../event-expense-docs/a23aa106-.../arquivo.pdf`
- O arquivo real no storage esta em: `.../event-expense-docs/6055d5a4-.../arquivo.pdf`
- A URL e o caminho nao coincidem

Isso pode ter ocorrido quando a despesa foi editada ou recriada, mas os metadados do anexo mantiveram a URL antiga/incorreta.

**Solucao:**
Em vez de abrir diretamente a URL publica armazenada (que pode estar incorreta ou expirada), o sistema passara a:

1. Extrair o **caminho de storage** a partir da URL armazenada (ex: `a23aa106-.../arquivo.pdf`)
2. Tentar gerar uma **signed URL** usando `supabase.storage.createSignedUrl()` (valida se o arquivo existe)
3. Se falhar (arquivo nao encontrado no caminho), exibir uma mensagem clara ao usuario: "Arquivo nao encontrado no armazenamento"
4. Se funcionar, abrir a signed URL (que e temporaria e mais segura que URLs publicas)

Essa abordagem sera aplicada no `AttachmentAcknowledgement.tsx` (Central de Pagamentos) e tambem poderia ser aplicada nos componentes de anexos de despesas.

---

## Secao Tecnica

### Arquivos a criar

| Arquivo | Descricao |
|---------|-----------|
| `src/lib/utils/storage-url.ts` | Utilitario para extrair path de storage de URLs e gerar signed URLs |

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useFinancialPaymentQueue.ts` | Adicionar resolucao de nomes via `profiles` para `requested_by` e `reviewed_by` |
| `src/components/financeiro/payments/PaymentReviewDialog.tsx` | Adicionar secao "Rastreabilidade" com nomes do solicitante e revisor |
| `src/components/financeiro/payments/AttachmentAcknowledgement.tsx` | Usar signed URL em vez de URL publica direta, com tratamento de erro |

### Detalhes da implementacao

**Hook - resolucao de nomes:**
Apos buscar os itens da fila, coletar todos os IDs unicos de `requested_by` e `reviewed_by`, fazer uma consulta `SELECT id, nome FROM profiles WHERE id IN (...)` e mapear os nomes para `requester_name` e `reviewer_name` em cada item. Isso usa apenas 1 consulta extra independente do numero de itens.

**Dialog - secao de Rastreabilidade:**
Nova Card no dialog mostrando:
- Icone de usuario + "Solicitado por: [Nome]" + data/hora
- Icone de revisao + "Revisado por: [Nome]" + data/hora + status dado
- Informacao da empresa/filial quando disponivel

**Anexos - signed URL com fallback:**
Funcao utilitaria que:
1. Recebe uma URL publica de storage
2. Identifica o bucket (ex: `event-expense-docs`, `department-expense-docs`)
3. Extrai o path relativo
4. Chama `supabase.storage.from(bucket).createSignedUrl(path, 3600)`
5. Retorna a signed URL ou erro

### O que NAO sera alterado

- Nenhuma funcionalidade existente do Dashboard ou Calendario de Contas a Pagar
- Nenhuma tabela de banco sera modificada
- Nenhum fluxo de aprovacao/rejeicao sera alterado
- As queries do `ContasAPagar.tsx` (dashboard, calendario, tabela) permanecem identicas
- Os componentes de upload de anexos permanecem inalterados

