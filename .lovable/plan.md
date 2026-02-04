
# Plano: Corrigir Corte de Conteúdo no Painel de Produtos Pendentes

## Resumo do Problema
O painel "Produtos Pendentes" está cortando visualmente os nomes dos produtos e os botões "Criar Lançamento" na lateral direita. Isso ocorre devido a um problema de overflow/largura no componente.

## Análise Técnica

### Causa Raiz
O componente `ProdutosPendentesPanel.tsx` possui:
- Largura fixa de 320px (`w-80`)
- Cards internos com `overflow-hidden`
- Porém o conteúdo interno (nomes de produtos, botões) não está respeitando os limites do container

### Problemas Específicos
1. O nome do produto tem `truncate` mas o texto ainda ultrapassa visualmente
2. O botão "Criar Lançamento" está sendo cortado na borda direita
3. Os badges e informações adicionais também podem sofrer corte

## Solução Proposta

### Arquivo: `src/components/fabrica/ProdutosPendentesPanel.tsx`

**Alterações:**

1. **Card do Produto (linhas 143-180)**: Adicionar `overflow-hidden` mais restritivo e garantir que todos os elementos filhos respeitem os limites

2. **Container do nome do produto (linha 149)**: Ajustar para `min-w-0 overflow-hidden` no flex container

3. **Título do produto (linha 150)**: Manter `truncate` e adicionar `max-w-full` para garantir truncamento correto

4. **Botão Criar Lançamento (linhas 171-178)**: Garantir que o texto do botão não ultrapasse os limites com `truncate` e `overflow-hidden`

5. **Área de badges (linhas 153-159)**: Adicionar `flex-wrap` para badges longos e `overflow-hidden` nos containers

### Código Corrigido

```tsx
// Card do produto - linha 143
<div
  key={produto.id}
  className="group p-3 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all"
>
  <div className="flex items-start gap-3 overflow-hidden">
    <ProductThumbnail src={produto.foto_url} size="md" className="flex-shrink-0" />
    <div className="flex-1 min-w-0 overflow-hidden space-y-1">
      <h4 className="font-medium text-sm truncate max-w-full" title={produto.nome}>
        {produto.nome}
      </h4>
      <div className="flex items-center gap-2 text-xs text-muted-foreground overflow-hidden">
        <span className="font-mono truncate">{produto.codigo}</span>
        <span className="flex-shrink-0">•</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">
          {produto.tipo === "ACABADO" ? "Acabado" : "Intermediário"}
        </Badge>
      </div>
      <!-- ... demais elementos ... -->
    </div>
  </div>
  <Button
    size="sm"
    className="w-full mt-3 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 overflow-hidden"
    onClick={() => onCreateLaunch(produto)}
  >
    <Rocket className="h-3.5 w-3.5 flex-shrink-0" />
    <span className="truncate">Criar Lançamento</span>
  </Button>
</div>
```

## Resultado Esperado
- Nomes de produtos longos serão truncados com "..." no final
- Botão "Criar Lançamento" ficará completamente visível
- Todo o conteúdo respeitará os limites do painel de 320px
- Tooltips (via atributo `title`) permitirão ver o nome completo ao passar o mouse

## Impacto
- Apenas visual/UX
- Sem impacto em funcionalidade
- Melhora a experiência em telas menores e com nomes de produtos longos
