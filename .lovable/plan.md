
## Objetivo

Retomar, de forma segura, o escopo da Central de Trabalho ("Minhas Tarefas") para que cada usuário enxergue **apenas o que é dele**, sem efeitos colaterais de liberações genéricas. Aplicar a mesma lógica dentro do projeto.

## Regras finais de visibilidade

**Central de Trabalho (Minhas Tarefas / Hoje / KPIs):**
- Aparece se `responsavel_id = auth.uid()` **OU** o usuário está em `projeto_tarefa_colaboradores` daquela tarefa.
- **Não aparece** por: ser apenas criador da tarefa, ser membro do projeto, ter seção liberada, ou ser coordenador.
- Tarefas excluídas (`excluida_em IS NOT NULL`) continuam fora.

**Dentro do projeto (ProjetoDetalhe):**
- Admin do sistema, criador do projeto e coordenadores do projeto: veem tudo.
- Demais membros: veem **apenas** tarefas onde são responsável/colaborador. Liberação por seção deixa de "abrir" todas as tarefas da seção; passa a servir apenas como permissão de navegação/visualização da seção (cabeçalho), e a lista da seção mostra somente as tarefas pessoais do usuário.
- Banner "Visão parcial" continua, agora com texto que reflete a regra mais estrita.

## Mudanças técnicas

### 1. RPC `get_minhas_tarefas_central` (migration)
Remover o ramo `criador_id = auth.uid()` do `WHERE`. Manter:
- `responsavel_id = auth.uid()`
- `EXISTS` em `projeto_tarefa_colaboradores`

Ajustar `papel_calc` para retornar apenas `'responsavel'` ou `'colaborador'` (drop de `'criador'`). Manter `SECURITY DEFINER`, `SET search_path = public`, `REVOKE`/`GRANT` para `authenticated`.

### 2. RPC `get_projeto_tarefas_v2` (migration)
Reescrever a CTE de visibilidade para:
- Se usuário é admin OR criador do projeto OR coordenador → retorna todas as tarefas e `is_partial_view = false`.
- Caso contrário → retorna apenas tarefas onde `responsavel_id = auth.uid()` OR está em `projeto_tarefa_colaboradores`. `is_partial_view = true` quando `count(visíveis) < count(total não excluídas)`.
- Seções: retornar todas as seções que o usuário pode ver no header (coordenador/admin/criador veem tudo; demais veem apenas seções que (a) contêm pelo menos uma tarefa visível para ele OU (b) estão explicitamente liberadas em `projeto_membro_secoes`). Seções liberadas mas sem tarefas pessoais aparecem vazias com badge "sem tarefas atribuídas a você".

### 3. `user_can_access_secao` (migration)
Reverter o ramo adicionado anteriormente que liberava acesso à seção quando o usuário tinha qualquer tarefa lá. Manter:
- admin
- criador do projeto
- coordenador do projeto
- liberação explícita em `projeto_membro_secoes`
- membro do projeto **sem nenhuma** liberação granular cadastrada (compat) — opcional, decidir manter para não quebrar projetos antigos. Recomendado: **manter** este ramo durante 1 release com flag, mas adicionar comentário de depreciação.

### 4. Frontend — `useMinhasTarefas.ts`
- Atualizar tipo `MinaTarefa.papel` para `"responsavel" | "colaborador"` (remover `"criador"`).
- Atualizar mapeamento no hook.

### 5. Frontend — `MinhasTarefasContent.tsx` / `HojeTab.tsx` / `CentralKPIs.tsx`
- Remover qualquer label/filtro "Criadas por mim".
- Atualizar tooltip do banner "Visão parcial" no projeto para texto: "Você está vendo apenas as tarefas em que é responsável ou colaborador."

### 6. Banner de visão parcial (`ProjetoVisaoParcialBanner.tsx`)
Atualizar copy para refletir a nova regra estrita e remover menção a "seções liberadas trazem tarefas".

### 7. Backfill / segurança
- Criar índice (se não existir) em `projeto_tarefa_colaboradores(user_id, tarefa_id)` para performance da nova RPC.
- Auditar `projeto_tarefas` quanto a tarefas órfãs sem `responsavel_id` (relatório informativo, sem alteração de dados).

## Validação

1. Logar como Nathalia (membro com seção liberada mas sem tarefas atribuídas) → Central deve ficar vazia ou mostrar apenas tarefas explícitas dela.
2. Logar como responsável de 3 tarefas em projetos onde não é membro → as 3 aparecem.
3. Logar como colaborador adicionado em 1 tarefa de projeto restrito → essa 1 aparece.
4. Logar como criador de tarefa que delegou para outro → **não** aparece na Central (regra acordada).
5. Dentro do projeto, membro sem coordenação vê banner "Visão parcial" e apenas tarefas pessoais.
6. Coordenador/criador/admin continuam vendo tudo no projeto.
7. Rodar `supabase--linter` para confirmar zero novos warnings.

## Riscos

- Usuários que hoje contavam com "Criadas por mim" para acompanhar delegações vão sentir falta. Mitigar: Fase futura — adicionar aba opcional "Delegadas por mim" (fora deste escopo).
- Projetos antigos sem `projeto_membro_secoes` cadastrado podem deixar de listar seções para membros se removermos o fallback. Por isso o ramo de fallback em `user_can_access_secao` fica mantido nesta entrega.
