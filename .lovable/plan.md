## Objetivo

Mostrar o "bonequinho" (avatar do responsável) em cada linha de tarefa da Central de Trabalho — incluindo na seção "Sem datas planejadas" — para identificar visualmente quem é o dono da tarefa.

## Onde aparece

- `src/components/projetos/central/MinhasTarefasContent.tsx` — componente `TarefaRow` (linha ~87-191), usado por todas as seções (Atrasadas, Hoje, Esta semana, Mais adiante, Sem datas, Concluídas).
- A mesma linha é usada implicitamente nas listas renderizadas em `HojeTab.tsx` (via mesmo agrupamento). Vamos confirmar e aplicar o mesmo padrão se necessário.

## O que falta hoje

A RPC `get_minhas_tarefas_central` devolve apenas `responsavel_id`. Não há `responsavel_nome` nem `responsavel_avatar_url`, então o front não consegue renderizar avatar diretamente.

## Abordagem

1. **Estender a RPC** `get_minhas_tarefas_central` para incluir dois campos novos: `responsavel_nome` e `responsavel_avatar_url`, lendo de `profiles` via LEFT JOIN no `responsavel_id`. Sem mudança de assinatura/contrato — apenas duas colunas a mais. Mantém RLS e performance (uma única query, sem N+1 no front).

2. **Tipar no hook** `src/hooks/useMinhasTarefas.ts`: adicionar `responsavel_nome: string | null` e `responsavel_avatar_url: string | null` em `MinaTarefa` e mapear no `.map()`.

3. **Renderizar na `TarefaRow`** (MinhasTarefasContent.tsx):
   - Avatar pequeno (h-5 w-5) à direita, antes do prazo e do botão de comentário.
   - `<Avatar>` com `AvatarImage src={responsavel_avatar_url}` e `AvatarFallback` com as iniciais de `responsavel_nome` (ou ícone `User` se nulo).
   - Envolver em `Tooltip` mostrando o nome completo ("Responsável: Fulano" / "Sem responsável").
   - Se `responsavel_id` for nulo: avatar neutro, em tom `muted`, com tooltip "Sem responsável".
   - Manter compacto para não quebrar o layout em telas menores.

4. **Validação**:
   - Build.
   - Browser em `/dashboard/projetos/central` confirmando que o avatar aparece nas seções Atrasadas, Hoje e Sem datas planejadas, sem regredir os badges existentes ("Sou responsável", "Sem datas", prioridade).

## Detalhes técnicos

- Migration: `CREATE OR REPLACE FUNCTION public.get_minhas_tarefas_central(...)` adicionando `LEFT JOIN profiles p ON p.id = t.responsavel_id` e `p.nome AS responsavel_nome, p.avatar_url AS responsavel_avatar_url` no SELECT/RETURNS TABLE. Manter `SECURITY DEFINER` e `search_path` atuais. Sem alterar as demais colunas/ordem para não quebrar consumidores.
- Frontend importa `Avatar, AvatarImage, AvatarFallback` de `@/components/ui/avatar` (já é o padrão usado em `ProjetoTarefaDetalhe.tsx`).
- Sem mudanças em filtros, KPIs ou agrupamentos — apenas exibição.

## Fora do escopo

- Trocar responsável a partir da linha (poderia ser uma evolução com popover, mas não foi pedido).
- Mostrar avatares de colaboradores além do responsável.
