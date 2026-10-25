# Módulo Quadra de Futebol — controle financeiro

Controle financeiro simplificado para uma quadra de futebol: livro-caixa (receitas e
despesas), agenda de reservas avulsas e cadastro de mensalistas com geração mensal de
cobranças.

## Rotas

| Rota | Tela | Guarda |
|---|---|---|
| `/dashboard/quadra` | Painel (KPIs do mês, gráfico de 6 meses, categorias, pendências, próximas reservas) | módulo `quadra` + tela `quadra_financeiro` |
| `/dashboard/quadra/lancamentos` | Livro-caixa com filtros, baixa, edição, exclusão e geração de mensalidades | idem |
| `/dashboard/quadra/reservas` | Agenda mensal de reservas avulsas | idem |
| `/dashboard/quadra/mensalistas` | Clientes com horário fixo e mensalidade | idem |

## Modelo de dados (migration `20261025120000_quadra_financeiro.sql`)

- `quadra_mensalistas`: nome, contato, dia da semana, horário fixo, `valor_mensal`,
  `dia_vencimento` (1–28), `ativo`.
- `quadra_reservas`: data, horário, cliente, `valor`, `status`
  (`confirmada | realizada | cancelada`), `status_pagamento` (`pendente | pago`).
- `quadra_lancamentos`: `tipo` (`receita | despesa`), `categoria`, `descricao`, `valor`,
  `data_competencia`, `data_vencimento`, `data_pagamento`, `status`
  (`pendente | pago | cancelado`), `reserva_id`, `mensalista_id`,
  `competencia_mensalidade`.

Regras implementadas no backend:

- **Reserva → receita**: o trigger `quadra_sync_lancamento_reserva` cria/atualiza um
  lançamento de receita (`aluguel_horario`) para cada reserva. Cancelar a reserva marca a
  receita como cancelada; excluir a reserva remove a receita (`ON DELETE CASCADE`).
  Por isso a baixa de uma receita de reserva é feita atualizando a reserva.
- **Mensalidades**: a RPC `quadra_gerar_mensalidades(p_competencia date)` cria uma receita
  pendente por mensalista ativo para o mês. É idempotente (índice único parcial em
  `mensalista_id + competencia_mensalidade`).
- **Acesso**: RLS em todas as tabelas via `check_user_access(auth.uid(), 'quadra')`.
  Admin, gerente e supervisor recebem o módulo e a tela por padrão; outros usuários são
  liberados pela administração de permissões.

## Frontend

- Tipos: `src/types/quadra.ts`.
- Categorias, formas de pagamento e rótulos: `src/lib/quadra/categorias.ts`.
- Cálculo de KPIs, série mensal e atraso: `src/lib/quadra/resumoFinanceiro.ts`
  (testes em `src/lib/quadra/__tests__`).
- Validações Zod `.strict()`: `src/lib/validations/quadra.ts`.
- Hooks TanStack Query: `src/hooks/quadra/`.
- Componentes: `src/components/quadra/`; páginas: `src/pages/quadra/`.

As tabelas ainda não constam nos tipos gerados do backend; os hooks usam acesso não
tipado ao cliente até a próxima regeneração de `types.ts`.
