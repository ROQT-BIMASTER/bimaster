## Problema diagnosticado

A sincronização do estoque (`erp-sync-engine` → `sync-estoque-full` → tabela `erp_estoque_distribuidora`) traz **9.878 registros**, porém:

- `saldo` está **100% zerado** (deveria conter quantidade física)
- `custo_total` está **100% zerado** (não existe coluna direta na view)
- `valor_venda` está **100% zerado** (não vem na view de estoque)
- `lote`, `validade`, `localizacao` estão **100% vazios** (não existem na view)
- `custo_unitario` é o **único campo populado corretamente** (a partir de `Custo`)

Causa raiz: o `transformEstoque` em `supabase/functions/erp-sync-engine/index.ts` (linha 1023) procura colunas `Saldo`, `Estoque`, `Qtde`, `Quantidade`, `Custo Total`, `Valor Venda`, mas a view `Cust_EstoqueDistribuidora` retorna nomes diferentes:

```
Empresa_Par, Abrev_Par, Cod Produto, NomeProd, NomeLinha, Cod Fabricante,
Custo, Estoque Produto, Estoque Endereço, Estoque Bloqueado Produto,
EstqBloqueado Endereço, Saldo Endereço, Pedido Pendente,
UnidadeMedida, CurvaFisica, CurvaMonetaria, DataUltimaCompra
```

Não há `Valor Venda`, `Lote`, `Validade` nem `Localização` na view — são campos que devem ser tratados como ausentes ou enriquecidos por outra fonte.

## Mudanças propostas

### 1. Migração na tabela `erp_estoque_distribuidora`

Adicionar colunas para cobrir 100% dos dados úteis da view:

- `estoque_endereco` numeric — Saldo no endereço físico
- `estoque_bloqueado_produto` numeric — Bloqueado nível produto
- `estoque_bloqueado_endereco` numeric — Bloqueado nível endereço
- `saldo_endereco` numeric — Saldo total endereço
- `pedido_pendente` numeric — Pedidos a entregar
- `cod_fabricante` text — Código do fabricante
- `nome_linha` text — Linha/marca
- `unidade_medida` text
- `curva_fisica` text — Classificação ABC física
- `curva_monetaria` text — Classificação ABC monetária
- `data_ultima_compra` date

Manter colunas legadas (`valor_venda`, `validade`, `lote`, `localizacao`) — já existem e ficarão `NULL` enquanto a fonte não fornecer (poderão ser preenchidas depois por enriquecimento).

Índices recomendados: `(empresa_par, cod_produto)`, `(curva_monetaria)`, `(saldo)` — para o front filtrar rapidamente por distribuidora, curva ABC e produtos zerados.

### 2. Atualizar `transformEstoque` na edge function

Mapear os nomes reais da view, calcular `custo_total` e capturar todos os campos novos:

```ts
const saldo = parseAmount(row["Estoque Produto"] ?? row["Saldo"] ?? row["Qtde"]);
const custoUnit = parseAmount(row["Custo"]);
return {
  erp_id, empresa_par, abrev_par, cod_produto,
  nome_prod: row["NomeProd"],
  saldo,
  custo_unitario: custoUnit,
  custo_total: (saldo ?? 0) * (custoUnit ?? 0),    // calculado
  valor_venda: null,                                // não existe na view
  estoque_endereco: parseAmount(row["Estoque Endereço"]),
  estoque_bloqueado_produto: parseAmount(row["Estoque Bloqueado Produto"]),
  estoque_bloqueado_endereco: parseAmount(row["EstqBloqueado Endereço"]),
  saldo_endereco: parseAmount(row["Saldo Endereço"]),
  pedido_pendente: parseAmount(row["Pedido Pendente"]),
  cod_fabricante: row["Cod Fabricante"],
  nome_linha: row["NomeLinha"],
  unidade_medida: String(row["UnidadeMedida"] ?? ""),
  curva_fisica: row["CurvaFisica"],
  curva_monetaria: row["CurvaMonetaria"],
  data_ultima_compra: parseDate(row["DataUltimaCompra"]),
  raw: row,
  sincronizado_em: new Date().toISOString(),
};
```

### 3. Atualizar tipagem do hook `useEstoqueErpSync`

Adicionar `valorTotalCusto` derivado de `saldo × custo_unitario` (não mais somente `custo_total` que já estava errado, mas agora correto também). Expor as novas colunas para o futuro front.

### 4. Re-executar `sync-estoque-full`

Após o deploy, disparar a sync para repopular os 9.878 registros com os campos corretos. Confirmar via SQL que `saldo`, `custo_total` e os novos campos estão preenchidos.

## Decisões abertas

- **Valor de venda**: a view de estoque não traz preço de venda. Posso deixar `NULL` por ora, ou puxar de outra view ERP (ex.: tabela de preços) num passo separado. Pergunto antes de incluir essa segunda fonte.
- **Lote/Validade/Localização**: idem. A view atual não traz. Manter colunas para uso futuro com outra fonte.

## Arquivos afetados

- `supabase/functions/erp-sync-engine/index.ts` — `transformEstoque`
- `src/hooks/useEstoqueErpSync.ts` — campos de stats
- 1 migração SQL — novas colunas + índices em `erp_estoque_distribuidora`

## Validação após implementação

1. Disparar `syncFull()` no front
2. Rodar `SELECT COUNT(*) FILTER (WHERE saldo<>0), AVG(custo_total), COUNT(curva_monetaria) FROM erp_estoque_distribuidora`
3. Conferir 3 registros random com `raw` para garantir consistência