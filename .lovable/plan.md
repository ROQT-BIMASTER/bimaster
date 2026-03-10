

## Regra de M.O./Markup para Displays com Produtos Importados do Kit

### Problema Atual
Quando um produto DISPLAY importa custos dos filhos via "Importar do Kit", o custo unitário do filho (`custoUnit`) **já inclui** M.O. NF, M.O. Serviço e Markup do produto filho (linhas 407-418 do hook). Porém, o Display ainda aplica **sua própria** M.O. e Markup por cima, gerando duplicidade.

No caso do HB-573: o custo importado R$ 38,3779 já contém M.O. e Markup do filho, mas o kit ainda soma M.O. NF=0,05 + M.O. Serviço=0,85, inflando o custo.

### Solução

#### 1. Regra no cálculo de totais (`useFichaCustoProduto.ts`)
No `useMemo` de `totais` (linha 157), quando o produto for DISPLAY e **todos** os insumos forem do tipo `importado_kit`, ignorar M.O. NF, M.O. Serviço e Markup do kit — pois já estão embutidos nos custos importados dos filhos.

Se houver insumos mistos (importado_kit + outros tipos como embalagem), aplicar M.O./Markup normalmente apenas sobre os insumos não-kit.

#### 2. Auto-zero na importação (`importarCustosFilhos`)
Após importar os filhos, se **todos** os filhos tinham M.O./Markup preenchidos, auto-zerar `custo_mao_obra_nf`, `custo_mao_obra_servico` e `percentual_markup` da config do Display e salvar, com toast explicativo.

#### 3. Aviso visual no Editor (`FichaCustoProdutoEditor.tsx`)
Na seção "Configuração", quando produto for DISPLAY e houver insumos `importado_kit`, exibir um alerta informativo:
> "Para Displays com produtos importados do Kit, a M.O. e Markup já estão incluídos no custo de cada unidade. Valores de M.O. e Markup nesta configuração serão ignorados para insumos do Kit."

#### 4. Correção dos dados existentes (SQL migration)
Zerar M.O. e Markup em fichas de DISPLAY que possuem insumos `importado_kit` e cujos filhos já têm M.O./Markup configurados:

```sql
UPDATE fabrica_produto_custos_config SET
  custo_mao_obra_nf = 0,
  custo_mao_obra_servico = 0,
  percentual_markup = 0
WHERE produto_id IN (
  SELECT DISTINCT pc.produto_id
  FROM fabrica_produto_custos pc
  JOIN fabrica_produtos p ON p.id = pc.produto_id
  WHERE p.tipo = 'DISPLAY' AND pc.tipo_insumo = 'importado_kit'
);
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---|---|
| `src/hooks/useFichaCustoProduto.ts` | Regra no cálculo de totais + auto-zero na importação |
| `src/components/fabrica/FichaCustoProdutoEditor.tsx` | Alerta visual na configuração |
| Migration SQL | Corrigir dados existentes |

