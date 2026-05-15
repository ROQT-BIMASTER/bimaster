# PR — IPI ponta-a-ponta + Status na Revisão de Fichas

## Escopo entregue

1. **Migration** `fabrica_empresa_config.incluir_ipi_no_custo boolean DEFAULT false`.
2. **`src/lib/fabrica/pricing-calculator.ts`** — `buscarCustoFichaProduto`:
   - lê `ipi_percentual_saida` e `ipi_valor` (insumos),
   - replica fórmula do hook (`baseIPI = totalNF + markupNF`, soma IPI Kit embutido),
   - quando flag `incluir_ipi_no_custo = true`, soma `totalIPI` ao `custoTotal`,
   - retorna `totais.ipi_percentual / ipi_valor / inclui_ipi` para auditoria.
3. **`src/hooks/useFichaRevisao.ts`** — `submeterFichaUnica` agora persiste
   `snapshot_totais.totalIPI` e `snapshot_totais.ipi_percentual_saida`.
4. **`src/pages/FichaRevisaoDiretoria.tsx`** — coluna **Status** + coluna
   **Aprovada em** quando filtro = `aprovada`. Cards aprovados ficam
   visualmente identificados.
5. **`src/components/fabrica/FichaAnalisePanel.tsx`** — KPI grid passa a 5
   colunas exibindo **IPI Saída (%) → R$**.
6. **`src/components/fabrica/ComposicaoCustoTooltip.tsx`** — linha "IPI Saída"
   no tooltip quando o custo inclui IPI; rótulo "Custo Total (com IPI)".
7. **`src/components/fabrica/ConfiguracaoEmpresaDialog.tsx`** — checkbox
   "Incluir IPI Saída no custo enviado para Tabelas de Preço".

## Compatibilidade / Rollout

- **Default seguro = `false`**. Comportamento de tabelas de preço **não muda**
  até o admin ligar o checkbox em Configuração da Empresa (Fábrica).
- Revisões antigas sem `totalIPI` no snapshot exibem **R$ 0,00** no card IPI
  do painel (fallback). Submissões novas já gravam o campo.
- `CustoComposicao.totais` ganhou 3 campos opcionais — todos os consumidores
  existentes seguem funcionando.

## Plano de validação manual em produção

1. Deploy → confirmar checkbox visível em **Fábrica → Configuração da Empresa**
   (com flag desligada).
2. Abrir **Revisão de Fichas** → filtro "Aprovadas": deve aparecer coluna
   **Status** com badge verde + coluna **Aprovada em**.
3. Abrir uma ficha aprovada → KPI **IPI Saída** visível mesmo com R$ 0,00.
4. Submeter uma nova revisão de teste → conferir no DB:
   `SELECT snapshot_totais->>'totalIPI', snapshot_totais->>'ipi_percentual_saida'`.
5. **Habilitar** a flag em uma empresa piloto → regerar tabela de preços de
   1 produto com IPI; comparar custo antes/depois no `SimuladorImpactoPrecos`.
6. Comunicar diretoria do delta esperado → habilitar global.

**Rollback**: desligar o checkbox (sem migration reversa).

## Verificações de regressão executadas

- Grep `buscarCustoFichaProduto` → todos os consumidores usam apenas
  `custoTotal` e `composicao.totais.*`, retrocompatível.
- Grep `snapshot_totais.custoTotal` → todos os pontos seguem lendo o mesmo
  campo (que agora pode ou não conter IPI conforme a flag no momento do
  submit).

## Pendências / Out of scope

- Recalcular tabelas de preço já geradas (ação manual via "Regerar tabela").
- IPI sobre insumos individuais (`calcularIPILinha` no hook) — não alterado.
- IVA Dual (`fiscal-iva-service.ts`) — sistema paralelo, não interfere.
