## Problema

A Central de Trabalho do Leandro (admin/coordenador) está mostrando **956 tarefas**, sendo que apenas **300** são realmente dele como responsável. As outras 656 vieram porque a regra atual da função `get_minhas_tarefas_central` traz tudo de seções liberadas — e coordenadores são tratados como "liberados em todas as seções".

A mesma inflação aconteceria com qualquer membro adicionado a um projeto sem restrição de seção.

## Princípio acordado

A Central de Trabalho é **estritamente pessoal**. Independe de papel (admin, coordenador, membro amplo): só aparecem tarefas onde o usuário tem responsabilidade direta sobre aquela tarefa específica.

## Regra nova de visibilidade

Tarefa entra na Central somente se:

1. Usuário é o **responsável** da tarefa (`responsavel_id = auth.uid()`), ou
2. Usuário é **colaborador explícito** da tarefa (linha em `projeto_tarefa_colaboradores`)

Removemos a regra (c) que trazia tarefas por liberação de seção / coordenação / acesso amplo. Liberação de seção continua valendo para abrir o projeto e ver o quadro completo lá dentro — só não infla mais a Central pessoal.

## Mudança técnica

Arquivo: nova migration que substitui `public.get_minhas_tarefas_central()`.

```text
SELECT t.*
FROM projeto_tarefas t
WHERE t.excluida_em IS NULL
  AND (
    t.responsavel_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projeto_tarefa_colaboradores c
      WHERE c.tarefa_id = t.id AND c.user_id = auth.uid()
    )
  )
```

- Mantém `SECURITY DEFINER`, `STABLE`, grants apenas para `authenticated`.
- Mantém o cálculo de `papel` (`responsavel` | `colaborador`) e o dedup por id.
- Não altera RLS de `projeto_tarefas`, `projeto_secoes` nem `user_can_access_secao` — essas regras continuam válidas para a navegação dentro do projeto.

## Frontend

`src/hooks/useMinhasTarefas.ts`: ajustar o tipo `papel` para `"responsavel" | "colaborador"` (remove `"liberado"` que não será mais retornado). Nenhuma outra mudança de UI é necessária — os componentes da Central já consomem o hook.

## Validação esperada

Após a migration, simulando para Leandro:
- Antes: 956 tarefas
- Depois: ~300 tarefas (apenas onde é responsável + colaborador)

Para Nathalia: continua vendo as tarefas dela (já estava coberta pela regra de responsável/colaborador, que se mantém).

## Não inclui

- Mudanças em `useProjetoTarefas` / visão dentro do projeto.
- Mudanças em RLS de tabelas.
- Vista alternativa para admin/coordenador (pode ser feita depois como aba separada "Tarefas dos meus projetos", se desejado).
