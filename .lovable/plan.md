

# Implementar Fluxo Completo: Arte Final + EAN + Doc Regulatória + Categorias

## Situação Atual

O plano anterior foi aprovado mas **não implementado**. Faltam no sistema:

1. **Documentação regulatória** e **Volumetria** no checklist de documentos
2. **Categorização** dos documentos (Rotulagem vs Embalagem)
3. **Resposta Brasil → China** (envio de arte final + EAN caixa master)
4. **Validação obrigatória** de foto/vídeo para embalagem primária e display
5. **Status `arte_enviada`** no workflow
6. **Campo EAN caixa master** na OC

## Implementação

### 1. Migração SQL

Adicionar campos à `china_produto_submissoes`:
- `arte_final_url text`, `arte_final_path text`, `arte_final_enviada_em timestamptz`
- `ean_caixa_master text`

Adicionar campo à `china_ordens_compra`:
- `ean_caixa_master text`

### 2. Atualizar `china-document-types.ts`

Adicionar 2 novos tipos de documento:
- `volumetria` — "Volumetria (Líquido e Bruto) / 容量（液体和总重）"
- `doc_regulatoria` — "Documentação Regulatória / 法规文件"

Agrupar em categorias com export separado:
- **Rotulagem 标签**: `volumetria`, `formula`, `doc_regulatoria`
- **Embalagem 包装**: `faca_primaria`, `faca_display`, `faca_cartucho`, `faca_tester`, `faca_etiqueta_fundo`, `faca_etiqueta_bula`, `faca_etiqueta_tester`, `amostra_foto`, `amostra_video`

Adicionar status `arte_enviada` ao `STATUS_LABELS`.

### 3. Atualizar `ChinaNovaSubmissao.tsx`

- Exibir documentos agrupados por categoria (Rotulagem / Embalagem) com headers bilíngues
- Validação visual: alerta se `amostra_foto` ou `amostra_video` não foram enviados (obrigatórios para primária/display)

### 4. Atualizar `ChinaRecebimentos.tsx`

- Exibir documentos agrupados por categoria
- Nova seção **"Resposta Brasil 巴西回复"** visível quando status = `aprovado`:
  - Upload de arte final (arquivo)
  - Input EAN caixa master
  - Botão "Enviar Arte + EAN 发送终稿和EAN"
  - Muda status para `arte_enviada`
- Validação: não permite aprovar se faltam foto/vídeo obrigatórios
- Botão "Emitir OC" só aparece quando status = `arte_enviada`

### 5. Atualizar `EmitirOCDialog.tsx`

- Adicionar campo EAN caixa master (preenchido automaticamente da submissão, editável)
- Salvar EAN na OC

### 6. Criar `ChinaSubmissaoDetalhe.tsx`

Página para China visualizar submissão aprovada:
- Dados do produto, grade, pesos
- Quando `arte_enviada`: exibir link para download da arte final + EAN em destaque
- Seção de feedbacks de documentos rejeitados

### 7. Registrar rota `/dashboard/fabrica-china/submissao/:id` no `App.tsx`

### 8. Atualizar `ChinaFabrica.tsx`

- Adicionar card "Arte Enviada 终稿已发送" com contador

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar: arte_final_*, ean_caixa_master |
| `src/lib/china-document-types.ts` | Editar: +volumetria, +doc_regulatoria, categorias, +arte_enviada |
| `src/pages/ChinaNovaSubmissao.tsx` | Editar: docs agrupados por categoria |
| `src/pages/ChinaRecebimentos.tsx` | Editar: seção arte final + EAN + validação obrigatória |
| `src/components/china/EmitirOCDialog.tsx` | Editar: campo EAN |
| `src/pages/ChinaSubmissaoDetalhe.tsx` | Criar: detalhe da submissão (China vê arte + EAN) |
| `src/App.tsx` | Editar: nova rota |
| `src/pages/ChinaFabrica.tsx` | Editar: card arte_enviada |

