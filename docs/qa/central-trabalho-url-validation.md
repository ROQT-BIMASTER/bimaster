# Central de Trabalho — Checklist de validação manual de URL

Este documento descreve os cenários que devem ser executados manualmente no
ambiente de Preview antes de cada release que toque a Central de Trabalho
(`/dashboard/projetos/central`). O objetivo é garantir que qualquer URL
compartilhada — mesmo com parâmetros inválidos, duplicados ou maliciosos — seja
**reescrita silenciosamente** (com `history.replace`) para um estado válido e
que a UI renderize de forma coerente.

> Atalhos:
> - **OK** = a URL final está limpa e a UI bate com o esperado
> - **Toast esperado**: "Link ajustado automaticamente" descrevendo os params removidos

---

## 1. Aba (`?tab=`)

| # | URL de entrada | Esperado na URL final | Aba ativa | Toast? |
|---|---|---|---|---|
| 1.1 | `/central` | sem `tab` (usa preferência ou `hoje`) | conforme preferência | não |
| 1.2 | `/central?tab=hoje` | sem `tab` (default) | Hoje | não |
| 1.3 | `/central?tab=tarefas` | `?tab=tarefas` | Tarefas | não |
| 1.4 | `/central?tab=inbox` | `?tab=inbox` | Notificações | não |
| 1.5 | `/central?tab=garbage` | sem `tab` | default (preferência) | **sim** |
| 1.6 | `/central?tab=HOJE` (case) | sem `tab` | default | **sim** |
| 1.7 | `/central?tab=tarefas&tab=inbox` (duplicado) | `?tab=tarefas` (primeiro vence) | Tarefas | não |

## 2. Filtro (`?filter=`)

| # | URL de entrada | Esperado | Toast? |
|---|---|---|---|
| 2.1 | `/central?tab=tarefas&filter=atrasadas` | mantém `filter=atrasadas`; lista filtrada | não |
| 2.2 | `/central?tab=tarefas&filter=hoje` | mantém `filter=hoje` | não |
| 2.3 | `/central?tab=tarefas&filter=all` | remove `filter` | não |
| 2.4 | `/central?tab=tarefas&filter=lixo` | remove `filter` | **sim** |
| 2.5 | `/central?tab=hoje&filter=atrasadas` | remove `filter` (não se aplica) | **sim** |

## 3. Visualização / Prioridade / Projeto / Busca (Tarefas)

| # | URL de entrada | Esperado |
|---|---|---|
| 3.1 | `/central?tab=tarefas&view=board` | mantém `view=board`; render kanban |
| 3.2 | `/central?tab=tarefas&view=kanban` (inválido) | remove `view`; render lista; **toast** |
| 3.3 | `/central?tab=tarefas&priority=urgente` | mantém `priority=urgente` |
| 3.4 | `/central?tab=tarefas&priority=critica` (inválido) | remove `priority`; **toast** |
| 3.5 | `/central?tab=tarefas&project=11111111-2222-3333-4444-555555555555` | mantém `project=…` |
| 3.6 | `/central?tab=tarefas&project=not-a-uuid` | remove `project`; **toast** |
| 3.7 | `/central?tab=tarefas&q=relat%C3%B3rio` | mantém `q=relatório` |
| 3.8 | `/central?tab=tarefas&q=` (vazio) | remove `q` |
| 3.9 | `/central?tab=tarefas&q=` + 200 chars | mantém `q` truncado em 100 chars |
| 3.10 | `/central?tab=tarefas&q=abc%00def` (control char) | mantém `q=abcdef` |

## 4. Strip cross-tab

| # | URL de entrada | Esperado |
|---|---|---|
| 4.1 | `/central?tab=hoje&view=board&priority=alta&project=…` | remove `view`, `priority`, `project`; **toast** |
| 4.2 | `/central?tab=hoje&q=teste` | remove `q`; **toast** |
| 4.3 | `/central?tab=tarefas&subtab=mencoes&group=projeto&tipos=criou_tarefa` | remove `subtab`, `group`, `tipos`; **toast** |
| 4.4 | `/central?tab=inbox&view=board&priority=alta` | remove `view`, `priority`; **toast** |

## 5. Inbox (`?tab=inbox`)

| # | URL de entrada | Esperado |
|---|---|---|
| 5.1 | `/central?tab=inbox&subtab=mencoes` | mantém; sub-aba "Menções" ativa |
| 5.2 | `/central?tab=inbox&subtab=desconhecida` | reescreve para `subtab` default; **toast** |
| 5.3 | `/central?tab=inbox&group=projeto` | mantém; agrupamento por projeto |
| 5.4 | `/central?tab=inbox&group=mes` (inválido) | remove `group`; **toast** |
| 5.5 | `/central?tab=inbox&tipos=criou_tarefa,completou` | mantém os dois |
| 5.6 | `/central?tab=inbox&tipos=criou_tarefa,foo,completou,foo` | mantém apenas válidos sem duplicar; **toast** |
| 5.7 | `/central?tab=inbox&projetos=<uuid>,<uuid>,not-uuid` | mantém apenas UUIDs válidos sem duplicar; **toast** |
| 5.8 | `/central?tab=inbox&projetos=` + 60 UUIDs | mantém **no máximo 50**; **toast** |

## 6. Compartilhamento (Copiar link)

| # | Cenário | Esperado |
|---|---|---|
| 6.1 | Aplicar filtro `priority=alta` + `view=board` e clicar em "Copiar link" | clipboard contém apenas params **válidos e não-default** |
| 6.2 | Aplicar busca, copiar link, abrir em aba anônima | mesma UI; sem toast |
| 6.3 | Adulterar manualmente o link copiado (`view=lixo`) e abrir | UI volta ao default; **toast** |

## 7. Login em outro dispositivo / troca de conta

| # | Cenário | Esperado |
|---|---|---|
| 7.1 | Logar em outra máquina sem URL params | abre na aba salva nas preferências |
| 7.2 | Logar com outro usuário sem preferências | abre em `Hoje` (default sistema) |
| 7.3 | Logar e visitar `/central?tab=tarefas` | abre em Tarefas mesmo se preferência for outra |

## 8. Critérios gerais (devem valer em **todos** os cenários)

- [ ] A barra de endereço sofre `history.replace` (sem entradas extras no botão "Voltar")
- [ ] Nenhum parâmetro com valor igual ao default permanece na URL
- [ ] A UI nunca mostra estado "quebrado" ou em branco enquanto a URL é normalizada
- [ ] Toasts de "Link ajustado" não disparam mais de uma vez para o mesmo conjunto de keys na sessão
- [ ] Preferências do usuário continuam intactas (a normalização **não** altera o que está salvo no banco)
