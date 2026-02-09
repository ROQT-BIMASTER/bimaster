
## Exibir Regra Aplicada Abaixo do Custo Total

### O que sera feito
Adicionar uma linha informativa logo abaixo do card "Custo Total" (na seção Totais) mostrando a regra de markup aplicada de forma clara e visivel.

### Detalhes da implementacao

**Arquivo**: `src/components/fabrica/FichaCustoProdutoEditor.tsx`

Abaixo do grid de totais (depois do card "Custo Total"), sera inserido um texto descritivo com a regra aplicada, por exemplo:

- Se base = `total`: "Markup de 10% aplicado sobre NF + Servico + Condicao"
- Se base = `nf_servico`: "Markup de 10% aplicado sobre NF + Servico"
- Se base = `nf`: "Markup de 10% aplicado somente sobre NF"
- Se base = `servico`: "Markup de 10% aplicado somente sobre Servico"
- Se markup = 0: nenhuma mensagem exibida

A mensagem aparecera como um badge/tag sutil abaixo do grid de totais, dentro do mesmo Card, com icone informativo e estilo `text-muted-foreground` para nao poluir visualmente.

### Escopo
- Alteracao apenas no arquivo `FichaCustoProdutoEditor.tsx`
- Nenhuma mudanca de logica ou banco de dados
