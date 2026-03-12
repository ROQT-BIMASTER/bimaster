

## Problema

Ao clicar numa submissão na lista esquerda, ela apenas é "selecionada" visualmente — não abre nenhum detalhamento com os documentos, fotos e informações enviadas pela China. O painel de documentos só aparece depois de vincular a uma tarefa e clicar em "Docs", o que torna impossível ver o conteúdo antes de vincular.

## Plano

### 1. Adicionar painel de detalhamento expandível na submissão selecionada

Quando o usuário clicar numa submissão, expandir abaixo dela (ou em um Sheet lateral) um painel mostrando:

- **Dados do produto**: código, nome, fórmula, EANs, pesos, quantidades, nº ordem
- **Documentos enviados**: lista agrupada por categoria (Embalagem, Arte, Regulatório, etc.) com preview e download
- **Fotos do produto**: thumbnails das fotos (garrafa, display, etc.)
- **Observações**: notas Brasil e China

### 2. Implementação técnica

- Substituir o clique simples na submissão por um **accordion/expandable** inline na lista esquerda
- Quando expandido, carregar os documentos (`useDocumentosDaSubmissao`) e mostrar cards compactos com ícone do tipo, nome e botão de preview
- Cada documento terá botão de preview (abre `ChinaDocPreviewDialog` existente)
- Manter a seleção para o painel direito (vincular ao projeto) funcionando em paralelo

### 3. Estrutura visual

```text
┌─ Submissões China ──────────────────┐
│ [HB-3301] Gloss Labial Hidratante  │
│  ├─ 📄 Embalagem                   │
│  │   ├─ Lote_embalagem_v2.pdf  👁  │
│  │   └─ Arte_rotulo_final.ai   👁  │
│  ├─ 📄 Regulatório                 │
│  │   └─ Ficha_tecnica.pdf      👁  │
│  ├─ 📷 Fotos                       │
│  │   └─ [thumb] [thumb] [thumb]    │
│  └─ Obs: "Verificar cor da tampa"  │
│                                     │
│ [HB-7710] Paleta Sombras Sunset    │
│ ...                                 │
└─────────────────────────────────────┘
```

### Arquivo a modificar
- `src/pages/ProjetoVincularChina.tsx` — adicionar detalhamento expandível inline na lista de submissões com documentos, fotos e dados

