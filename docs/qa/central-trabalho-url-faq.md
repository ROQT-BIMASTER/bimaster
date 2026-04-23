# Central de Trabalho — FAQ de Normalização de URL

Este documento complementa o [checklist de validação](./central-trabalho-url-validation.md)
e serve como referência rápida para desenvolvedores e QA. Ele descreve, **param a
param**, quais valores são aceitos, quais são rejeitados e o que acontece com a
URL final após a normalização (`sanitizeCentralSearchParams`).

> **Princípio geral.** A função é **determinística e idempotente**: rodá-la duas
> vezes sobre a própria saída é um no-op. Qualquer valor inválido cai para o
> default do param e, se o resultado igualar o default, a chave é **removida**
> da URL.

---

## Índice

- [1. Conceitos-chave](#1-conceitos-chave)
- [2. Tabela de defaults](#2-tabela-de-defaults)
- [3. Comportamento por parâmetro](#3-comportamento-por-parâmetro)
  - [3.1 `tab`](#31-tab)
  - [3.2 `view` (apenas Tarefas)](#32-view-apenas-tarefas)
  - [3.3 `priority` (apenas Tarefas)](#33-priority-apenas-tarefas)
  - [3.4 `filter` (apenas Tarefas)](#34-filter-apenas-tarefas)
  - [3.5 `project` (apenas Tarefas)](#35-project-apenas-tarefas)
  - [3.6 `q` (busca livre — Tarefas e Inbox)](#36-q-busca-livre--tarefas-e-inbox)
  - [3.7 `subtab` (apenas Inbox)](#37-subtab-apenas-inbox)
  - [3.8 `group` (apenas Inbox)](#38-group-apenas-inbox)
  - [3.9 `tipos` (apenas Inbox — CSV)](#39-tipos-apenas-inbox--csv)
  - [3.10 `projetos` (apenas Inbox — CSV de UUIDs)](#310-projetos-apenas-inbox--csv-de-uuids)
- [4. Cenários completos (URL → URL final)](#4-cenários-completos-url--url-final)
- [5. Limites de segurança / DoS](#5-limites-de-segurança--dos)
- [6. Perguntas frequentes](#6-perguntas-frequentes)

---

## 1. Conceitos-chave

| Conceito | O que significa |
|---|---|
| **Default** | Valor implícito quando o param está ausente. Nunca aparece na URL. |
| **Cross-tab strip** | Params válidos em outra aba são removidos quando a aba ativa não os reconhece. Ex.: `view` só faz sentido em **Tarefas**. |
| **Tolerant parse** | `sanitizeCentralSearchParams` faz `trim`, `lowercase` em enums, NFC em texto livre, dedup em CSV. |
| **History replace** | A URL é reescrita silenciosamente via `history.replace` (sem entrada extra no botão "Voltar"). |
| **Toast** | Quando algo é removido/alterado, exibimos "Link ajustado automaticamente" (uma vez por sessão por conjunto de keys). |

## 2. Tabela de defaults

| Param | Default | Quando aparece na URL |
|---|---|---|
| `tab` | `hoje` | Quando ≠ `hoje` |
| `view` | `list` | Quando `tab=tarefas` **e** ≠ `list` |
| `priority` | `all` | Quando `tab=tarefas` **e** ≠ `all` |
| `filter` | `all` | Quando `tab=tarefas` **e** ≠ `all` |
| `project` | `all` | Quando `tab=tarefas` **e** for UUID válido (≠ `all`) |
| `q` | `""` | Quando `tab=tarefas` ou `tab=inbox` **e** não vazio após limpeza |
| `subtab` | `atividade` | Quando `tab=inbox` **e** ≠ `atividade` |
| `group` | `tempo` | Quando `tab=inbox` **e** ≠ `tempo` |
| `tipos` | `[]` | Quando `tab=inbox` **e** lista resultante não vazia |
| `projetos` | `[]` | Quando `tab=inbox` **e** lista resultante não vazia |

> **Regra absoluta:** se o valor efetivo de um param **igualar o default**, a
> chave é removida da URL — sempre.

## 3. Comportamento por parâmetro

### 3.1 `tab`

- **Aceitos:** `hoje`, `tarefas`, `inbox`
- **Tolerância:** `trim` + `toLowerCase` (`?tab=%20TAREFAS%20` ⇒ `tarefas`)
- **Duplicatas:** primeiro valor vence (`?tab=tarefas&tab=inbox` ⇒ `tarefas`)
- **Inválido:** cai para o default (`hoje`) e a chave é removida; **toast**.

| URL de entrada | URL final | Observação |
|---|---|---|
| `?tab=hoje` | _(vazia)_ | default removido |
| `?tab=TAREFAS` | `?tab=tarefas` | normalizado |
| `?tab=lixo` | _(vazia)_ | toast de ajuste |
| `?tab=tarefas&tab=inbox` | `?tab=tarefas` | dedup: 1ª vence |

### 3.2 `view` (apenas Tarefas)

- **Aceitos:** `list`, `board`, `calendar`, `dashboard`
- **Cross-tab:** removido em `tab=hoje` ou `tab=inbox`.
- **Inválido:** cai para `list`; chave removida; **toast**.

| URL de entrada | URL final |
|---|---|
| `?tab=tarefas&view=board` | `?tab=tarefas&view=board` |
| `?tab=tarefas&view=kanban` | `?tab=tarefas` _(toast)_ |
| `?tab=hoje&view=board` | _(vazia)_ _(toast)_ |
| `?tab=tarefas&view=LIST` | `?tab=tarefas` (= default) |

### 3.3 `priority` (apenas Tarefas)

- **Aceitos:** `all`, `urgente`, `alta`, `media`, `baixa`
- **Cross-tab:** removido fora de `tarefas`.
- **Inválido:** cai para `all` e chave removida; **toast**.

| URL de entrada | URL final |
|---|---|
| `?tab=tarefas&priority=alta` | `?tab=tarefas&priority=alta` |
| `?tab=tarefas&priority=critica` | `?tab=tarefas` _(toast)_ |
| `?tab=tarefas&priority=ALL` | `?tab=tarefas` (default) |

### 3.4 `filter` (apenas Tarefas)

- **Aceitos:** `all`, `atrasadas`, `hoje`
- **Cross-tab:** removido fora de `tarefas`.

| URL de entrada | URL final |
|---|---|
| `?tab=tarefas&filter=atrasadas` | `?tab=tarefas&filter=atrasadas` |
| `?tab=tarefas&filter=lixo` | `?tab=tarefas` _(toast)_ |
| `?tab=hoje&filter=atrasadas` | _(vazia)_ _(toast)_ |

### 3.5 `project` (apenas Tarefas)

- **Aceitos:** `all` ou um UUID v4 (`/^[0-9a-f]{8}-…-[0-9a-f]{12}$/i`)
- **Cross-tab:** removido fora de `tarefas`.
- **Inválido:** cai para `all` e a chave é removida; **toast**.

| URL de entrada | URL final |
|---|---|
| `?tab=tarefas&project=11111111-1111-1111-1111-111111111111` | mantém |
| `?tab=tarefas&project=not-a-uuid` | `?tab=tarefas` _(toast)_ |
| `?tab=tarefas&project=ALL` | `?tab=tarefas` (default) |

### 3.6 `q` (busca livre — Tarefas e Inbox)

- **Limpeza:** strip de control chars (0x00–0x1F, 0x7F), normalização NFC,
  colapsa espaços, `trim`, **clamp em 100 chars**.
- **Cross-tab:** removido em `tab=hoje`.

| URL de entrada | URL final |
|---|---|
| `?tab=tarefas&q=relat%C3%B3rio` | `?tab=tarefas&q=relatório` |
| `?tab=tarefas&q=` | `?tab=tarefas` (default) |
| `?tab=tarefas&q=%20%20%20` | `?tab=tarefas` (vira `""`) |
| `?tab=tarefas&q=abc%00def` | `?tab=tarefas&q=abcdef` |
| `?tab=tarefas&q=` + 200 chars | clamp em 100 chars |
| `?tab=hoje&q=teste` | _(vazia)_ _(toast)_ |

### 3.7 `subtab` (apenas Inbox)

- **Aceitos:** `atividade`, `mencoes`, `favoritas`, `arquivadas`
- **Cross-tab:** removido fora de `inbox`.

| URL de entrada | URL final |
|---|---|
| `?tab=inbox&subtab=mencoes` | mantém |
| `?tab=inbox&subtab=desconhecida` | `?tab=inbox` _(toast)_ |
| `?tab=inbox&subtab=ATIVIDADE` | `?tab=inbox` (default) |

### 3.8 `group` (apenas Inbox)

- **Aceitos:** `tempo`, `projeto`
- **Cross-tab:** removido fora de `inbox`.

| URL de entrada | URL final |
|---|---|
| `?tab=inbox&group=projeto` | mantém |
| `?tab=inbox&group=mes` | `?tab=inbox` _(toast)_ |

### 3.9 `tipos` (apenas Inbox — CSV)

- **Aceitos:** CSV com `criou_tarefa`, `completou`, `comentou`, `moveu`
- **Limpeza:** trim por item, lowercase, dedup, **máx. 50 itens**.
- **Inválidos:** silenciosamente descartados; se sobrarem itens, mantém só os
  válidos; **toast** quando algum item foi removido.

| URL de entrada | URL final |
|---|---|
| `?tab=inbox&tipos=criou_tarefa,completou` | mantém os dois |
| `?tab=inbox&tipos=criou_tarefa,foo,completou,foo` | `tipos=criou_tarefa,completou` _(toast)_ |
| `?tab=inbox&tipos=foo,bar` | `?tab=inbox` _(toast)_ |
| `?tab=inbox&tipos=` | `?tab=inbox` (default `[]`) |

### 3.10 `projetos` (apenas Inbox — CSV de UUIDs)

- **Aceitos:** CSV de UUIDs válidos
- **Limpeza:** trim, lowercase, dedup, **máx. 50 UUIDs**, descarta `all` e
  vazios.
- **Inválidos:** descartados; **toast** quando houve descarte.

| URL de entrada | URL final |
|---|---|
| `?tab=inbox&projetos=<uuidA>,<uuidB>` | mantém ambos |
| `?tab=inbox&projetos=<uuidA>,not-uuid` | `projetos=<uuidA>` _(toast)_ |
| `?tab=inbox&projetos=` + 60 UUIDs | mantém só os 50 primeiros _(toast)_ |
| `?tab=inbox&projetos=all` | `?tab=inbox` (descartado) |

## 4. Cenários completos (URL → URL final)

### 4.1 URL "limpa" — todos os defaults

```
ENTRADA:  /central?tab=hoje&view=list&priority=all&filter=all&project=all&q=
SAÍDA:    /central
TOAST:    não (defaults silenciosos)
```

### 4.2 URL com mix válido + lixo

```
ENTRADA:  /central?tab=tarefas&view=list&priority=alta&filter=all
          &project=11111111-1111-1111-1111-111111111111&q=
SAÍDA:    /central?tab=tarefas&priority=alta
          &project=11111111-1111-1111-1111-111111111111
TOAST:    não (apenas defaults removidos)
```

### 4.3 URL com vazamento cross-tab

```
ENTRADA:  /central?tab=hoje&view=board&priority=alta&q=teste
SAÍDA:    /central
TOAST:    sim — "Link ajustado: removidos view, priority, q"
```

### 4.4 URL com params inválidos no Inbox

```
ENTRADA:  /central?tab=inbox&subtab=mencoes&group=mes
          &tipos=criou_tarefa,foo,completou&projetos=<uuid>,not-uuid
SAÍDA:    /central?tab=inbox&subtab=mencoes
          &tipos=criou_tarefa,completou&projetos=<uuid>
TOAST:    sim — "Link ajustado: corrigidos group, tipos, projetos"
```

### 4.5 URL adulterada / pior caso

```
ENTRADA:  /central?tab=%20TAREFAS%20&tab=inbox&view=%62oard&view=kanban
          &q=%20%20hello%00%20%20world%20%20&utm_source=email
SAÍDA:    /central?tab=tarefas&view=board&q=hello+world
TOAST:    sim
```

| Param | O que aconteceu |
|---|---|
| `tab` | `trim`+lowercase + dedup (1ª vence) ⇒ `tarefas` |
| `view` | URL-decode (`%62oard` ⇒ `board`) + dedup ⇒ `board` |
| `q` | strip control char + colapsa espaços ⇒ `hello world` |
| `utm_source` | chave desconhecida ⇒ removida |

## 5. Limites de segurança / DoS

| Limite | Valor | Por quê |
|---|---|---|
| Tamanho máximo por valor cru | **4096 bytes** | Evita custo quadrático em regex/normalize |
| Tamanho máximo de `q` | **100 chars** | Limite de UI e impede abuso de busca |
| Tamanho máximo de cada CSV | **4096 bytes** | Bloqueia explosão em `tipos` / `projetos` |
| Itens por CSV | **50** | Janela superior para `tipos`/`projetos` |
| NFC normalize | sim | Mistura de formas Unicode é normalizada |
| Strip `0x00–0x1F` + `0x7F` | sim | Remove control chars |

> Inputs que excedam estes limites são **truncados silenciosamente** (sem
> exception). Testes de stress em `src/lib/__tests__/centralUrlParams.stress.test.ts`
> validam até 1 MB de input e 5 000+ keys repetidas.

## 6. Perguntas frequentes

### Por que minha URL "perdeu" o `?view=list`?

Porque `list` é o **default** de `view`. A função remove qualquer chave cujo
valor seja igual ao default — isso mantém URLs compartilhadas curtas e
canônicas. Para forçar a aparição da chave, use um valor não-default
(`view=board`, por exemplo).

### Por que `?tab=hoje&view=board` perde o `view`?

Porque `view` só é válido em `tab=tarefas`. Em `hoje`, ele é considerado
"vazamento cross-tab" e removido. O usuário recebe o toast de ajuste.

### O que acontece se eu repetir uma chave (`?tab=a&tab=b`)?

A primeira ocorrência vence (`URLSearchParams#get` retorna o primeiro). As
demais são descartadas. Isso garante que uma URL adulterada nunca consiga
"acumular" valores indevidos.

### A normalização altera as preferências salvas no banco?

**Não.** Apenas a URL na barra de endereço é reescrita. As preferências do
usuário continuam intactas no `user_central_preferences`.

### Por que existe um toast de "Link ajustado"?

Para que o usuário saiba quando um link compartilhado foi limpo. O toast
dispara **uma vez por conjunto de keys ajustadas por sessão** (não polui a UI
em re-renders).

### Como faço para testar manualmente?

Siga o checklist em [`central-trabalho-url-validation.md`](./central-trabalho-url-validation.md)
ou rode a suíte automatizada:

```bash
npx vitest run src/lib/__tests__/centralUrlParams
```

### Onde fica o código?

| Arquivo | Papel |
|---|---|
| `src/lib/centralUrlParams.ts` | Schema registry + parser único + sanitizer |
| `src/lib/__tests__/centralUrlParams.defaults.test.ts` | Garante que defaults nunca são escritos |
| `src/lib/__tests__/centralUrlParams.cleanup-extras.test.ts` | Whitespace, URL-encoding, dedup |
| `src/lib/__tests__/centralUrlParams.stress.test.ts` | Inputs longos / Unicode misto |

---

**Última revisão:** 2026-04-23
