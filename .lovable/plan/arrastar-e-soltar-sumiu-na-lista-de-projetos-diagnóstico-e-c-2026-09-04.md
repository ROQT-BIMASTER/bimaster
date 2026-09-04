# Arrastar e soltar sumiu na lista de projetos — diagnóstico e correção

## O que foi verificado

Não é permissão de perfil. Não existe nenhuma regra de visibilidade gravada para "mover"
(a única tela com regras é o detalhe de tarefa, e nenhuma delas afeta reordenar), e o
arrastar não consulta papel/role em lugar nenhum.

O arrastar na visão em Lista é desligado silenciosamente em três situações:

1. Qualquer filtro ativo na tela do projeto.
2. Qualquer ordenação diferente da padrão (criação, crescente).
3. Seções com mais de 80 tarefas (a lista passa a ser virtualizada e perde o arrastar).

Nesses casos a alça de arrastar simplesmente não aparece e nenhuma mensagem explica o
motivo — daí a percepção de "a ação não está mais disponível no meu perfil". Como o
filtro/ordenação ficam salvos durante a sessão, quem mexeu uma vez continua sem o recurso.

## O que será feito

1. Indicador claro no cabeçalho da lista quando o arrastar estiver desligado, com o motivo
   ("Reordenação indisponível com filtro/ordenação ativos") e um botão "Restaurar ordem
   padrão" que limpa filtros e volta a ordenação para o padrão, reativando o arrastar na hora.
2. Alça de arrastar visível porém desabilitada (com dica no hover) em vez de simplesmente
   desaparecer, para o usuário entender que o recurso existe.
3. Seções longas: manter o arrastar também acima de 80 tarefas, aplicando o arrastar sobre
   a lista virtualizada; se a performance não permitir, exibir o mesmo aviso explicativo
   com opção de reduzir por filtro. Validação com uma seção grande real antes de fechar.
4. Mesma sinalização aplicada ao reordenar seções, que segue a mesma regra.

## Detalhes técnicos

- `src/components/projetos/ProjetoListView.tsx`: `reorderEnabled` passa a expor também o
  motivo (`filtro` | `ordenacao`), consumido pelo novo aviso; ação de reset chama os
  setters de filtro/ordenação em `ProjetoDetalhe.tsx`.
- `src/components/projetos/ProjetoSecao.tsx`: caminho virtualizado (`VIRTUALIZE_THRESHOLD
  = 80`) passa a suportar `SortableTarefasList`, ou renderiza aviso quando não suportado.
- Nenhuma mudança de permissão, RLS ou banco.
- Teste unitário para a função de decisão (habilitado/motivo) e bump de `APP_VERSION`.
