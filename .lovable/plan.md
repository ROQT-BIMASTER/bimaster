

# IA para Entender Planilhas e Fotos — China Excel Parser

## Problema

A edge function `parse-china-excel` usa parsing rígido com posições fixas de colunas e padrões hardcoded (ex: "HB-", "COLORS /G1"). Qualquer variação no formato da planilha quebra a extração. Não há suporte para fotos/imagens.

## Solução

Substituir o parser rígido por uma abordagem **IA-first**: a edge function extrai os dados brutos do Excel (todas as linhas/colunas) e envia ao Lovable AI (Gemini) para interpretar o conteúdo de forma inteligente. Além disso, adicionar suporte para upload de **foto/imagem** do produto (print de tela, etiqueta, etc.) que a IA também analisa.

### 1. Reescrever `supabase/functions/parse-china-excel/index.ts`

**Fluxo novo:**
1. Recebe arquivo Excel OU imagem (ou ambos) via FormData
2. Se Excel: lê com SheetJS, converte todas as linhas para texto tabular
3. Envia o texto (e/ou imagem base64) ao Lovable AI Gateway com um prompt estruturado
4. IA retorna JSON com: `produto_codigo`, `produto_nome`, `numero_item`, `numero_ordem`, `formula_codigo`, `qty_total`, `peso_bruto_g`, `peso_liquido_g`, `cores[]`
5. Retorna o JSON parseado ao frontend

**Prompt do sistema:** Instruções específicas para extrair dados de planilhas de produção China (fórmulas, cores por grupo, quantidades, pesos). A IA interpreta qualquer formato de planilha, não depende de posições fixas.

**Modelo:** `google/gemini-2.5-flash` (rápido, bom com tabelas) para Excel; `google/gemini-2.5-pro` para imagens.

### 2. Atualizar `src/pages/ChinaNovaSubmissao.tsx`

- Adicionar opção de upload de **imagem** além do Excel (botão separado ou toggle)
- Quando imagem é enviada, converte para base64 e envia junto no FormData
- Mostrar badge "🤖 IA" nos campos preenchidos automaticamente
- Manter preview dos dados extraídos com opção de edição manual

### 3. Tratamento de erros

- 429 (rate limit) → toast "Limite excedido, tente novamente"
- 402 (créditos) → toast "Créditos esgotados"
- Parse falho → fallback mostrando raw_rows para preenchimento manual

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/parse-china-excel/index.ts` | **Reescrever**: IA-powered parser com suporte a Excel + imagem |
| `src/pages/ChinaNovaSubmissao.tsx` | **Editar**: adicionar upload de imagem, badge IA, fallback manual |

