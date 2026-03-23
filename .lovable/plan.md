

# Análise de Brechas e Avaliação — Módulo AP

## Nota Geral: 7.5 / 10

O módulo está **estruturalmente completo** — todas as 6 telas, 3 componentes auxiliares, rotas e menu foram implementados. A arquitetura de chamadas API, o padrão visual e o fluxo de integração ERP estão coerentes. Porém, existem brechas funcionais e de robustez que impedem a nota máxima.

---

## Brechas Identificadas

### Criticidade Alta (Impactam operação real)

**1. PainelCentralAP — Falta ação "Anexar Comprovante"**
O plano exigia "Anexar Comprovante → drawer com GET /anexos + upload via POST /anexos". O menu de ações (linha 380-409) tem 7 dos 8 itens, mas o upload de comprovantes não foi implementado.

**2. PainelCentralAP — Histórico de Pagamentos sem "Cancelar Pagamento"**
O drawer de pagamentos (linhas 574-602) exibe a tabela, mas falta o botão "Cancelar Pagamento" por linha (POST /cancelar-pagamento com `codigo_baixa`), conforme especificado no plano.

**3. CadastroTituloAP — Validação fraca no formulário**
- `codigo_lancamento_integracao` não valida unicidade nem formato
- `nfe_chave_acesso` aceita qualquer texto (deveria validar 44 dígitos numéricos)
- `valor_documento` aceita zero ou negativo
- Campos obrigatórios (*) não estão sendo checados antes do submit — apenas `saveMutation` falha silenciosamente

**4. ConciliacaoManualAP — Método de pagamento fixo "PIX"**
Tanto o `confirmMutation` (linha 62) quanto o `vincularMutation` (linha 104) hardcodam `metodo_pagamento: "PIX"`. Deveria inferir do tipo de transação Pluggy ou permitir escolha.

**5. SyncCadastrosAP — Aba Parcelas sem botão "Nova Condição"**
O plano exigia modal para POST `parcelas-api/incluir`. Verificando o restante do arquivo, a aba Parcelas provavelmente exibe apenas a tabela sem ação de criação.

**6. FilaExportacaoERP — Reconciliação armazena dados em mutation mas não mostra no modal**
`reconcMutation` (linha 86) chama `/reconciliation` e abre modal, mas o resultado da chamada não é passado ao modal — os dados ficam perdidos. O modal provavelmente está vazio.

### Criticidade Média (UX e completude)

**7. PainelCentralAP — Datas de filtro não convertidas para DD/MM/AAAA**
Os filtros `filtroDataDe` e `filtroDataAte` são enviados no formato nativo `YYYY-MM-DD` do browser (linhas 95-96), mas a API `/listar` espera `DD/MM/AAAA`. A função `dateToApi` existe em `api-helpers.ts` mas não está sendo usada aqui.

**8. PainelCentralAP — Coluna "Origem Baixa" ausente**
O plano exigia coluna `baixa_origem` (pluggy / erp_webhook / manual). A tabela atual (linhas 346-355) não inclui essa coluna.

**9. PainelCentralAP — Coluna "Departamento" ausente**
O plano exigia a coluna `departamento_nome`, mas não está na tabela.

**10. RelatorioAPxERP — Seção export-summary não utilizada**
A query `summary` (linha 53) busca `/export-summary`, mas os dados não são renderizados em nenhum lugar do JSX — os KPIs usam apenas `/reconciliation`.

**11. SyncCadastrosAP — Botões "Incluir Categoria" e "Incluir Grupo" ausentes**
O plano exigia modais para POST `categorias-api/incluir` e `categorias-api/incluir-grupo`. Provavelmente não foram implementados.

**12. Nenhuma tela tem loading state nos botões de filtro**
Ao mudar filtros, a tabela mostra skeleton mas os selects permanecem interativos, podendo causar múltiplas queries simultâneas.

### Criticidade Baixa (Polimento)

**13. Todas as telas — Sem debounce na busca por fornecedor**
O campo de texto "Fornecedor" no PainelCentralAP dispara query a cada keystroke (`onChange`). Deveria ter debounce de 300-500ms.

**14. PainelCentralAP — KPI "Vencidos" exibe valor monetário, não contador**
O plano dizia "contar registros com vencimento < hoje", mas o KPI exibe `formatBRL(resumo?.contaPagar?.vVencido)` — um valor, não uma contagem.

**15. ErpStatusSection — Não usado no PainelCentralAP**
O componente `ErpStatusSection.tsx` existe mas é usado apenas em `ContaPagarDetalhe.tsx`. No Painel, o status ERP é resolvido via query secundária (`erpSyncMap`) — abordagem válida mas duplica lógica.

---

## O que está bem feito

- DashboardLayout em todas as telas
- Status ERP reativo via `erp_sync_log` com query secundária no PainelCentralAP
- Cancelamento e Estorno enfileiram automaticamente para ERP
- Combobox de fornecedor com busca funcional no CadastroTituloAP
- Parcelamento com preview calculado no frontend
- Sugestão IA de departamento com badge aceitar/ignorar
- PostPaymentErpPrompt como dialog reutilizável
- Filtros de Categoria e Departamento adicionados
- Campo Portador no modal de pagamento
- Fluxograma SVG completo no Relatório
- callExportApi com tratamento 401/429/500
- dateToApi helper implementado (mesmo que não usado em todos os lugares)
- FilaExportacaoERP merge `/paid` + `/cancelled`
- ConciliacaoManualAP com "Vincular a outro título" funcional

---

## Plano de Correção (14 itens)

1. **PainelCentralAP** — Adicionar ação "Anexar Comprovante" com drawer + upload
2. **PainelCentralAP** — Adicionar botão "Cancelar Pagamento" por linha no drawer de histórico
3. **PainelCentralAP** — Aplicar `dateToApi()` nos filtros de data antes de enviar
4. **PainelCentralAP** — Adicionar colunas "Departamento" e "Origem Baixa"
5. **PainelCentralAP** — Debounce no campo de busca de fornecedor
6. **CadastroTituloAP** — Validação: NFe 44 dígitos, valor > 0, campos obrigatórios
7. **ConciliacaoManualAP** — Permitir escolha de método de pagamento (não hardcodar PIX)
8. **SyncCadastrosAP** — Adicionar modal "Nova Condição" na aba Parcelas
9. **SyncCadastrosAP** — Adicionar botões "Incluir Categoria" e "Incluir Grupo"
10. **FilaExportacaoERP** — Passar resultado de reconcMutation para o modal
11. **RelatorioAPxERP** — Renderizar dados de `/export-summary` no JSX
12. **PainelCentralAP** — KPI "Vencidos" como contagem de registros, não valor
13. **CadastroTituloAP** — Gerar `codigo_lancamento_integracao` automático se vazio (UUID ou sequencial)
14. **Todas as telas** — Debounce em campos de busca texto

### Arquivos afetados
- `src/pages/financeiro/PainelCentralAP.tsx` — itens 1-5, 12
- `src/pages/financeiro/CadastroTituloAP.tsx` — itens 6, 13
- `src/pages/financeiro/ConciliacaoManualAP.tsx` — item 7
- `src/pages/financeiro/SyncCadastrosAP.tsx` — itens 8, 9
- `src/pages/financeiro/FilaExportacaoERP.tsx` — item 10
- `src/pages/financeiro/RelatorioAPxERP.tsx` — item 11

