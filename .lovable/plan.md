

## Validação da Composição de Grade

### O que está funcionando bem

- **Banco de dados**: Tabela `fabrica_produto_grade_itens` com índices corretos, unique constraint `(produto_pai_id, produto_filho_id)`, e RLS ativo.
- **Editor**: Busca com debounce, filtra produto pai e já adicionados, controle de quantidade funcional.
- **Visualização**: Card com modo compacto (badge no Kanban) e modo completo (lista no Sheet) — bem implementado.
- **Persistência**: Padrão delete+reinsert correto na hora de salvar.

### Problemas identificados

1. **Risco de referência circular**: O `ComposicaoGradeEditor` filtra `.neq("tipo", "MP")`, mas **permite adicionar um DISPLAY dentro de outro DISPLAY** — o que criaria uma grade recursiva sem sentido.

2. **Trocar tipo de DISPLAY para ACABADO não limpa os itens de grade**: Se o usuário muda o tipo do produto, os registros em `fabrica_produto_grade_itens` ficam órfãos no banco.

3. **Sem visão reversa**: Ao visualizar um produto acabado, não há indicador de "Este produto faz parte do Display X" — informação importante para rastreabilidade.

4. **Sem thumbnail dos filhos na grade**: A imagem de referência mostra fotos dos produtos na composição. Atualmente só exibe código + nome.

5. **Grade não aparece na listagem/tabela**: Na view de tabela de produtos, não há indicador visual de que um produto é DISPLAY ou quantos itens tem.

### Plano de melhorias

| Melhoria | Arquivo | Ação |
|---|---|---|
| Bloquear DISPLAY dentro de DISPLAY | `ComposicaoGradeEditor.tsx` | Adicionar `.neq("tipo", "DISPLAY")` no filtro de busca |
| Limpar grade ao mudar tipo | `NovoProdutoAcabadoDialog.tsx` | No `onValueChange` do tipo, se sair de DISPLAY, limpar `gradeItems` e deletar do banco se editando |
| Indicador "Usado em Display X" | `ProdutoDetalhesSheet.tsx` | Query reversa em `fabrica_produto_grade_itens` por `produto_filho_id` e mostrar badge/link |
| Thumbnails na grade | `ComposicaoGradeCard.tsx` + `ComposicaoGradeEditor.tsx` | Incluir `foto_url` no select e exibir mini-thumbnail ao lado do nome |
| Badge DISPLAY na tabela | Componente de tabela de produtos | Adicionar badge/ícone quando `tipo === "DISPLAY"` com contagem de itens |

