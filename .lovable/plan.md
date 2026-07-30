## Objetivo

No quadro (Kanban), o usuário deve conseguir: (1) abrir a pré-visualização de qualquer arquivo direto do card, sem entrar na tarefa; (2) ver as imagens em tamanho grande no card, e não em miniaturas de 32px.

## Situação atual (verificada)

- `TarefaAnexosBadge.tsx` exibe apenas um contador, ícones por tipo e até 3 miniaturas de 32×32 (`h-8 w-8`), sem nenhum clique/pré-visualização.
- O card do Kanban (`ProjetoKanbanView.tsx`, bloco "Arquivos da tarefa") só renderiza esse badge.
- Já existe um visualizador, `ChinaDocPreviewDialog`, mas ele é fixo no bucket `china-documentos` — não serve para anexos de projeto (`projeto-anexos`) nem para outros buckets.
- `useTarefasAnexos` já traz por tarefa: nome, `storage_path`, `bucket` e família (imagem, pdf, planilha, vetor, documento).

## O que será feito

**1. Visualizador genérico de arquivos**
Novo componente `src/components/comum/ArquivoPreviewDialog.tsx`, derivado do visualizador da China, porém recebendo o bucket como parâmetro:
- Imagem: exibida em tamanho grande, com zoom por clique.
- PDF: renderizado em iframe.
- Demais formatos (planilhas, vetores, docs): tela de "pré-visualização não disponível" com botão de download seguro (blob autenticado, sem abrir URL direta).
- Navegação anterior/próximo entre os arquivos da mesma tarefa, com nome e tipo no cabeçalho.
- O visualizador da China passa a reutilizar esse componente, mantendo o comportamento atual.

**2. Miniaturas grandes e clicáveis no card**
Reescrita da parte visual de `TarefaAnexosBadge.tsx`:
- Quando houver imagens, mostrar uma faixa de pré-visualização larga no card: a primeira imagem ocupando toda a largura do card com altura confortável (aprox. 128px, `object-cover`, cantos arredondados) e, havendo mais imagens, uma grade de até 3 miniaturas médias abaixo, com selo "+N" quando houver excedente.
- Arquivos não-imagem viram chips clicáveis com ícone e nome abreviado, em vez de apenas ícones mudos.
- Todo item abre o `ArquivoPreviewDialog` no arquivo correspondente; o clique não dispara o drag nem a abertura da tarefa.
- O contador de arquivos continua, agora clicável (abre o primeiro arquivo).
- Respeitar a densidade do quadro: em modo compacto a faixa grande é reduzida; comportamento controlado por uma prop `preview="grande" | "compacto"`.

**3. Integração no Kanban**
- `ProjetoKanbanView.tsx` passa a densidade atual ao badge e mantém o restante do card intacto.
- Card em arraste (overlay) não renderiza a faixa de imagem, para não pesar o drag.

## Detalhes técnicos

- URLs assinadas via `getSignedUrl(bucket, path)` com cache do React Query por ~50 min (padrão já usado hoje), carregamento `lazy` e limite de imagens resolvidas por card para não estourar requisições em quadros grandes.
- Download sempre por `downloadStorageBlob` + `triggerBlobDownload` (nunca `window.open`).
- Somente tokens semânticos de cor; sem cores literais.
- Testes: estender `src/test/integration/kanban-anexos-indicadores.test.ts` cobrindo seleção da imagem de capa, contagem "+N" e classificação de família para abertura no visualizador.
- Bump de `APP_VERSION` com entrada correspondente no changelog.
