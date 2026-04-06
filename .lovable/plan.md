

# Relatório Individual por Plano de Redução

## Objetivo

Criar uma página dedicada de relatório para cada plano de redução, acessível a partir do seletor de planos na tela existente. O relatório mostrará um resumo executivo com KPIs, gráficos de distribuição e detalhamento completo do plano.

## Alterações

### 1. Nova página `src/pages/RelatorioPlanoReducao.tsx`

Página acessível via rota `/dashboard/financeiro/plano-reducao/:planoId` que recebe o ID do plano pela URL e exibe:

**Header do relatório:**
- Nome e descrição do plano (query em `planos_reducao`)
- Data de criação, status do plano
- Botão para exportar PDF/Excel

**KPIs (cards no topo):**
- Total de itens monitorados
- Valor total sob análise (soma `valor_atual`)
- Meta total de economia (soma `meta_reducao_valor`)
- Economia já realizada (soma `resultado_obtido` dos concluídos)
- % de progresso (realizado/meta)
- Itens ativos vs inativos (usando a RPC de métricas)

**Gráficos:**
- Pizza/Donut: distribuição por status (pendente, em andamento, concluído, cancelado)
- Pizza/Donut: distribuição por tipo (eliminar, reduzir, renegociar, monitorar)
- Barras: top 10 fornecedores por valor
- Barras: valor por prioridade (alta, média, baixa)

**Tabela resumo por fornecedor:**
- Fornecedor, valor total, média/mês, último pagamento, status ativo/inativo, substituído por, status da revisão

### 2. Rota no `App.tsx`

Adicionar rota protegida:
```
/dashboard/financeiro/plano-reducao/:planoId → RelatorioPlanoReducao
```

### 3. Botão de acesso em `PlanoReducaoGastos.tsx`

Adicionar um botão "Ver Relatório" ao lado do seletor de planos, que navega para `/dashboard/financeiro/plano-reducao/${selectedPlanoId}`.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/RelatorioPlanoReducao.tsx` | Nova página com relatório completo do plano |
| `src/App.tsx` | Adicionar rota `/dashboard/financeiro/plano-reducao/:planoId` |
| `src/components/financeiro/PlanoReducaoGastos.tsx` | Botão "Ver Relatório" no header |

