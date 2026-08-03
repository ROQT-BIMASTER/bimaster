# Correção dos tooltips do card no Quadro (Kanban)

## O problema

Os tooltips (prazo/SLA, anexos, badges) falham dentro dos cards do Quadro: aparecem cortados, somem antes da leitura ou ficam presos na tela ao arrastar o card.

Causa confirmada na leitura do código:

- O componente base de tooltip (`src/components/ui/tooltip.tsx`) renderiza o conteúdo **dentro do próprio card**, sem portal. Como o card usa `overflow-hidden` e a coluna usa rolagem horizontal/vertical, o balão é recortado nas bordas.
- Não há proteção contra colisão com as bordas da tela, então o balão sai da área visível nas colunas das pontas.
- Cada badge cria seu próprio provedor de tooltip, mesmo já existindo um global no app — isso gera atrasos e comportamentos diferentes entre um badge e outro.
- Ao arrastar o card, o balão aberto continua na tela porque nada o fecha no início do arraste.

## O que será feito

1. **Balão sempre por cima e nunca cortado**
   - Passar a renderizar o conteúdo do tooltip em camada própria (portal), fora do card.
   - Ativar reposicionamento automático quando encostar na borda da janela, com margem de segurança.

2. **Comportamento uniforme**
   - Padronizar o atraso de abertura e permitir que o cursor passe sobre o balão sem que ele feche imediatamente.
   - Remover os provedores duplicados nos badges do card (prazo, SLA, anexos, subtarefas), usando o provedor global do app.

3. **Arrastar não deixa balão preso**
   - Fechar qualquer tooltip aberto ao iniciar o arraste de um card e não reabrir enquanto o card estiver sendo movido.

4. **Toque e teclado**
   - Garantir abertura por foco (Tab) e evitar que o tooltip dispare por toque em telas sensíveis, onde já existe o clique/abertura do card.

5. **Testes**
   - Teste de integração cobrindo: tooltip aparece no hover do selo de prazo, mostra limite e origem, fecha ao iniciar arraste e abre por foco de teclado.

## Detalhes técnicos

- `src/components/ui/tooltip.tsx`: envolver `TooltipPrimitive.Content` em `TooltipPrimitive.Portal`, com `avoidCollisions`, `collisionPadding` e `sideOffset` padrão.
- `src/components/projetos/SLACountdownPill.tsx`, `SlaStatusBadge.tsx`, `TarefaAnexosBadge.tsx`: remover `TooltipProvider` local (o global já está em `App.tsx` com `delayDuration={0}`) e usar `delayDuration` no `Tooltip` quando necessário.
- `src/components/projetos/ProjetoKanbanView.tsx`: no `onDragStart` do dnd, disparar fechamento (estado `isDragging` propagado aos badges via prop `disableTooltip`, ou `document` blur/escape sintético) e reativar no `onDragEnd`.
- Ajuste de `z-index` do conteúdo para ficar acima do overlay de arraste.
- Novo teste em `src/test/` com Testing Library cobrindo os quatro cenários; sem mudanças de dados ou backend.
- Bump de `APP_VERSION` para 3.9.5.

## Fora de escopo

Nenhuma alteração de regra de SLA, prazos ou dados — apenas apresentação.
