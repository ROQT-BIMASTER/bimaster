

## Separação Visual: China Envia vs China Recebe do Brasil

### Conceito

Reestruturar `DOCUMENT_CATEGORIES` e a UI do checklist em **duas seções visuais distintas** com cores e ícones diferentes:

1. **🔼 China Envia ao Brasil** (azul/primary) — Documentos que a fábrica China produz e submete
2. **🔽 China Recebe do Brasil** (verde/success) — Itens que o Brasil prepara e envia para a China aplicar

### Dados — Reorganizar `china-document-types.ts`

Adicionar campo `fluxo: "china_envia" | "brasil_envia"` em cada `DocumentSlotConfig` e nas categorias. Novos tipos de documento para os itens do Brasil:

**China Envia:**
- Pedido China (planilha_excel)
- Fotos da Planilha (fotos produto, cores, garrafa, etc.)
- Arte Geral / Imagens Gerais
- Composição / Fórmula
- Amostras (fotos + vídeos)

**Brasil Envia (novos tipos):**
- `solicitacao_amostra_fotos` — Solicitação de Amostra: Fotos
- `solicitacao_amostra_videos` — Solicitação de Amostra: Vídeos
- `etiqueta_fundo` — Etiqueta de Fundo
- `etiqueta_tester` — Etiqueta Tester
- `etiqueta_bula` — Etiqueta Bula
- `arte_display` — Arte Display
- `ean_unitario` — EAN Unitário
- `ean_display` — EAN Display
- `ean_caixa` — EAN Caixa Master

### UI — Duas seções na tabela resumo e no Modo Foco

Na tabela resumo (`ChinaFichaProduto`), dividir em dois blocos com headers coloridos:

```text
┌─────────────────────────────────────────────┐
│ ▲ CHINA ENVIA AO BRASIL  中国发送至巴西      │ (header azul)
├─────────────┬──────┬─────────┬──────┬───────┤
│ Pedido China│ 1/1  │ ✓ Ok    │  —   │  —    │
│ Fotos       │ 3/8  │ ⏳ Parc │  1   │  2    │
│ ...         │      │         │      │       │
├─────────────────────────────────────────────┤
│ ▼ BRASIL ENVIA À CHINA  巴西发送至中国       │ (header verde)
├─────────────┬──────┬─────────┬──────┬───────┤
│ Etiq. Fundo │ 0/1  │ — Vazio │  —   │  —    │
│ EAN Unit.   │ 1/1  │ ✓ Ok    │  —   │  —    │
│ ...         │      │         │      │       │
└─────────────┴──────┴─────────┴──────┴───────┘
```

No **Modo Foco** (sidebar), agrupar categorias sob dois headers na sidebar com separador visual.

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/lib/china-document-types.ts` | Adicionar campo `fluxo` às categorias, criar novos `CHINA_DOCUMENT_TYPES` para itens Brasil, reorganizar `DOCUMENT_CATEGORIES` em dois grupos |
| `src/components/china/ChinaDocumentSlot.tsx` | Adicionar prop `fluxo` opcional para estilização (borda azul vs verde) |
| `src/pages/ChinaFichaProduto.tsx` | Renderizar tabela em dois blocos visuais separados por fluxo |
| `src/components/china/ChinaChecklistFocusMode.tsx` | Sidebar com dois grupos separados visualmente |
| `src/pages/ChinaNovaSubmissao.tsx` | Aplicar mesma separação visual na tabela resumo do step de documentos |

