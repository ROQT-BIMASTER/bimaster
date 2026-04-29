# Diagnóstico do travamento + instrumentação + modo seguro

## Status atual

A causa raiz do travamento já foi corrigida na rodada anterior: o `useEffect` em
`src/components/china/ChinaDataValidationDialog.tsx` (linhas 80–91) tinha
`initialData` como dependência. Como pais (`ChinaExcelPreview`,
`ChinaNovaSubmissao`) passavam um objeto novo a cada render, o efeito disparava
5 `setState` em loop, saturando o thread principal e fazendo o sistema inteiro
piscar/travar.

Esta segunda passada cobre o que o usuário pediu agora: **instrumentação** para
confirmar a correção e **um interruptor de segurança** para o card avançado, sem
mexer em navegação.

## 1. Logs de re-render (somente em dev)

Adicionar instrumentação leve em `ChinaDataValidationDialog.tsx`:

- Contador de renders por instância via `useRef`. Loga a cada render no formato:
  `[ChinaDataValidationDialog] render #N open=… mode=…`.
- Detecção de estouro: se mais de 30 renders ocorrerem em menos de 1s, loga um
  `console.error` único com `"runaway re-render detected"` e dump de
  `qty_per_display`, `display_type`, `displayUnit`, `displaysPerMaster`, `cores.length`.
- `useEffect` separado para logar mudança de identidade de `initialData`
  (`prevRef.current !== initialData`) sem disparar setState — só observação.
- `useEffect` para logar transição de `open` (abre/fecha) e o reset do estado.
- Todos os logs guardados sob `if (import.meta.env.DEV)` para não poluir
  produção.

Sem instrumentação no resto do sistema — o escopo do bug está confinado a este
diálogo.

## 2. Modo seguro do card "Displays / Master"

Adicionar um interruptor para desligar o cálculo avançado sem afetar nada além
do próprio card:

- Flag local: `localStorage.getItem("china.displaysPerMaster.safeMode") === "1"`
  lida uma vez via `useState` inicializador (sem efeitos, sem re-render extra).
- Quando ativa:
  - Não calcula `displayUnit` nem `displaysPerMaster` (retornam 0/`null`).
  - O bloco do card mostra apenas o valor bruto de `qty_per_display` e o texto
    "Modo seguro ativo — fórmula desativada" + um pequeno botão "Reativar".
  - Botão "Desativar fórmula" no rodapé do card grava a flag e chama
    `setSafeMode(true)`. Botão "Reativar" limpa.
- Como o cálculo é puro (sem efeitos colaterais hoje), o "modo seguro" funciona
  como kill-switch defensivo: se algum dia o parser do `display_type` voltar a
  causar problema, o usuário desliga em 1 clique sem precisar de deploy.
- Zero impacto em navegação, RLS, ou em qualquer outra tela.

## 3. Confirmação da correção do loop

A correção já está aplicada (linhas 80–91, dep array reduzida para `[open]`).
Esta passada apenas reforça a defesa:

- Manter o `eslint-disable` com comentário explicativo já presente.
- Garantir, via os logs do passo 1, que ao abrir e editar campos do diálogo o
  contador de renders fique em ordem de grandeza esperada (≤ ~5 por interação),
  e que o detector de runaway não dispare.

## Arquivos afetados

- `src/components/china/ChinaDataValidationDialog.tsx` — único arquivo alterado:
  adicionar refs/efeitos de log, estado `safeMode`, condicional no card e
  botão de toggle. Nenhuma mudança em outros componentes ou em rotas.

## Validação manual

1. Abrir `/dashboard/projetos/central` — UI responde sem piscar (já corrigido).
2. Abrir o fluxo China → Excel Preview → editar dados:
   - Console mostra `render #1`, `render #2`… em pequenas quantidades por
     interação; sem `runaway re-render detected`.
   - Card "Displays / Master" calcula corretamente.
3. Clicar "Desativar fórmula": card mostra modo seguro, valor bruto preservado.
4. Recarregar página: estado do modo seguro persiste via `localStorage`.
5. Clicar "Reativar": fórmula volta sem reload.
