# Personalizar as colunas de filiais no Estoque do fornecedor

## Situação atual

Na tela **Estoque do fornecedor** já existe um seletor "Todas as filiais" que define quais colunas de filial aparecem na tabela (SP, GYN, UNI, PR, ...) e que a exportação em Excel também respeita. Porém:

- a escolha se perde ao recarregar a página ou ao trocar de tela;
- ela é apagada junto com o botão "Limpar" (que é para filtros de dados, não para preferência de exibição);
- não há atalhos para marcar/desmarcar todas nem busca quando a lista de filiais é longe;
- o nome do botão não deixa claro que ele controla as colunas exibidas.

## O que será feito

1. **Preferência salva por usuário**: a seleção de filiais passa a ser gravada no navegador junto com as demais preferências de colunas da tela, por usuário. Ao voltar à tela, aparecem exatamente as filiais escolhidas.
2. **Seletor mais claro**: o botão passa a se chamar "Filiais exibidas" e mostra a contagem (ex.: "4 de 11 filiais"). Dentro dele:
   - campo de busca rápida por sigla/nome quando houver muitas filiais;
   - ações "Selecionar todas" e "Limpar seleção";
   - opção "Restaurar padrão" (todas as filiais).
3. **Separação entre filtro e exibição**: o botão "Limpar" deixa de zerar a escolha de filiais (que é preferência de exibição); haverá o "Restaurar padrão" dentro do próprio seletor.
4. **Coerência de total e exportação**: a coluna "Total" continua somando apenas as filiais exibidas, e o Excel exportado continua trazendo exatamente as filiais escolhidas, com o resumo por filial correspondente.

## Detalhes técnicos

- `src/pages/estoque/FornecedorEstoquePage.tsx`: mover `distribuidorasSel` para dentro do estado persistido (nova chave `fornecedor-estoque:filiais:v1:<uid>` em `localStorage`, mesmo padrão de `storageKey`), com hidratação no `useEffect` de `uid` e gravação em mudança. Remover `distribuidorasSel` de `limparFiltros` e de `filtrosAtivos`; manter no `filtrosResumo` da exportação.
- Novo componente `src/components/estoque/fornecedor/FiliaisColunasMenu.tsx` com `DropdownMenu` + `Input` de busca + itens `DropdownMenuCheckboxItem` + ações em rodapé, recebendo `distribuidoras`, `selecionadas` e `onChange`.
- `distribuidorasVisiveis`, `colSpan`, cálculo de total por linha e `FornecedorExportButton` continuam usando a mesma derivação já existente — sem mudanças de banco, RPC ou permissões.
