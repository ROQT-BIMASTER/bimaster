

## Corrigir inconsistência de custo entre Ficha e Listagem

### Problema identificado

O campo de custo na **listagem** busca `snapshot_totais.custoTotal`, mas quando a ficha é submetida pela página de Ficha de Custos, o objeto `totais` vem de `calcularCustosTotais()` que usa a chave **`custoFinalTotal`** — chave diferente. Resultado: a listagem não encontra o valor e mostra um valor antigo ou incorreto.

Há dois caminhos de submissão:
- **`useFichaRevisao.submeterParaAprovacao`** → salva `{ ...totais }` com chave `custoFinalTotal`
- **`FichaAnalisePanel.calcularTotaisSimples`** → salva com chave `custoTotal`

### Solução

Normalizar em **2 pontos**:

**1. `src/hooks/useFichaRevisao.ts` — `submeterFichaUnica`** (linha ~173)

Ao montar o `snapshot_totais`, garantir que `custoTotal` sempre exista:
```ts
snapshot_totais: { 
  ...totaisObj, 
  custoTotal: totaisObj.custoTotal ?? totaisObj.custoFinalTotal ?? 0,
  alteracoes_pendentes: alteracoesPendentes 
}
```

**2. `src/pages/FabricaProdutosAcabados.tsx` — `custoTotalMap`** (linha ~163)

Ler com fallback:
```ts
const custo = totais?.custoTotal ?? totais?.custoFinalTotal;
if (custo) map.set(r.produto_id, Number(custo));
```

Mesma correção aplicar em `FichaRevisaoDiretoria.tsx` (linha ~436) e `FichaAnalisePanel.tsx` onde lê `snapshot_totais.custoTotal`.

### Arquivos a alterar

| Arquivo | Alteração |
|---|---|
| `src/hooks/useFichaRevisao.ts` | Adicionar `custoTotal` ao snapshot |
| `src/pages/FabricaProdutosAcabados.tsx` | Fallback `custoFinalTotal` |
| `src/pages/FichaRevisaoDiretoria.tsx` | Fallback `custoFinalTotal` |
| `src/components/fabrica/FichaAnalisePanel.tsx` | Fallback `custoFinalTotal` |

