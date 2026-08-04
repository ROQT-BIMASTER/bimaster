# Corrigir o fundo e o enquadramento do diálogo "Ações em lote nos documentos"

Na captura enviada, a janela aparece desconfigurada: os itens da lista e as etiquetas de status "vazam" para fora do cartão branco, o fundo escurecido atrás da janela não cobre a tela toda, e o conteúdo fica mais alto que a área visível (o rodapé com senha e botões encosta nas bordas).

## O que será ajustado

1. **Fundo/overlay** — garantir que a camada escura cubra toda a tela atrás da janela, com desfoque leve, e que a janela fique sempre acima dela.
2. **Altura da janela** — limitar a altura ao tamanho da tela; cabeçalho e rodapé (parecer, senha, botões) ficam fixos e apenas o miolo rola.
3. **Vazamento horizontal** — impedir que nomes longos de arquivo e as etiquetas de status ultrapassem a largura do cartão; textos truncam e as etiquetas encolhem em vez de empurrar o layout.
4. **Campo de senha** — usar os mesmos tokens de fundo/borda dos demais campos, hoje ele destoa com um bloco cinza-azulado.
5. **Barras de filtro** — permitir quebra de linha sem estourar a largura em telas menores.

## Detalhes técnicos

- `src/components/ui/dialog.tsx`: overlay com cobertura total e z-index consistente; conteúdo com `max-h-[90dvh]` e layout em coluna com área rolável.
- `src/components/projetos/AprovacaoLoteDialog.tsx`: `DialogContent` passa a usar altura máxima + `overflow-hidden`; a lista de documentos e o bloco de parecer/senha ficam dentro do container rolável; `min-w-0` e `shrink-0` nos itens/badges; classe do input de senha normalizada para os tokens semânticos.
- Sem mudanças de regra de negócio: apenas apresentação.

## Verificação

- Abrir o diálogo com muitos documentos em janela baixa (~800px de altura) e confirmar: overlay cobrindo, rodapé visível, lista rolando internamente, nenhum elemento fora do cartão.
- Bump de `APP_VERSION` com entrada no changelog em `src/pages/admin/ApiDocumentation.tsx`.
