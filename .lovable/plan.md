# Indicação visual de status em todo o Checklist da China

## Problema observado

Na tela "Status do Checklist" (visão quadro e visão lista) o status aparece sem cor distinta:

- `em_analise` não existe nos mapas de rótulo/cor daquela tela, então o cartão mostra a chave crua "em_analise" com o cinza padrão (visível no card "Planilha Excel").
- `pendente`, `enviado` e `enviado_brasil` usam exatamente a mesma cor (primária), então não dá para diferenciar "aguardando análise" de "já enviado".
- Os cartões do quadro não têm nenhuma marca de cor além do badge — a leitura à distância fica plana.
- Cada ambiente do checklist mantém a própria tabela de cores (tela de status, Modo Foco, cartões de documento, drawer da tarefa, ações em lote), o que gera divergência de tom para o mesmo status.

## O que será feito

### 1. Paleta única de status

Criar uma fonte única de verdade visual para status de documento, com, para cada estado:

- cor do badge (fundo + texto + borda),
- classe de borda lateral do cartão,
- cor do ponto/indicador,
- ícone.

Paleta proposta (tokens semânticos do projeto, sem cor literal):

```text
Não criado / Rascunho   cinza (muted)          borda tracejada
Pendente de análise     âmbar (warning)        borda sólida
Em análise              azul/primário          borda sólida
Enviado ao Brasil       índigo/accent          borda sólida
Aprovado                verde (success)        borda sólida
Não aprovado / Rejeitado vermelho (destructive) borda sólida
Contestado              âmbar forte            borda sólida
```

O ponto central é: **pendente, em análise e enviado deixam de compartilhar a mesma cor**.

### 2. Aplicar em todos os ambientes do checklist

- Tela Status do Checklist — visão quadro: badge colorido + faixa lateral colorida no cartão + cabeçalho da coluna com o mesmo tom.
- Tela Status do Checklist — visão lista: mesmo badge e um indicador de cor à esquerda da linha.
- Modo Foco do checklist: alinhar as bordas laterais e ícones já existentes à paleta única.
- Cartões de documento e slots de documento.
- Drawer/bloco de documento dentro da tarefa e linha do tempo de homologação.
- Diálogo de ações em lote.

### 3. Rótulos e traduções

- Registrar `em_analise` (e demais estados faltantes) nos rótulos da tela de status, para nunca mais exibir a chave crua.
- Completar as traduções PT/EN/ZH dos estados que hoje só têm chave em português naquela tela.

### 4. Acessibilidade

Cor não será o único sinal: cada status mantém ícone e texto, para leitura em tela monocromática e por daltônicos.

## Detalhes técnicos

- Nova exportação em `src/lib/china/docStatus.ts`: `DOC_STATUS_VISUAL: Record<string, { badge: string; border: string; dot: string; icon: LucideIcon }>` + helper `docStatusVisual(status)` com fallback seguro.
- `src/pages/ChinaProdutoChecklistStatus.tsx`: `STATUS_LABEL` / `STATUS_CLS` / `KANBAN_COLUMNS.accent` passam a derivar do helper; adicionar `em_analise`, `em_revisao`, `enviado_parcial`.
- `src/components/china/ChinaChecklistFocusMode.tsx`: `statusIcons` e `statusBorders` passam a vir do helper.
- Ajustes pontuais em `ChinaDocCard.tsx`, `ChinaDocumentSlot.tsx`, `TarefaDocumentoDrawer.tsx`, `ChinaDocumentoBlock.tsx`, `HomologacaoTimeline.tsx`, `AprovacaoLoteDialog.tsx` para usar a mesma paleta.
- Chaves novas em `src/i18n/china/{pt,en,zh}.json` no bloco `statusChecklist`.
- Sem alteração de banco, RPC, RLS ou regra de negócio — apenas apresentação.
- Bump de `APP_VERSION` e entrada no changelog.
