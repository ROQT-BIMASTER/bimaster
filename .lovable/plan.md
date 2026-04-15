

# Correção — Consolidar Serviço e Condição na Importação de Custos dos Filhos

## Problema

Quando um produto DISPLAY importa custos dos filhos (kit), o sistema coloca o custo total inteiro no campo `custo_nf` e zera `custo_servico` e `custo_condicao`:

```typescript
custo_nf: filho.custoTotalLinha,    // tudo aqui
custo_servico: 0,                    // zerado
custo_condicao: 0,                   // zerado
```

O usuário quer que os valores de Serviço e Condição do filho sejam preservados proporcionalmente, refletindo a composição real de custos.

## Solução

### 1. Expandir `CustoFilho` para armazenar breakdown NF/Serviço/Condição

Em `src/hooks/useFichaCustoProduto.ts`, adicionar campos ao interface:

```typescript
export interface CustoFilho {
  // ... campos existentes
  custoNFLinha: number;
  custoServicoLinha: number;
  custoCondicaoLinha: number;
}
```

### 2. Calcular breakdown por categoria no carregamento dos filhos

No bloco que calcula `custoUnit` (linhas 426-441), calcular o total de cada categoria (NF + M.O. + markup proporcional para NF, Serviço + M.O. + markup proporcional para Serviço, Condição + markup proporcional para Condição) e multiplicar pela quantidade:

```typescript
const custoNFFinal = tNF + mNF;
const custoServicoFinal = tServ + mServ;
const custoCondicaoFinal = tCond + mCond;

filhosComCusto.push({
  // ...existentes
  custoNFLinha: custoNFFinal * quantidade,
  custoServicoLinha: custoServicoFinal * quantidade,
  custoCondicaoLinha: custoCondicaoFinal * quantidade,
});
```

### 3. Usar breakdown na importação

Em `importarCustosFilhos` (linhas 472-482), substituir:

```typescript
custo_nf: filho.custoNFLinha,
custo_servico: filho.custoServicoLinha,
custo_condicao: filho.custoCondicaoLinha,
```

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/hooks/useFichaCustoProduto.ts` | Expandir `CustoFilho`, calcular breakdown por categoria, usar na importação |

## Impacto

- A soma `custoNFLinha + custoServicoLinha + custoCondicaoLinha` continua igual a `custoTotalLinha` — zero impacto no custo total
- Os campos Serviço e Condição passam a refletir os valores reais do produto filho em vez de R$ 0,0000

