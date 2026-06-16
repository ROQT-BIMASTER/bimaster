# E2E — Datepicker timezone matrix

Suíte Playwright que valida que o datepicker **"Início planejado"** das tarefas
de Projetos preserva o dia escolhido pelo usuário em três fusos horários:

| Project Playwright | Timezone           | Offset (sem DST) | Cenário coberto                      |
| ------------------ | ------------------ | ---------------- | ------------------------------------ |
| `tz-sao-paulo`     | America/Sao_Paulo  | UTC-3            | Negativo — bug histórico do produto  |
| `tz-utc`           | UTC                | UTC±0            | Baseline (CI default)                |
| `tz-tokyo`         | Asia/Tokyo         | UTC+9            | Positivo — pega o lado oposto        |

Cada project roda 3 cenários (16-jun-2026, 31-dez-2026, 01-jan-2027) e valida:

1. **UI imediata** — botão exibe a data clicada logo após `onSelect`.
2. **Backend** — `GET /rest/v1/projeto_tarefas?...&select=data_inicio_planejada`
   devolve exatamente o `YYYY-MM-DD` clicado.
3. **Reload** — após `page.reload()`, o botão continua exibindo a mesma data.

## Pré-requisitos

| Env var                  | Descrição                                                       |
| ------------------------ | --------------------------------------------------------------- |
| `E2E_BASE_URL`           | URL do preview/staging                                          |
| `E2E_TEST_EMAIL`         | Usuário membro/coordenador da tarefa                            |
| `E2E_TEST_PASSWORD`      | Senha                                                           |
| `E2E_SUPABASE_URL`       | `https://<ref>.supabase.co`                                     |
| `E2E_SUPABASE_ANON_KEY`  | Publishable key                                                 |
| `E2E_PROJETO_ID`         | UUID do projeto-mãe                                             |
| `E2E_TAREFA_ID`          | UUID da tarefa (qualquer status; o teste sobrescreve a data)    |

Se algum estiver ausente, o `beforeAll` chama `test.skip(true, ...)` com a lista
dos faltantes — a suíte não trava o restante do CI.

## Como criar a tarefa de teste

Uma vez por environment (`dev`/`staging`):

1. Logar com o usuário de QA, abrir um projeto descartável.
2. Criar uma tarefa "QA Datepicker TZ" (qualquer estágio, sem `data_inicio_planejada`).
3. Copiar a tarefa UUID e o projeto UUID e registrar como secrets do GitHub
   environment (ou variables, conforme política do repo).

## Rodar localmente

```bash
# Todas as 3 zonas:
bun run e2e:tz

# Uma zona individual (mais rápido para debug):
bun run e2e:tz:sp
bun run e2e:tz:utc
bun run e2e:tz:tokyo
```

## Falsa positivo / negativo

Se quiser confirmar que a suíte tem poder discriminatório real, reverta em
local descartável o `formatLocalDate(d)` em
`src/components/projetos/ProjetoTarefaDetalhe.tsx` para
`d.toISOString().split("T")[0]` e rode `bun run e2e:tz:tokyo`: o cenário
"31-dez-2026" passa a falhar no assertion da UI (botão exibirá 30-dez). Isso
prova que o teste não está só lendo do backend, mas validando o caminho real.
