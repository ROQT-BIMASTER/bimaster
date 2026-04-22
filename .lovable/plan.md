

# Persistência de rascunho do Lançamento Rápido (Trade Marketing)

## Problema

Hoje, em `QuickEntryDialog.tsx`, qualquer fechamento do modal — inclusive **clique fora** ou **ESC** — chama `handleClose` (linha 705) que executa `resetForm()` (linha 707) e zera tudo. Quando você sai para outro sistema (Alt+Tab, troca de aba, copiar/colar) e a janela perde foco, qualquer interação ao voltar pode disparar o `onOpenChange` do Radix Dialog, fechando o modal e **perdendo todos os dados** (loja selecionada, fotos enfileiradas, dados de prateleira, observações).

Além disso, mesmo se o modal não fechasse, um F5 acidental ou queda de conexão também perderia tudo, pois nada é persistido.

## Solução

Duas camadas de proteção, sem alterar backend, schema ou Edge Functions.

### 1. Auto-save em `localStorage` (rascunho)

- Persistir `formData` + `currentStep` + `brandMeasurements` em `localStorage` sob a chave `trade:quick-entry:draft:{user_id}` a cada alteração (debounce 500ms).
- Ao **abrir** o modal, se houver rascunho com menos de **24h**, mostrar um banner no topo:
  > "Rascunho encontrado de {tempo_relativo}. [Continuar] [Descartar]"
- Após **sucesso** (visita salva) ou clique em **Descartar**, limpar a chave.
- Arquivos `File` (fotos) **não** entram no `localStorage` (binários grandes). O rascunho preserva todos os campos de texto/seleção/medições; ao restaurar, exibimos um aviso: "Reanexe as fotos — campos de texto foram restaurados."

### 2. Bloqueio de fechamento acidental

- Trocar `onOpenChange={handleClose}` por handler que:
  - Permite fechar livremente se `formData` estiver vazio (sem `store_id`, sem fotos, sem texto).
  - Se houver dados preenchidos, abre um `AlertDialog` de confirmação:
    > "Você tem dados não salvos. Deseja realmente fechar? O rascunho ficará salvo para retomar depois."
    > [Continuar editando] [Salvar rascunho e fechar] [Descartar]
- Adicionar `onPointerDownOutside={(e) => e.preventDefault()}` e `onEscapeKeyDown={(e) => e.preventDefault()}` no `DialogContent` quando houver dados — bloqueia clique-fora e ESC, que são as causas mais comuns de perda ao alternar para outro sistema.
- Adicionar listener `beforeunload` enquanto o modal estiver aberto com dados, alertando antes de F5/fechar aba.

### 3. Indicador visual de auto-save

- Pequeno badge no header do modal: `Rascunho salvo há Xs` (atualiza a cada save), seguindo o padrão sóbrio do projeto (sem emojis, tipografia neutra).

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/trade/QuickEntryDialog.tsx` | Adicionar auto-save, banner de rascunho, confirmação de fechamento, bloqueio outside/ESC, badge de status |
| `src/hooks/useQuickEntryDraft.ts` *(novo)* | Hook isolado: `loadDraft()`, `saveDraft(data)`, `clearDraft()`, `hasDraft()`, debounce 500ms, escopo por `user_id` |

Sem novas tabelas, sem Edge Functions, sem dependências novas.

## Não-escopo

- Sem persistência das fotos (limitação do `localStorage` 5–10MB; fotos seriam upload incompleto em rascunho — fora deste ciclo).
- Sem auto-save server-side (próxima evolução, se necessário).
- Não altera fluxo de envio final, validações ou Edge Functions.
- Sem mudança em outros dialogs Trade (`VisitDetailDialog`, `GenerateFormLinkDialog`).

## Validação pós-implementação

1. Preencher o passo 1, alternar Alt+Tab para outro sistema, copiar dados, voltar — modal **continua aberto** com tudo preenchido.
2. Recarregar a página (F5) durante preenchimento — ao reabrir o modal, banner de rascunho aparece.
3. Tentar fechar com X tendo dados — modal de confirmação aparece.
4. Após salvar visita com sucesso, reabrir modal — sem rascunho residual.

