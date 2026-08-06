# Calendário Geral no menu esquerdo

Uma tela nova de calendário que reúne, em um único lugar, os prazos de todos os projetos que a pessoa acessa e eventos avulsos criados diretamente ali (reuniões, viagens, feriados internos, lembretes), com visual moderno e denso.

## O que o usuário ganha

- Item **Calendário** no menu lateral, disponível para todos os usuários (tela padrão, como Central de Trabalho e Chat).
- Visões **Mês**, **Semana** e **Agenda** (lista cronológica dos próximos dias).
- Consolidação de tarefas de todos os projetos visíveis, com cor por projeto e barra contínua para tarefas de vários dias.
- Criação de **eventos avulsos** que não pertencem a nenhum projeto: título, descrição, dia inteiro ou com horário, início e fim, local, cor e categoria.
- Eventos são **pessoais por padrão** e podem ser compartilhados com participantes específicos (quem é convidado vê o evento no próprio calendário).
- Recorrência semanal/mensal e lembretes por e-mail e notificação, reaproveitando o motor já existente do calendário de projetos.
- Filtros por projeto, responsável, equipe e por camada (Tarefas / Eventos), com painel lateral de detalhe ao clicar em um item.
- Barra lateral compacta com mini-calendário, "Hoje", próximos 7 dias e alternância rápida das camadas.

## Estrutura visual

```text
┌───────────────────────────────────────────────────────────────┐
│  Calendário            [Mês|Semana|Agenda]  [Filtros] [+ Novo]│
├───────────┬───────────────────────────────────────────────────┤
│ mini-cal  │                                                   │
│ Hoje      │        grade mensal com barras de evento          │
│ Camadas   │        (cor por projeto / cor do evento)          │
│  Tarefas  │                                                   │
│  Eventos  │                                                   │
│ Próximos  │                                                   │
└───────────┴───────────────────────────────────────────────────┘
```

## Detalhes técnicos

**Banco de dados**
- Nova tabela `calendario_eventos`: título, descrição, `data_inicio`/`data_fim` (timestamptz), `dia_inteiro`, local, cor, categoria, `criado_por`, `visibilidade` (`pessoal` | `compartilhado`), `recorrencia_id`.
- Nova tabela `calendario_evento_participantes`: `evento_id`, `user_id`, papel. GRANTs para `authenticated` e `service_role` em ambas.
- RLS: leitura para o criador e para participantes (semi-join `EXISTS`, sem funções SQL nas policies); escrita/exclusão apenas para o criador; administradores via `has_role`.
- Reaproveita `calendario_lembretes` (nova coluna `evento_id` nullable, junto à referência de tarefa) e `projeto_tarefa_recorrencias` para séries.

**Frontend**
- Rota `/dashboard/calendario` registrada em `App.tsx`, com `screen_code` `calendario_geral` adicionado a `telas_sistema`, `sidebar_menu_items` e ao conjunto `DEFAULT_SCREENS` em `PermissionsContext`.
- Página `src/pages/CalendarioGeral.tsx` compondo o `UnifiedCalendar` existente (ganha visão "Agenda" e suporte a horários) + `CalendarFiltersBar` já pronto.
- Hook `src/hooks/useCalendarioConsolidado.ts`: junta tarefas de todos os projetos visíveis (mesma fonte usada em Minhas Tarefas) com os eventos avulsos, mapeando tudo para `CalendarEvent` via um novo adapter `eventoToCalendarEvent`.
- `CalendarEvent` ganha campos opcionais `tipo` (`tarefa` | `evento`), `hora_inicio`, `hora_fim`, `local` e `cor`, sem quebrar os usos atuais em Projetos e Central de Trabalho.
- Diálogo `EventoCalendarioDialog.tsx` (criar/editar) derivado do `NovoEventoCalendarioDialog` atual, acrescentando descrição, horário, local, cor, categoria e seleção de participantes.
- Painel lateral `CalendarioDetalhePanel.tsx`: tarefa abre o drawer de tarefa existente; evento mostra detalhes com editar/excluir e opção "encerrar série".

**Lembretes**
- A função `calendario-lembretes-dispatch` passa a considerar também lembretes com `evento_id`, usando o horário do evento como referência em vez do padrão 08:00.

**Compatibilidade**
- Nada é removido: os calendários de Projetos e da Central de Trabalho continuam iguais, apenas consumindo o `UnifiedCalendar` estendido.
- Testes: unitários do adapter e do merge de camadas; testes de RLS garantindo que evento pessoal não vaza para terceiros e que participante enxerga o evento compartilhado.
- `APP_VERSION` bump e entrada no changelog da documentação de API.
