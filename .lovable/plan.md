## Problema

Na lista da Central de Trabalho, a informação `Seção · Projeto` aparece encostada na borda direita da linha e está sendo cortada (truncada com "..."), mesmo havendo bastante espaço livre no meio da tela. A hierarquia visual também sofre: o usuário lê o título e precisa varrer os olhos até a borda direita para entender a qual projeto/seção a tarefa pertence.

## Objetivo

Reposicionar a "trilha" `Seção · Projeto` para perto do título (à esquerda), aproveitando o espaço disponível e eliminando o corte. Manter prazo e prioridade à direita (informação "operacional"), e a trilha de contexto à esquerda (informação "de localização").

## Novo layout da linha

```text
[ ] [○] ● Título da tarefa     Seção · Projeto              [Alta]   8 dez
 ^   ^   ^                     ^                             ^        ^
sel done cor                   trilha (esquerda, expansível)  prio    prazo
```

- Título: continua com peso visual principal, sem truncar agressivo.
- Trilha `Seção · Projeto`: passa a ficar **logo após o título**, alinhada à esquerda, com largura flexível (até ~40% da linha em telas largas, com `truncate` apenas quando realmente necessário).
- Prioridade e prazo: permanecem à direita, com largura fixa.

## Mudanças (somente UI)

Arquivo: `src/components/projetos/central/MinhasTarefasContent.tsx` — componente `ListRow`.

1. Remover a renderização atual da trilha no fim da linha (bloco `<span className="text-xs hidden lg:inline max-w-[220px] truncate">`).
2. Reestruturar o miolo da linha em duas partes:
   - Um container `flex-1 min-w-0` com `título` + `trilha` lado a lado, ambos podendo encolher (`min-w-0` + `truncate`).
   - O título recebe peso visual principal (`shrink-0` até um limite, depois pode truncar).
   - A trilha ganha mais espaço (`max-w-[40%]` em `lg`, escondida em `md` para baixo) e exibe `Seção · Projeto` com a seção em destaque sutil.
3. Ajustar o gap entre os elementos para respirar melhor (`gap-3` continua, mas o miolo ganha `gap-4` interno entre título e trilha).
4. Garantir que prazo e prioridade fiquem em um wrapper `shrink-0` à direita, para nunca serem comprimidos.
5. Manter o `title` (tooltip nativo) com o caminho completo para casos de truncamento.

## Critérios de aceitação

- A trilha `Seção · Projeto` aparece imediatamente após o título da tarefa, não mais no canto direito.
- Em telas largas (≥ lg), a trilha não fica cortada para os casos atuais ("Desenvolvimento de Produtos · Instituci…", "Criação/Identidade · K | Ruby Rose", etc.).
- Prioridade e prazo continuam visíveis e alinhados à direita, sem sobreposição.
- Em telas estreitas (< lg), a trilha continua oculta, como hoje, para preservar legibilidade.
- Nenhuma mudança em hooks, queries, dados ou lógica de filtros/agrupamento.