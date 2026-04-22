

# Plano de Apresentação de Clientes Selecionados — com Exportação para Canva

## Objetivo
Permitir selecionar grupos de clientes (cards Antes/Depois) na tela de Análise de Fotos, gerar um **plano de apresentação** estruturado e exportar em formatos compatíveis com o **Canva**.

## Fluxo de Uso

1. Na visualização "Antes & Depois", cada card recebe um checkbox de seleção no canto superior esquerdo.
2. Ao selecionar 1+ cards, aparece uma **barra de ações fixa no rodapé** (mesmo padrão do `BulkActionsBar` já existente em `comercial`) com: contador de selecionados, botão "Limpar" e botão "Gerar Apresentação".
3. Clicar em **"Gerar Apresentação"** abre um diálogo (`PresentationPlanDialog`) com:
   - Campo **Título** (default: "Apresentação Trade — {data}")
   - Campo **Cliente/Marca** (texto livre, opcional)
   - Campo **Objetivo** (textarea curta, opcional — ex.: "Demonstrar evolução de execução em PDV")
   - Lista preview dos clientes selecionados (loja + endereço + data)
   - Campo de **observações por slide** (textarea opcional por card, com placeholder "Destaques deste PDV")
   - Botões de exportação:
     - **Baixar PPTX (Canva-compatível)** — principal
     - **Baixar PDF**
     - **Baixar pacote de imagens (.zip)**
     - **Como abrir no Canva** (link informativo)

## Estrutura da Apresentação Gerada

Cada apresentação é montada client-side e segue layout fixo:

- **Slide 1 — Capa**: título, cliente/marca, data, contagem de PDVs, logo (placeholder do app).
- **Slide 2 — Objetivo & Sumário**: texto do objetivo + lista numerada dos PDVs.
- **Slides 3..N — Um por card selecionado**:
  - Cabeçalho: Nome da loja (grande) + endereço (cinza, menor) + data formatada
  - Duas colunas lado a lado: **ANTES** (esq.) / **DEPOIS** (dir.) com as imagens em proporção 3:4
  - Rodapé: observação do usuário (se houver) + badge "IA" quando aplicável
- **Slide final — Encerramento**: total de PDVs, período coberto, assinatura do app.

Paleta: rosa Trade (#E91E78) como primária, cinza neutro, branco. Fonte: sistema (sans-serif). Sem emojis, conforme padrão.

## Exportação para Canva

Como o Canva **não tem API pública gratuita de upload programático**, a estratégia é gerar arquivos que o Canva **importa nativamente**:

| Formato | Como o Canva consome | Biblioteca |
|---|---|---|
| **.pptx** (recomendado) | Canva → "Criar design" → "Importar arquivo" → suporta PPTX nativamente, mantém slides editáveis | `pptxgenjs` (já é compatível com browser) |
| **.pdf** | Canva → Importar PDF (cada página vira slide editável) | `jspdf` (já presente em outras telas) ou print-to-PDF do browser |
| **.zip de imagens** | Para usuários que querem montar manualmente no Canva arrastando cada imagem | `jszip` |

O diálogo terá um bloco informativo com 3 passos curtos: **1)** Baixe o PPTX. **2)** No Canva, clique em "Criar design" → "Importar arquivo". **3)** Cada slide vira editável. Sem mencionar plugins externos.

As imagens das fotos (URLs do Supabase Storage) são baixadas como Blob via `fetch` e embutidas em base64 no PPTX/PDF — segue o padrão `triggerBlobDownload` (memory `storage-blob-download-protocol`).

## Arquitetura Técnica

**Novos arquivos:**

| Arquivo | Função |
|---|---|
| `src/components/trade/PresentationPlanDialog.tsx` | Diálogo com formulário + botões de exportação |
| `src/components/trade/PresentationActionsBar.tsx` | Barra fixa no rodapé com contador e CTA "Gerar Apresentação" |
| `src/lib/presentation/buildPptx.ts` | Função `buildTradePresentationPptx(plan, groups): Promise<Blob>` |
| `src/lib/presentation/buildPdf.ts` | Função `buildTradePresentationPdf(plan, groups): Promise<Blob>` |
| `src/lib/presentation/buildImageZip.ts` | Empacota imagens originais + manifest.txt |
| `src/lib/presentation/fetchImageAsBase64.ts` | Helper para baixar Storage URL → base64 |

**Arquivos modificados:**

| Arquivo | Mudança |
|---|---|
| `src/components/trade/PhotoBeforeAfterView.tsx` | Adicionar prop `selectable` + `selectedKeys` + `onToggleSelect`; renderizar `Checkbox` no canto do card; expor `groups` via callback `onGroupsChange` para o pai poder mapear keys → grupos completos |
| `src/pages/TradePhotos.tsx` | Adicionar estado `selectedGroupKeys`, `groupsCache`, abrir `PresentationPlanDialog`, montar `PresentationActionsBar` |

**Dependências novas:** `pptxgenjs` (~600KB gz), `jszip` (já comum). `jspdf` já está no projeto (verificar; se não, adicionar). Sem edge functions, sem mudanças de schema, sem RLS, sem APP_VERSION.

## Validação Pós-Entrega

1. Selecionar 3 cards → barra aparece com "3 selecionados".
2. Gerar PPTX → arquivo abre no PowerPoint/Keynote sem corromper, imagens visíveis.
3. Importar PPTX no Canva (https://canva.com → Criar design → Importar) → cada slide vira editável.
4. Exportar PDF → todas as páginas com Antes/Depois alinhados.
5. ZIP de imagens → contém pastas por loja com `antes.jpg` / `depois.jpg` + `manifest.txt`.
6. Cards sem "Depois" mostram placeholder no slide (não quebram a exportação).
7. Limite suave de 30 cards por exportação para evitar PPTX > 50MB; aviso amigável se exceder.

## Não-escopo

- Sem persistir a apresentação no banco (geração 100% client-side, on-demand).
- Sem integração OAuth com Canva (não há API gratuita estável para upload).
- Sem editor visual interno — o usuário edita no Canva após importar.
- Sem mudanças no fluxo de upload, RLS, edge functions ou módulos fora de Trade Fotos.

