# Unificar a leitura de status entre Kanban, Caixa de entrada e Checklist

## O problema confirmado

Hoje existem quatro leituras diferentes do mesmo campo de status do documento, e cada tela decide por conta própria o que cada valor significa. Consequência: um documento marcado como "em análise" pelo Brasil some da Caixa de entrada.

Estado atual no banco (todos os documentos China):

```text
pendente        47
em_analise       4
aprovado         2
ciencia          2
rascunho         2
enviado_brasil   1
```

Quem grava `em_analise`: as ações de decisão do Brasil (`useDecisaoDocumentoChina.ts`, `useDespachoDocumentos.ts`, via a rotina de decisão do documento). Quem grava `devolvido_china` e `ciencia`: o mesmo fluxo de despacho/parecer.

Quem lê, e como diverge:

| Leitor | `em_analise` | `ciencia` | `devolvido_china` |
|---|---|---|---|
| Pastas da Caixa (`useChinaMailbox.ts`) | não reconhece — cai fora de todas as pastas | não reconhece | não reconhece |
| Kanban (`MailboxKanban.tsx` → `bucketForDoc`) | vira "pendente" (coluna errada) | vira "pendente" | vira "pendente" |
| Barra de progresso (`groupMailboxItems.ts`) | vira "enviados" | vira "enviados" | vira "enviados" |
| Checklist / badges (`docStatus.ts` → `normalizarDecisao`) | correto: "em análise" | vira "pendente" | vira "pendente" |
| Modo Foco (`flowTones.ts` → `bucketForDoc`) | cai no default "pendente"; e `pendente` vira "em_analise" (invertido) | — | — |

É por isso que a pasta "Em análise no Brasil" mostra 0 itens enquanto o Kanban e o Checklist mostram documentos em análise.

## O que fazer

### 1. Um único vocabulário de status

Ampliar `src/lib/china/docStatus.ts` para ser a fonte única, cobrindo todos os valores que realmente existem no banco: `rascunho`, `pendente`, `enviado`, `enviado_brasil`, `em_analise`, `em_revisao`, `contestado`, `ciencia`, `aprovado`, `rejeitado`, `devolvido_china`.

Expor dois níveis, ambos derivados da mesma tabela:

- `normalizarDecisao(status)` — decisão administrativa (pendente / em análise / aprovado / não aprovado), já existente, corrigida para tratar `ciencia` como aprovado e `devolvido_china` como não aprovado.
- `bucketFluxo(status)` — estágio do fluxo China→Brasil: `nao_criado | rascunho | pendente_envio | enviado | em_analise | aprovado | devolvido`. É esse bucket que define coluna do Kanban, pasta da Caixa e chip do Checklist.

Um valor desconhecido cai num bucket explícito e é logado, em vez de virar "pendente" silenciosamente.

### 2. Caixa de entrada passa a usar o bucket

Em `useChinaMailbox.ts`, reescrever os matchers das pastas em cima de `bucketFluxo`:

- Pendentes de envio: `rascunho` + `pendente_envio` (mantendo a regra atual de "sem documento / sem parecer" de `awaitingSendRule`).
- Enviadas ao Brasil: `enviado`.
- Em análise no Brasil: `em_analise` — passa a incluir `em_analise`, `em_revisao` e `contestado`.
- Retorno: ajustes: `devolvido` — passa a incluir `rejeitado` e `devolvido_china`.
- Aprovados: `aprovado` — passa a incluir `ciencia`.

Nenhum documento pode ficar fora de todas as pastas: acrescentar uma verificação que garante que a soma das pastas cobre todos os itens do dataset.

### 3. Kanban e barra de progresso pelo mesmo bucket

- `MailboxKanban.tsx`: remover o `bucketForDoc` local e usar `bucketFluxo`, com a coluna derivada por um mapa único bucket→coluna (por perspectiva Brasil/China).
- `groupMailboxItems.ts`: `classifyForProgress` passa a derivar de `bucketFluxo` em vez da cadeia de `if` própria, para os contadores "Aprovados / Em análise / Enviados / Devolvidos / Pendentes" baterem com as colunas.
- `flowTones.ts`: `bucketForDoc` vira um adaptador fino sobre `bucketFluxo`, corrigindo a inversão atual em que `pendente` era exibido como "em análise".

### 4. Checklist

`ChinaProdutoChecklistStatus.tsx`, `ChinaChecklistFocusMode.tsx`, `ChinaPainelAprovacao.tsx`, `ChinaRecebimentos.tsx` e `CofreSubmissaoDialog.tsx` hoje repetem `status === "aprovado" || status === "ciencia"` em linha. Todos passam a chamar o helper único, para o "3 de 11 enviados" do Checklist nascer da mesma contagem do Kanban.

### 5. Testes de regressão

- Teste unitário de tabela: para cada status existente no banco, um caso fixando bucket, pasta e coluna esperados.
- Teste de cobertura: nenhum status conhecido pode resultar em "fora de todas as pastas".
- Teste de consistência: dado um conjunto de documentos, os contadores do Kanban, das pastas e do progresso do Checklist coincidem.

## Detalhes técnicos

Arquivos afetados: `src/lib/china/docStatus.ts` (fonte única), `src/lib/china/flowTones.ts`, `src/lib/china/groupMailboxItems.ts`, `src/hooks/useChinaMailbox.ts`, `src/components/china/inbox/MailboxKanban.tsx`, `src/pages/ChinaProdutoChecklistStatus.tsx`, `src/components/china/ChinaChecklistFocusMode.tsx`, `src/components/china/ChinaPainelAprovacao.tsx`, `src/pages/ChinaRecebimentos.tsx`, `src/components/china/CofreSubmissaoDialog.tsx`, mais os testes em `src/lib/china/__tests__/`.

Nenhuma alteração de banco de dados e nenhuma migração de dados: os valores gravados permanecem como estão, muda apenas a interpretação. Bump de `APP_VERSION` ao final.
