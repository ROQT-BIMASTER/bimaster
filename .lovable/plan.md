

# Módulo Fábrica China — Portal Visual de Envio de Documentos

## Contexto

A fábrica na China envia para o Brasil: (1) uma planilha Excel com dados do produto (cores, quantidades, fórmula, pesos, materiais) e (2) uma série de documentos complementares (facas, amostras, fórmulas, medidas). O módulo precisa ser **extremamente visual e simplificado** — operadores chineses têm dificuldade com português.

## Arquitetura Proposta

### Abordagem: Portal Bilíngue (PT/中文) com Fluxo de Checklist Visual

A China acessa um portal dedicado onde cada produto tem um **checklist visual de entrega** com ícones grandes, drag-and-drop de arquivos e indicadores de status por cores (semáforo). O Brasil recebe tudo centralizado e aprova/rejeita cada item.

```text
┌─────────────────────────────────────────────────┐
│  CHINA (envia)              BRASIL (recebe)     │
│                                                 │
│  Portal Visual ──────────► Painel de Recebimento│
│  - Upload Excel             - Dados parseados   │
│  - Upload Facas/Docs        - Checklist visual  │
│  - Upload Fotos/Vídeos      - Aprovação item    │
│  - Preenche pesos           - Histórico         │
│                                                 │
│  Idioma: 中文/PT toggle     Idioma: PT          │
└─────────────────────────────────────────────────┘
```

---

## Estrutura de Dados

### Nova tabela: `china_produto_submissoes`
Registro central de cada submissão de produto pela China.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| produto_codigo | text | Ex: HB-M300 |
| produto_nome | text | Ex: PERFECT BLEND BASE STICK |
| numero_item | text | Ex: 19 |
| numero_ordem | text | ORDER NUMBER |
| formula_codigo | text | Ex: DS00214-1 |
| qty_total | int | Quantidade total |
| peso_bruto_g | numeric | Peso bruto |
| peso_liquido_g | numeric | Peso líquido |
| peso_tester_g | numeric | Peso tester |
| medidas_display | jsonb | {largura, altura, profundidade} |
| dados_excel | jsonb | Dados completos parseados do Excel |
| status | text | 'rascunho', 'enviado', 'em_revisao', 'aprovado', 'rejeitado' |
| created_by | uuid | Usuário China |
| reviewed_by | uuid | Usuário Brasil |
| observacoes_china | text | — |
| observacoes_brasil | text | — |
| created_at / updated_at | timestamptz | — |

### Nova tabela: `china_produto_documentos`
Cada documento/arquivo associado a uma submissão.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| submissao_id | uuid FK | → china_produto_submissoes |
| tipo_documento | text | 'formula', 'faca_primaria', 'faca_display', 'faca_cartucho', 'faca_tester', 'faca_etiqueta_fundo', 'faca_etiqueta_bula', 'faca_etiqueta_tester', 'amostra_foto', 'amostra_video', 'planilha_excel', 'outro' |
| arquivo_url | text | URL no storage |
| nome_arquivo | text | — |
| status | text | 'pendente', 'aprovado', 'rejeitado' |
| observacao | text | Feedback do Brasil |
| created_at | timestamptz | — |

### Nova tabela: `china_produto_cores`
Grade de cores parseada do Excel.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | — |
| submissao_id | uuid FK | — |
| grupo | text | Ex: G1, G2, G3 |
| cor_nome | text | Ex: COR1 |
| quantidade | int | Ex: 6 |

### Storage bucket: `china-documentos` (privado)

---

## Páginas e Componentes

### 1. Landing Page China — `/dashboard/fabrica-china`
- Card grid com ícones grandes: "Nova Submissão 新提交", "Minhas Submissões 我的提交", "Status de Aprovação 审批状态"
- Toggle de idioma PT/中文 no header
- Design com cores e ícones maiores que o padrão

### 2. Nova Submissão — `/dashboard/fabrica-china/nova`
Wizard de 3 etapas visuais:

**Etapa 1 — Upload da Planilha (上传表格)**
- Drag-and-drop zone grande para o Excel
- Sistema parseia automaticamente via edge function (extrai produto, cores, fórmula, pesos, quantidades)
- Preview visual dos dados extraídos em cards coloridos

**Etapa 2 — Checklist de Documentos (文件清单)**
- Grid de 12 "slots" visuais (um para cada tipo de documento)
- Cada slot: ícone grande + nome PT/中文 + zona de upload
- Semáforo: cinza (não enviado), amarelo (enviado), verde (aprovado), vermelho (rejeitado)
- Slots: Fórmula, Faca Primária, Faca Display, Faca Cartucho, Faca Tester, Faca Etiqueta Fundo, Faca Etiqueta Bula, Faca Etiqueta Tester, Amostra Embalagem (fotos), Amostra Embalagem (vídeos)

**Etapa 3 — Pesos e Medidas (重量和尺寸)**
- Campos numéricos grandes com labels bilíngues
- Peso bruto/líquido, peso tester, medidas do display
- Botão "Enviar para aprovação / 提交审批"

### 3. Painel Brasil — `/dashboard/fabrica-china/recebimentos`
- Lista de submissões com status semáforo
- Detalhe: todos os dados parseados + documentos com botão aprovar/rejeitar por item
- Observações por documento
- Botão de aprovar tudo ou rejeitar com motivo

### 4. Edge Function: `parse-china-excel`
- Recebe o arquivo Excel
- Extrai: produto, cores por grupo, fórmula, quantidades, pesos, materiais
- Retorna JSON estruturado para preencher o formulário

---

## Componentes Novos

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/ChinaFabrica.tsx` | Landing page visual |
| `src/pages/ChinaNovaSubmissao.tsx` | Wizard 3 etapas |
| `src/pages/ChinaRecebimentos.tsx` | Painel Brasil |
| `src/components/china/ChinaDocumentSlot.tsx` | Slot visual para upload de documento |
| `src/components/china/ChinaExcelPreview.tsx` | Preview dos dados extraídos |
| `src/components/china/ChinaSubmissaoDetalhe.tsx` | Detalhe completo da submissão |
| `src/components/china/BilingualLabel.tsx` | Componente de label PT/中文 |
| `supabase/functions/parse-china-excel/index.ts` | Parser do Excel |

---

## Internacionalização Simplificada

Em vez de i18n completo, usar um componente `BilingualLabel` que renderiza ambos idiomas simultaneamente:

```text
┌──────────────────────┐
│  Fórmula             │  ← PT em destaque
│  配方                 │  ← 中文 menor, cinza
│  ┌────────────────┐  │
│  │  Drop file here│  │
│  └────────────────┘  │
│  ● Pendente 待处理    │
└──────────────────────┘
```

Isso evita que o operador chinês precise escolher idioma — ambos estão sempre visíveis.

---

## Rotas

```
/dashboard/fabrica-china          → ChinaFabrica (landing)
/dashboard/fabrica-china/nova     → ChinaNovaSubmissao (wizard)
/dashboard/fabrica-china/recebimentos → ChinaRecebimentos (painel Brasil)
/dashboard/fabrica-china/:id      → Detalhe da submissão
```

---

## Sequência de Implementação

1. Migração SQL (3 tabelas + bucket + RLS)
2. Edge function `parse-china-excel`
3. Componentes base (`BilingualLabel`, `ChinaDocumentSlot`)
4. Landing page + Wizard de submissão
5. Painel de recebimento Brasil
6. Rotas no App.tsx

