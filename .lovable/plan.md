

# Pontos de Melhoria — Módulo AP

Após análise completa das 6 telas e 3 componentes, identifiquei os seguintes pontos organizados por criticidade.

---

## Problemas Críticos (Funcionalidade Quebrada)

### 1. PainelCentralAP — Status ERP não reflete dados reais
A coluna "Status ERP" exibe `item.erp_status`, mas a API `/listar` da `contas-pagar-api` não retorna esse campo. O badge sempre mostra "Sem Export." para todos os títulos. Precisa fazer um JOIN com `erp_sync_log` ou `erp_export_queue` no backend, ou buscar o status no frontend via query secundária.

### 2. PainelCentralAP — Cancelamento e Estorno não enfileiram para ERP
O plano exige que ao cancelar ou estornar, o sistema automaticamente crie uma entrada na fila de exportação com `export_type: "cancellation"`. As mutations `cancelMutation` e `estornoMutation` não fazem isso — apenas chamam a API e exibem toast.

### 3. CadastroTituloAP — Busca de fornecedor não funciona como select com busca
Atualmente usa dois campos separados (Input de busca + Select). A UX fica quebrada: o usuário digita, mas o Select não reage ao filtro em tempo real. Precisa de um Combobox (Command/Popover) para busca integrada.

### 4. SyncCadastrosAP — Mutations de sync enviam payloads vazios
`syncCCMutation` envia `fin_conta_corrente_cadastro: []` (array vazio). `syncCatMutation` envia `{ sincronizar: true }` que não é um endpoint real. Precisam buscar os dados do ERP primeiro e depois fazer o upsert.

### 5. ConciliacaoManualAP — Falta botão "Vincular a outro título"
O plano exige 3 ações: Confirmar, Rejeitar e "Vincular manualmente a outro título". A terceira ação não foi implementada.

---

## Melhorias de UX Importantes

### 6. PainelCentralAP — Filtros de Categoria/Departamento/Projeto ausentes
O plano especifica selects para categoria, departamento e projeto nos filtros. Atualmente só tem Status, Datas, Fornecedor (texto) e Por Página.

### 7. PainelCentralAP — Modal de pagamento sem campo Portador
O select de conta corrente (portador) existe como state mas não está no JSX do modal.

### 8. CadastroTituloAP — Seção de Parcelamento ausente
O plano exige uma seção "Parcelamento (opcional)" com select de condição via `parcelas-api/listar` e preview de parcelas. Não foi implementada.

### 9. FilaExportacaoERP — Cancelled tab não carrega
A aba "Pendentes Baixa/Cancelamento" só carrega `/paid`. O endpoint `/cancelled` não está sendo chamado nem mesclado na listagem.

### 10. Todas as telas — Sem tratamento de erro 401/429/500
Nenhuma tela implementa redirecionamento em 401, retry com backoff em 429, ou mensagem técnica em 500. O helper `callApi` e `callExportApi` apenas lançam erro genérico.

---

## Melhorias Visuais e de Polimento

### 11. Nenhuma tela usa DashboardLayout
Todas as páginas novas renderizam `<div>` diretamente, sem o layout padrão do sistema (sidebar, header). Apenas `ContaPagarDetalhe.tsx` usa `DashboardLayout`.

### 12. RelatorioAPxERP — Fluxograma SVG não implementado
O plano exige um SVG inline do ciclo de vida do título. Atualmente não há nenhum elemento visual do fluxo.

### 13. SyncCadastrosAP — Sem indicador "Última sincronização"
O plano exige exibir timestamp da última operação de upsert em cada aba.

### 14. Formatação de datas no CadastroTituloAP
Os date inputs usam formato nativo do browser (YYYY-MM-DD), mas a API espera DD/MM/AAAA. A conversão não está sendo feita antes do envio.

---

## Plano de Correção (Ordem de Execução)

1. **PainelCentralAP** — Adicionar query ao `erp_sync_log` por título para status ERP real; adicionar enfileiramento ERP automático em cancel/estorno; adicionar filtros de categoria/departamento/projeto; adicionar campo portador no modal de pagamento
2. **CadastroTituloAP** — Substituir busca de fornecedor por Combobox; adicionar seção de parcelamento; converter formato de datas antes do envio
3. **SyncCadastrosAP** — Corrigir payloads de sync; adicionar timestamp de última sincronização
4. **FilaExportacaoERP** — Mesclar dados de `/cancelled` na aba de baixas
5. **ConciliacaoManualAP** — Adicionar botão "Vincular a outro título" com busca
6. **Todas as telas** — Wrapping em DashboardLayout; tratamento de erros HTTP (401/429/500)
7. **RelatorioAPxERP** — Adicionar SVG do fluxograma

### Arquivos afetados
- `src/pages/financeiro/PainelCentralAP.tsx` — mudanças extensas
- `src/pages/financeiro/CadastroTituloAP.tsx` — mudanças médias
- `src/pages/financeiro/SyncCadastrosAP.tsx` — mudanças médias
- `src/pages/financeiro/FilaExportacaoERP.tsx` — mudanças pequenas
- `src/pages/financeiro/ConciliacaoManualAP.tsx` — mudanças médias
- `src/pages/financeiro/RelatorioAPxERP.tsx` — mudanças pequenas
- Criar `src/lib/utils/api-helpers.ts` — helper centralizado com tratamento 401/429/500

