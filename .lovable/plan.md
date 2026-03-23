

# Análise Final de Fragilidades — Nota para 10/10

## Nota Atual: 8.5/10

O módulo está funcional, completo em features e visualmente consistente. Para atingir 10/10, restam fragilidades em **segurança**, **robustez de dados**, **UX edge cases** e **integridade operacional**.

---

## Fragilidades Críticas (Segurança / Integridade de Dados)

### 1. RLS: `erp_sync_log` INSERT permitido apenas para `service_role`
A policy de INSERT na `erp_sync_log` é `TO service_role` (migração `20260319134029`). Todo INSERT feito pelo frontend via `supabase.from("erp_sync_log").insert(...)` usa o role `authenticated` e será **silenciosamente bloqueado pelo RLS**. Isso significa que:
- O botão "Enviar ao ERP" no `PainelCentralAP` (linha 222) falha silenciosamente
- O botão "Enviar ao ERP" no `ContaPagarDetalhe` falha silenciosamente
- Os enfileiramentos automáticos de cancel/estorno (linhas 188-189, 207) falham silenciosamente
- A função `enqueueErpSync` em `api-helpers.ts` falha silenciosamente

**Correção**: Adicionar policy `erp_sync_log_insert_authenticated` para `authenticated` com `WITH CHECK (true)`, ou usar a RPC `fn_enfileirar_erp` que é `SECURITY DEFINER`.

### 2. Storage bucket "comprovantes" pode não existir
O upload de anexos (PainelCentralAP linha 272) referencia `supabase.storage.from("comprovantes")`, mas não há migração criando esse bucket. O upload falhará em produção.

**Correção**: Criar o bucket via migração ou usar um bucket existente como `trade-photos`.

### 3. React key warning no parcPreview
`CadastroTituloAP` linhas 497-501 usa `<>` (Fragment) sem key dentro de um `.map()`. React emitirá warning e pode renderizar incorretamente.

**Correção**: Usar `<Fragment key={p.num}>` em vez de `<>`.

### 4. `callApi` envia body em todas as chamadas — GET endpoints falham
`callApi` usa `supabase.functions.invoke(fn, { body })`, que sempre faz POST. Endpoints GET como `/listar`, `/consultar`, `/parcelas`, `/pagamentos`, `/anexos` não receberão os parâmetros corretamente se a edge function espera query params em GET.

**Correção**: Verificar se a edge function `contas-pagar-api` aceita POST com body para rotas GET (via campo `path`). Se sim, documentar. Se não, adicionar suporte a query params no `callApi`.

### 5. Filtro "Vencidos" KPI baseado na página atual, não no total
O `vencidosCount` (linha 293-296) filtra apenas os itens da página atual (`list`), não o total de registros. Se há 100 vencidos mas a página exibe 20, o KPI mostrará no máximo 20.

**Correção**: Obter contagem de vencidos via query separada ao backend ou via campo do `resumo-financeiro-api`.

---

## Fragilidades Médias (Robustez / UX)

### 6. Nenhuma confirmação antes de ações destrutivas no menu dropdown
Os itens "Enviar ao ERP" e "Estornar Pagamento" no dropdown executam imediatamente sem confirmação. Ações irreversíveis devem ter dialog de confirmação.

### 7. Payment modal sem validação de valor vs. saldo devedor
O modal de pagamento aceita qualquer valor, inclusive maior que o `valor_documento`. Deveria validar `payValor <= item.valor_documento - item.valor_pago`.

### 8. `conciliacoes_bancarias` — query sem filtro de empresa
A query em `ConciliacaoManualAP` (linha 32-42) não filtra por `empresa_id`. Em ambientes multi-empresa, um usuário pode ver conciliações de outras empresas (dependendo do RLS aplicado via `bank_connections`).

### 9. Upload de anexo sem validação de tamanho de arquivo
O input aceita `.pdf,.jpg,.jpeg,.png,.xml` mas não verifica tamanho máximo. Uploads de PDFs de 100MB+ podem travar a UI.

**Correção**: Adicionar `maxSize` check (ex: 10MB) antes de chamar `supabase.storage.upload`.

### 10. `cancelPaymentMutation` não enfileira cancelamento para ERP
Ao cancelar um pagamento individual no drawer de histórico (linha 683), não há chamada a `enqueueErpSync` para notificar o ERP da reversão.

### 11. Debounce no fornecedor do PainelCentralAP, mas não no ConciliacaoManualAP
O campo de busca de título no modal "Vincular outro" (ConciliacaoManualAP linha 293) não tem debounce — dispara query a cada keystroke.

### 12. `parcPreview` não ajusta para condições de pagamento reais
O preview de parcelas no CadastroTituloAP calcula vencimentos com `d.setMonth(d.getMonth() + i)` — sempre mensal. Condições como "30/60/90" ou "à vista + 30" não são respeitadas. O preview é meramente ilustrativo.

### 13. Sem empty state diferenciado para erro de API vs. sem dados
Quando a API retorna erro 500, a tabela mostra "Nenhum título encontrado" — mesmo texto de quando não há dados. Deveria diferenciar erro de carregamento vs. lista vazia.

### 14. Webhook config no FilaExportacaoERP armazena secret em state, não persiste
A seção de webhook (linhas 342-401) tem inputs para URL, secret e eventos, mas ao recarregar a página os valores são perdidos. Deveria carregar config existente e persistir no backend.

---

## Fragilidades Menores (Polimento)

### 15. Data de pagamento no modal sem default "hoje"
O campo `payData` começa vazio. Deveria iniciar com `new Date().toISOString().split("T")[0]`.

### 16. `dateToApi` não é chamado no `payData` do modal de pagamento
A data do pagamento (linha 559) é enviada como `YYYY-MM-DD`, mas a API pode esperar `DD/MM/AAAA`.

### 17. Tabela de parcelas/pagamentos/anexos sem estado vazio explícito
Os Sheets de parcelas/pagamentos/anexos mostram tabela vazia se não há dados — sem mensagem "Nenhuma parcela encontrada".

### 18. Sem loading state no botão "Enviar ao ERP" individual
O dropdown item "Enviar ao ERP" (linha 487) usa `erpExportMutation.mutate` mas não mostra loading indicator — o usuário pode clicar múltiplas vezes.

### 19. `CadastroTituloAP` — código de integração obrigatório mas diz "auto-gerado se vazio"
A validação exige `codigoIntegracao` preenchido (linha 160), mas o placeholder diz "auto-gerado se vazio". Contradição — deveria ou gerar automaticamente OU exigir.

---

## Plano de Correção (19 itens, ordem de prioridade)

| # | Arquivo | Correção |
|---|---------|----------|
| 1 | **Migração SQL** | Criar policy INSERT em `erp_sync_log` para `authenticated`, ou migrar todos os inserts para usar RPC `fn_enfileirar_erp` |
| 2 | **Migração SQL** | Criar storage bucket `comprovantes` (privado, com RLS) |
| 3 | **CadastroTituloAP** | Fix React Fragment key warning no parcPreview |
| 4 | **PainelCentralAP** | KPI "Vencidos" — buscar do `resumo-financeiro-api` em vez de contar na página |
| 5 | **PainelCentralAP** | Validação de valor no modal de pagamento (vs. saldo devedor) |
| 6 | **PainelCentralAP** | Default `payData` para hoje |
| 7 | **PainelCentralAP** | Aplicar `dateToApi` no `payData` antes de enviar |
| 8 | **PainelCentralAP** | Enfileirar ERP em `cancelPaymentMutation` |
| 9 | **PainelCentralAP** | Validação tamanho de arquivo no upload (10MB max) |
| 10 | **PainelCentralAP** | Empty states nos Sheets (parcelas/pagamentos/anexos) |
| 11 | **PainelCentralAP** | Confirmação dialog antes de "Enviar ao ERP" individual |
| 12 | **PainelCentralAP** | Loading indicator no botão "Enviar ao ERP" (desabilitar durante mutação) |
| 13 | **PainelCentralAP** | Diferenciar erro de API vs. lista vazia na tabela |
| 14 | **CadastroTituloAP** | Remover obrigatoriedade do código de integração — gerar automaticamente se vazio |
| 15 | **ConciliacaoManualAP** | Debounce na busca de título no modal "Vincular outro" |
| 16 | **FilaExportacaoERP** | Persistir/carregar config de webhook do backend |
| 17 | **api-helpers.ts** | Documentar que `callApi` sempre usa POST — ou adicionar suporte GET |
| 18 | **ConciliacaoManualAP** | Adicionar filtro `empresa_id` se multi-empresa |
| 19 | **CadastroTituloAP** | Nota visual que preview de parcelas é estimativa |

### Arquivos afetados
- Nova migração SQL (itens 1, 2)
- `src/pages/financeiro/PainelCentralAP.tsx` (itens 4-13)
- `src/pages/financeiro/CadastroTituloAP.tsx` (itens 3, 14, 19)
- `src/pages/financeiro/ConciliacaoManualAP.tsx` (itens 15, 18)
- `src/pages/financeiro/FilaExportacaoERP.tsx` (item 16)
- `src/lib/utils/api-helpers.ts` (item 17)

