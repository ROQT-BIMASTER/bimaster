

## Melhoria do Calendário de Visitas (Trade Marketing)

### Problema atual
O calendário usa o componente `Calendar` padrão do shadcn (DayPicker pequeno), mostrando apenas um mini-calendário à esquerda e uma lista simples à direita. Não há indicadores visuais nos dias com visitas, nem contagem, nem diferenciação por status.

### Solução: Calendário profissional estilo agenda

Reescrever o componente `VisitsCalendar.tsx` com um layout de calendário completo tipo grade mensal (similar a Google Calendar), onde cada célula de dia mostra os eventos inline.

**Estrutura visual:**

```text
┌─────────────────────────────────────────────────────┐
│  < março 2026 >                    [Mês] [Semana]   │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────┤
│ Dom  │ Seg  │ Ter  │ Qua  │ Qui  │ Sex  │ Sáb      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────┤
│      │      │      │  1   │  2   │  3   │  4       │
│      │      │      │      │ ● 2  │ ●●1  │          │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────┤
│  5   │  6   │  7   │  8   │  9   │  10  │  11      │
│      │ ● 1  │      │      │ ● 3  │      │          │
└──────┴──────┴──────┴──────┴──────┴──────┴──────────┘

Clicar num dia → painel lateral com detalhes das visitas
```

### Funcionalidades

1. **Grade mensal customizada** — calendário em grid CSS ocupando toda a largura, cada dia como célula clicável
2. **Indicadores visuais por status** — pills coloridas dentro de cada célula (azul=agendada, amarelo=em andamento, verde=concluída, vermelho=cancelada)
3. **Contagem de visitas** — badge com número total de visitas no canto do dia
4. **Visão semanal** — toggle entre visualização mensal e semanal
5. **Painel lateral de detalhes** — ao clicar num dia, abre painel com lista detalhada (loja, horário, status, tipo, responsável)
6. **Navegação mês/semana** — setas para avançar/voltar meses ou semanas
7. **Legenda de status** — barra inferior com legenda das cores
8. **Resumo do mês** — cards de KPI no topo (total agendadas, concluídas, taxa de conclusão)

### Dados adicionais na query
Incluir `profiles:user_id(nome)` para mostrar o responsável pela visita.

### Arquivos a modificar
- **`src/components/trade/VisitsCalendar.tsx`** — reescrever completamente com o novo layout de grade
- Nenhuma migration necessária — usa os mesmos dados da tabela `visits`

### Detalhes técnicos
- Grid CSS com `grid-cols-7` para os dias da semana
- Cálculo de dias do mês com `date-fns` (`startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`, `eachDayOfInterval`)
- Status com cores via Tailwind: `bg-blue-500`, `bg-amber-500`, `bg-green-500`, `bg-red-500`
- Responsivo: no mobile, os pills ficam apenas como dots coloridos; no desktop mostram o nome da loja truncado

