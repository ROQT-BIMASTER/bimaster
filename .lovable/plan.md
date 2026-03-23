

# Reestruturação AP Module — Plano de Execução

## Escopo

Criar 6 novas páginas + 3 componentes auxiliares. Modificar apenas `App.tsx` (rotas) e `AppSidebar.tsx` (menu).

**Regra zero**: NÃO tocar em ContasAPagar.tsx, ContasPagarGestao.tsx, ContaPagarDetalhe.tsx, ContasPagarAuditoria.tsx, ContasPagarSyncPage.tsx, ConciliacaoBancaria.tsx.

## Arquivos a criar

| # | Arquivo | Linhas est. | Descrição |
|---|---|---|---|
| 1 | `src/pages/financeiro/FilaExportacaoERP.tsx` | ~600 | 3 KPIs + 3 abas (Provisão/Baixa/Histórico) + ações batch + webhook config |
| 2 | `src/pages/financeiro/PainelCentralAP.tsx` | ~800 | 4 KPIs + tabela com Status ERP + filtros + 8 ações por linha (modais) |
| 3 | `src/pages/financeiro/CadastroTituloAP.tsx` | ~500 | Formulário via API (incluir/alterar) + selects via API + sugestão IA + prompt ERP |
| 4 | `src/pages/financeiro/SyncCadastrosAP.tsx` | ~400 | 4 abas sync (Fornecedores/Categorias/Contas/Parcelas) + alertas |
| 5 | `src/pages/financeiro/ConciliacaoManualAP.tsx` | ~350 | Split-view Pluggy vs AP + confirmar/rejeitar/vincular manual |
| 6 | `src/pages/financeiro/RelatorioAPxERP.tsx` | ~400 | KPIs reais + health check + fluxograma SVG + erp_sync_log |
| 7 | `src/components/financeiro/ap/PostPaymentErpPrompt.tsx` | ~60 | Dialog pós-pagamento para enviar baixa ao ERP |
| 8 | `src/components/financeiro/ap/IACategorySuggestion.tsx` | ~50 | Badge "Sugerido por IA" com aceitar/ignorar |
| 9 | `src/components/financeiro/ap/ErpStatusSection.tsx` | ~80 | Timeline de status ERP de um título |

## Arquivos a modificar (mínimo)

### `src/App.tsx`
- Adicionar 6 lazy imports após linha 270
- Adicionar 7 rotas entre linhas 571 e 572 (após auditoria, antes de contas-a-receber)

### `src/components/dashboard/AppSidebar.tsx`
- Adicionar 4 itens no subgrupo `contas` (linhas 551-557): Painel AP Central, Fila Exportação ERP, Sync Cadastros AP, Conciliação Manual
- Adicionar 1 item na seção admin: Relatório AP x ERP

## Padrões técnicos

- Todas as chamadas via `supabase.functions.invoke("nome-funcao", { body: { path: "/endpoint", ...payload } })`
- Exceção: `contas-pagar-export-api` usa `fetch()` com `x-api-key` header
- Valores BRL: `R$ #.###,##` (pt-BR). Datas: `DD/MM/AAAA`
- Paleta: navy #1B2A4A, verde #16A34A, vermelho #DC2626, laranja #EA580C, azul #2563EB, cinza #6B7280
- Skeleton loader, toast em todas as ações, paginação 20/50/100
- Guards: `ScreenRoute screenCode="financeiro_contas_pagar"` para telas AP, `ScreenRoute screenCode="admin"` para relatório

## Ordem de implementação

1. Componentes auxiliares (PostPaymentErpPrompt, IACategorySuggestion, ErpStatusSection)
2. FilaExportacaoERP
3. PainelCentralAP
4. CadastroTituloAP
5. SyncCadastrosAP
6. ConciliacaoManualAP
7. RelatorioAPxERP
8. App.tsx + AppSidebar.tsx (rotas e menu)

