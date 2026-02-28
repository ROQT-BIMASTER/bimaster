

# Cofre de Documentos — Corrigir listagem de produtos

## Problema identificado

O campo `produto_id` na tabela `fabrica_revisao_documentos` contém o ID da **revisão** (`fabrica_ficha_custo_revisoes`), não o ID direto do produto. O código atual busca nomes em `fabrica_produtos` usando esse ID, mas não encontra nada — por isso aparece "Produto" genérico.

Dados reais:
- `produto_id` do documento = `e41bb853...` → é um ID de `fabrica_ficha_custo_revisoes`
- A revisão aponta para `produto_id` = `6ce32560...` → `CREME DE MÃOS PISTACHILL` em `fabrica_produtos`

## Alterações em `DocumentosCofre.tsx`

1. **Corrigir a busca de nomes de produtos**: Em vez de buscar direto em `fabrica_produtos`, buscar primeiro em `fabrica_ficha_custo_revisoes` para obter o `produto_id` real, depois buscar o nome em `fabrica_produtos`.

2. **Alterar filtro padrão de status**: Mudar de `"aprovado"` para `"all"` para mostrar todos os documentos por padrão (os 2 documentos existentes têm status `"ativo"`).

3. **Manter a hierarquia Produto → MP → Documentos** já implementada, apenas corrigindo a resolução de nomes.

```text
Fluxo corrigido:
fabrica_revisao_documentos.produto_id  (= revisao_id)
  → fabrica_ficha_custo_revisoes.id    (buscar produto_id real)
  → fabrica_produtos.id               (buscar nome + codigo)
```

