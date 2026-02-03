

# Plano: Integracao da Ficha de Custos com Tabelas de Preco

## Resumo

Este plano implementa a integracao entre a Ficha de Custos do Produto e as Tabelas de Preco, permitindo que o custo calculado na ficha seja usado como fonte de custo base na precificacao. Tambem adiciona rastreabilidade completa mostrando a origem e composicao do custo na tabela de precos.

---

## Situacao Atual

### Estrutura de Dados

```text
+---------------------------+          +---------------------------+
|  fabrica_produto_custos   |          |  fabrica_precos_produtos  |
+---------------------------+          +---------------------------+
| - insumos (bulk, emb...)  |          | - custo_base              |
| - custo_nf / servico      |          | - custo_base_origem       |
| - tipo_insumo             |          |   (ordem_producao,        |
+---------------------------+          |    custo_medio, manual,   |
            |                          |    tabela_anterior,       |
            v                          |    custo_origem)          |
+---------------------------+          | - preco_calculado         |
| fabrica_produto_custos_   |          | - preco_final             |
|        config             |          +---------------------------+
+---------------------------+
| - mao_obra_nf             |
| - mao_obra_servico        |
| - markup (%)              |
| - custo_total (calculado) |
+---------------------------+
```

### Problema

O gerador de precos (`GeradorPrecosDialog.tsx`) atualmente oferece as seguintes fontes de custo:
- Ultima Ordem de Producao
- Custo Medio do Produto
- Digitar Manualmente
- Tabela Anterior
- Custo por Origem

**Nao existe opcao para usar a Ficha de Custos** detalhada que o usuario acabou de preencher.

---

## Solucao Proposta

### 1. Nova Fonte de Custo: Ficha de Custos

Adicionar uma nova opcao no gerador de precos para usar o custo calculado da ficha de custos do produto.

### 2. Vinculacao e Rastreabilidade

Armazenar o ID da versao da ficha de custo usada para gerar o preco, permitindo rastrear a origem.

### 3. Historico com Composicao do Custo

Exibir na visualizacao de precos a composicao detalhada do custo (insumos, M.O., markup).

---

## Mudancas no Banco de Dados

### Tabela: fabrica_precos_produtos

Adicionar nova coluna para rastrear a ficha de custo vinculada:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `ficha_custo_config_id` | uuid (FK, nullable) | ID da configuracao da ficha de custo usada |
| `custo_composicao` | jsonb (nullable) | Snapshot da composicao do custo (para historico) |

O campo `custo_composicao` armazenara um JSON com:
```json
{
  "insumos": [
    { "codigo": "BLK001", "nome": "Bulk Essence", "tipo": "bulk", "custo_nf": 12.50, "custo_servico": 0.50 }
  ],
  "mao_obra_nf": 2.00,
  "mao_obra_servico": 1.50,
  "markup_percentual": 10,
  "totais": {
    "subtotal": 16.50,
    "markup": 1.65,
    "custo_total": 18.15
  }
}
```

---

## Mudancas no Codigo

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/fabrica/pricing-calculator.ts` | Adicionar funcao `buscarCustoFichaProduto()` |
| `src/components/fabrica/GeradorPrecosDialog.tsx` | Adicionar opcao "Ficha de Custos" no RadioGroup |
| `src/components/fabrica/VisualizacaoPrecosDialog.tsx` | Exibir composicao do custo quando disponivel |
| `src/components/fabrica/HistoricoPrecoProduto.tsx` | Mostrar origem da ficha de custo na cadeia |

### Novos Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `src/components/fabrica/ComposicaoCustoTooltip.tsx` | Tooltip/Popover mostrando detalhes do custo |

---

## Detalhes da Implementacao

### 1. Nova Funcao no pricing-calculator.ts

```typescript
// Buscar custo da ficha de custos de um produto
export async function buscarCustoFichaProduto(produtoId: string): Promise<{
  custoTotal: number;
  composicao: CustoComposicao | null;
  configId: string | null;
} | null> {
  // Buscar config
  const { data: config } = await supabase
    .from("fabrica_produto_custos_config")
    .select("*")
    .eq("produto_id", produtoId)
    .maybeSingle();

  if (!config) return null;

  // Buscar insumos
  const { data: insumos } = await supabase
    .from("fabrica_produto_custos")
    .select("*")
    .eq("produto_id", produtoId)
    .order("ordem");

  // Calcular totais (mesma logica do useFichaCustoProduto)
  const totalNF = insumos?.reduce((acc, i) => acc + (i.custo_nf || 0), 0) || 0;
  const totalServico = insumos?.reduce((acc, i) => acc + (i.custo_servico || 0), 0) || 0;
  const totalCondicao = insumos?.reduce((acc, i) => acc + (i.custo_condicao || 0), 0) || 0;

  const moNF = config.custo_mao_obra_nf || 0;
  const moServico = config.custo_mao_obra_servico || 0;

  const subtotal = totalNF + totalServico + totalCondicao + moNF + moServico;
  const markup = subtotal * (config.percentual_markup / 100);
  const custoTotal = subtotal + markup;

  return {
    custoTotal,
    composicao: {
      insumos: insumos || [],
      mao_obra_nf: moNF,
      mao_obra_servico: moServico,
      markup_percentual: config.percentual_markup,
      totais: { subtotal, markup, custo_total: custoTotal }
    },
    configId: config.id
  };
}
```

### 2. Atualizacao do GeradorPrecosDialog.tsx

Adicionar nova opcao no RadioGroup:

```typescript
<div className="flex items-center space-x-2">
  <RadioGroupItem value="ficha_custo" id="fonte_ficha" />
  <Label htmlFor="fonte_ficha" className="font-normal cursor-pointer flex items-center gap-2">
    <FileText className="h-4 w-4 text-orange-600" />
    Ficha de Custos do Produto
  </Label>
</div>
```

Atualizar a logica de calculo para usar a nova fonte:

```typescript
// Dentro de calcularPrecosProdutos
else if (opcoes.fonteCusto === 'ficha_custo') {
  const resultado = await buscarCustoFichaProduto(produtoId);
  custoBase = resultado?.custoTotal || 0;
  composicao = resultado?.composicao;
  fichaConfigId = resultado?.configId;
}
```

### 3. Salvamento com Composicao

Ao salvar os precos, incluir a composicao:

```typescript
const registros = precosCalculados.map((preco) => ({
  tabela_id: tabela.id,
  produto_id: preco.produto_id,
  custo_base: preco.custo_base,
  custo_base_origem: fonteCusto,
  preco_calculado: preco.preco_calculado,
  preco_final: preco.preco_final,
  ficha_custo_config_id: preco.ficha_config_id || null,
  custo_composicao: preco.composicao ? JSON.stringify(preco.composicao) : null,
  // ... demais campos
}));
```

### 4. Visualizacao da Composicao

No `VisualizacaoPrecosDialog.tsx`, adicionar icone/botao para ver detalhes:

```typescript
{preco.custo_composicao && (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className="h-6 w-6">
        <Eye className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent>
      <ComposicaoCustoTooltip composicao={preco.custo_composicao} />
    </PopoverContent>
  </Popover>
)}
```

---

## Componente: ComposicaoCustoTooltip

Novo componente para exibir a composicao detalhada do custo:

```typescript
interface ComposicaoCustoTooltipProps {
  composicao: {
    insumos: Array<{ codigo: string; nome: string; tipo: string; custo_nf: number }>;
    mao_obra_nf: number;
    mao_obra_servico: number;
    markup_percentual: number;
    totais: { subtotal: number; markup: number; custo_total: number };
  };
}

// Exibe:
// - Lista de insumos com valores
// - Subtotais (NF, Servico, Condicao)
// - Mao de Obra
// - Markup aplicado
// - Custo Total Final
```

---

## Fluxo do Usuario

```text
1. Usuario abre Ficha de Custos
   |
   v
2. Preenche insumos + M.O. + Markup
   |
   v
3. Salva a Ficha (custo_total = R$ 18,15)
   |
   v
4. Vai para Tabelas de Preco
   |
   v
5. Clica em "Gerar Precos"
   |
   v
6. Seleciona fonte: "Ficha de Custos do Produto" [NOVO]
   |
   v
7. Sistema usa R$ 18,15 como custo base
   |
   v
8. Aplica markup da tabela e gera preco
   |
   v
9. Salva com composicao vinculada
   |
   v
10. Na visualizacao, usuario pode ver a origem/composicao
```

---

## Resultado Esperado

1. Nova opcao "Ficha de Custos do Produto" no gerador de precos
2. Ao selecionar, usa o custo total calculado da ficha
3. Composicao do custo e armazenada junto ao preco
4. Na tabela de precos, icone permite ver a composicao detalhada
5. Historico mostra qual versao da ficha foi usada

---

## Proximos Passos Apos Implementacao

- Alertas quando ficha de custo e atualizada apos geracao de precos
- Recalculo automatico opcional quando ficha muda
- Relatorio de rastreabilidade custo-preco

