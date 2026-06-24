# Acesso unificado: Submissão China ↔ Projeto de Desenvolvimento

## Regra

Marcar um usuário em **Acesso e Visibilidade** da submissão (`china_ficha_visibilidade`)
concede automaticamente acesso ao(s) projeto(s) de desenvolvimento vinculados àquela
submissão via `china_submissao_projetos` — o usuário aparece em `projeto_membros` com
papel `membro`.

A propagação é **bidirecional** e **aditiva**:

| Evento | Efeito |
|---|---|
| INSERT em `china_ficha_visibilidade` | Trigger `trg_china_visibilidade_propaga_projeto` adiciona o usuário em `projeto_membros` para cada projeto já vinculado à submissão. |
| INSERT em `china_submissao_projetos` (vincular/criar projeto espelho) | Trigger `trg_china_submissao_projetos_propaga_visibilidade` copia todos os usuários da visibilidade existente para `projeto_membros` do novo projeto. |
| DELETE em `china_ficha_visibilidade` | **Sem efeito** em `projeto_membros` — remover da visibilidade não expulsa o usuário do projeto (ele pode ter tarefas, responsabilidades, histórico). Remoção do projeto continua manual via tela de Equipe. |

## Garantias

- `ON CONFLICT (projeto_id, user_id) DO NOTHING` — nunca rebaixa papel existente
  (`coordenador`, `gestor_produto`, etc.).
- Triggers `SECURITY DEFINER` com `search_path = public`.
- Backfill idempotente executado na migration original (pode ser re-rodado sem efeito colateral).
- Sem alteração em RPCs, hooks ou RLS.

## Migration

`supabase/migrations/<ts>_visibilidade_submissao_propaga_projeto.sql`
