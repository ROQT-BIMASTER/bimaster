

## Checklist com Visibilidade de Progresso e Previsão de Envio

### Problema

A China envia documentos de forma incremental ao longo do mês. Hoje não há como saber rapidamente o que já foi enviado, o que falta, e quando cada item será enviado. A interface precisa ser mais visual e informativa.

### Solução

Melhorar o **ChinaChecklistFocusMode** com:

1. **Cards com indicação visual clara**: cada tipo de documento mostra um estado visual distinto — vazio (cinza tracejado), rascunho (amarelo), enviado (azul), aprovado (verde), rejeitado (vermelho)
2. **Barra de progresso por categoria** na sidebar com mini progress bar colorida
3. **Previsão de envio opcional**: campo de data clicável em cada card vazio, salvo na tabela `china_produto_documentos` via novo campo `previsao_envio`
4. **Resumo visual no header**: contadores de "Enviados / Pendentes / Faltando" com ícones

### Database

Adicionar campo opcional à tabela `china_produto_documentos`:

```sql
ALTER TABLE china_produto_documentos 
  ADD COLUMN IF NOT EXISTS previsao_envio DATE;
```

### UI — Cards Aprimorados

Cada card de tipo de documento no grid principal terá:

```text
┌─────────────────────────────────────────┐
│ 🏷️ Volumetria (容量)          [Upload] │
│                                         │
│  ── Sem arquivo ──                      │
│  Previsão: [📅 Selecionar data]         │
│                                         │
│  ⬚ Aguardando envio                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✅ Planilha Excel (Excel表格)  [Upload] │
│                                         │
│  📄 planilha_v2.xlsx    ✓ Aprovado      │
│                                         │
│  ✅ Completo                            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📝 Faca Primária (初级刀模)    [Upload] │
│                                         │
│  📄 faca.pdf    📝 Rascunho   [☐]      │
│  Previsão: 20/03/2026                   │
│                                         │
│  ⏳ Rascunho salvo                      │
└─────────────────────────────────────────┘
```

### Sidebar Aprimorada

Cada categoria na sidebar ganha uma mini progress bar:

```text
CHINA ENVIA 中国发送
├── Dados Oficiais      ████░░ 1/1 ✓
├── Fotos da Planilha   ██░░░░ 2/8
├── Imagens Gerais      ░░░░░░ 0/2
├── Rotulagem           █░░░░░ 1/3
└── Embalagem           ░░░░░░ 0/6
───────────────────────
BRASIL ENVIA 巴西发送
├── Etiquetas           ░░░░░░ 0/3
└── ...
```

### Header com Resumo

No header do Focus Mode, adicionar contadores visuais:

- 🟢 **X Aprovados** | 🔵 **Y Enviados** | 📝 **Z Rascunhos** | ⬜ **W Faltando** | 📅 **N com Previsão**

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/china/ChinaChecklistFocusMode.tsx` | **Editar** — Adicionar mini progress bars na sidebar, contadores no header, campo de previsão nos cards, melhor sinalização visual por status |
| DB Migration | **Nova** — Adicionar coluna `previsao_envio` à tabela `china_produto_documentos` |

### Detalhes da Previsão de Envio

- Campo `DatePicker` discreto dentro de cada card vazio ou rascunho
- Ao selecionar data, salva via upsert: insere um registro "placeholder" no `china_produto_documentos` com `status: 'planejado'` e `previsao_envio: data`, sem arquivo
- Cards com previsão mostram badge "📅 20/03" no canto
- Na sidebar, tipos com previsão definida mostram indicador visual (dot azul)
- Novo status `planejado` adicionado ao `STATUS_LABELS` em `china-document-types.ts`

