

# Solicitação de Materiais Vinculados ao Formulário

## Resumo

Quando materiais estão vinculados a um formulário dinâmico, transformar a exibição deles de cards informativos para cards interativos com botão "Solicitar". Ao clicar, abrir um mini-formulário inline (loja + quantidade) que gera uma solicitação em `trade_material_solicitacoes` — o mesmo fluxo já existente no `MaterialOrderSheet`, reaproveitando a lógica de criação.

As solicitações geradas ficam vinculadas à resposta do formulário (via metadata), permitindo rastreabilidade e aprovação pelo fluxo já existente de materiais.

## Alterações

### 1. `src/components/forms/DynamicFormRenderer.tsx`

**Substituir** os cards estáticos de materiais por cards interativos:
- Cada material vinculado exibe foto, nome, descrição + botão "Solicitar"
- Ao clicar "Solicitar", expande um painel inline com:
  - Seletor de loja (Combobox com busca, reutilizando `useFilteredStores`)
  - Seletor de quantidade (+/- com limites do material)
  - Botão "Confirmar Solicitação"
- Ao confirmar, insere em `trade_material_solicitacoes` com metadata `{ origem: "formulario", form_id, response_id }`
- Exibe badge "Solicitado ✓" após envio, impedindo duplicidade
- As solicitações são feitas **antes** do submit do formulário (independentes) ou **junto** — salvar no estado e submeter após o form submit

### 2. Novo componente `src/components/forms/MaterialRequestCard.tsx`

Card encapsulado para cada material vinculado:
- Props: `material`, `formId`, `onRequested`
- Usa `useFilteredStores` para seletor de loja
- Usa `useCreateSolicitacao` de `useTradeMateriais`
- Estados: idle → selecting → submitted
- Gera protocolo no mesmo formato `MAT-YYMMDD-XXXX`

### 3. Fluxo

```text
Formulário carrega → materiais vinculados exibidos como cards
  → Usuário clica "Solicitar" em material X
    → Expande: [Loja ▼] [Qtd: 1 +/-] [Confirmar]
    → Confirma → trade_material_solicitacoes.insert(...)
    → Card muda para "✓ Solicitado — Protocolo MAT-XXXX"
  → Usuário preenche campos normais do formulário
  → Submit do formulário registra as respostas normalmente
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/forms/MaterialRequestCard.tsx` | Novo — card interativo de solicitação |
| `src/components/forms/DynamicFormRenderer.tsx` | Substituir cards estáticos por `MaterialRequestCard` |

Nenhuma migration necessária — reutiliza `trade_material_solicitacoes` existente.

