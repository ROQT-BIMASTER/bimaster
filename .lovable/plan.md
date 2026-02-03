

# Plano: Adicionar Evidências às Solicitações de Verba, Lançamentos e Investimentos

## Resumo

Implementar a possibilidade de anexar evidências ao solicitar verbas, incluindo:
1. **Vincular Campanha ou Despesa existente** como justificativa
2. **Upload de documentos** (PDF, imagens, Word) para comprovar a necessidade

Isso se aplica a:
- Solicitações de nova verba (`SolicitarOrcamentoDialog`)
- Solicitações de complemento de saldo (`SolicitarComplementoDialog`)
- Lançamentos financeiros (`NovoLancamentoDialog`) - já possui upload de fotos, adicionar vínculo de campanha
- Investimentos - já possuem campo `campaign_id`, adicionar upload de documentos

---

## Arquitetura Existente

| Recurso | Status |
|---------|--------|
| Bucket `trade-budget-docs` | Já existe com RLS configurado |
| Componente `BudgetDocumentUpload` | Já existe e pode ser reutilizado |
| Tabela `trade_budget_documents` | Já existe para vincular documentos a verbas |
| Campo `campaign_id` em `trade_investments` | Já existe |
| Campo `campaign_id` em `trade_financial_entries` | Já existe |
| Upload de fotos em `NovoLancamentoDialog` | Já implementado |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/trade/BudgetEvidenceSection.tsx` | **Criar** | Componente reutilizável com seleção de campanha/despesa + upload de documentos |
| `src/components/trade/SolicitarOrcamentoDialog.tsx` | **Modificar** | Integrar seção de evidências |
| `src/components/trade/SolicitarComplementoDialog.tsx` | **Modificar** | Integrar seção de evidências |
| `src/components/trade/NovoLancamentoDialog.tsx` | **Modificar** | Adicionar seleção de campanha vinculada |
| `src/pages/TradeFinanceiro.tsx` | **Modificar** | Adicionar upload de documentos nos investimentos |

---

## Detalhes de Implementação

### 1. Novo Componente: BudgetEvidenceSection

Componente modular que encapsula:

**a) Vinculação com Campanha/Despesa:**
```
┌─────────────────────────────────────────────────────────┐
│ 📎 Evidências de Necessidade (Opcional)                 │
│                                                         │
│ Vincular a:                                             │
│ ○ Campanha existente                                    │
│   [Select: CAMP-2025-01 - Verão Praia        ▼]        │
│                                                         │
│ ○ Despesa/Lançamento existente                         │
│   [Select: LAN-2025-001 - Material PDV        ▼]       │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ OU Anexar Documentos                                    │
│                                                         │
│ [📄 Proposta_Comercial.pdf  2.1MB           ✕]         │
│ [🖼️ Orcamento_Fornecedor.jpg 450KB          ✕]         │
│                                                         │
│         [📤 Anexar Documentos]                          │
│   PDF, imagens ou Word (máx. 10MB cada, até 5 arquivos) │
└─────────────────────────────────────────────────────────┘
```

**Props do componente:**
```typescript
interface BudgetEvidenceSectionProps {
  linkedCampaignId?: string;
  onCampaignChange: (id: string | null) => void;
  linkedEntryId?: string;
  onEntryChange: (id: string | null) => void;
  uploadedFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  showCampaignLink?: boolean; // default: true
  showEntryLink?: boolean; // default: true
  showUpload?: boolean; // default: true
}
```

**Lógica de busca:**
- Campanhas: Buscar campanhas ativas/aprovadas da tabela `trade_campaigns`
- Despesas/Lançamentos: Buscar lançamentos recentes da tabela `trade_financial_entries`

### 2. Modificações no SolicitarOrcamentoDialog

**Novos estados:**
```typescript
const [linkedCampaignId, setLinkedCampaignId] = useState<string | null>(null);
const [linkedEntryId, setLinkedEntryId] = useState<string | null>(null);
const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
```

**No submit:**
- Salvar `linkedCampaignId` e `linkedEntryId` no campo `notes` como referência estruturada
- Após criar o budget, inserir documentos na tabela `trade_budget_documents`

**Estrutura do notes com evidências:**
```
Justificativa do usuário...

---
Evidências:
- Campanha vinculada: CAMP-2025-01 (uuid)
- Lançamento vinculado: LAN-001 (uuid)
- Documentos anexados: 2
```

### 3. Modificações no SolicitarComplementoDialog

Mesma estrutura do `SolicitarOrcamentoDialog`:
- Adicionar `BudgetEvidenceSection`
- A campanha é pré-vinculada se vier do contexto de aprovação
- Permitir anexar documentos adicionais

### 4. Modificações no NovoLancamentoDialog

O dialog já possui:
- Upload de fotos (`trade-photos` bucket)
- Campo `document_url` para URL externa

**Adicionar:**
- Select para vincular a uma campanha existente (campo `campaign_id` já existe na tabela)
- Exibir informações da campanha selecionada

### 5. Modificações nos Investimentos (TradeFinanceiro.tsx)

O formulário de investimento já possui campo `campaign_id`.

**Adicionar:**
- Botão para upload de comprovante/recibo (`receipt_url` já existe na tabela)
- Usar o componente `BudgetDocumentUpload` existente

---

## Fluxo de Dados

```text
Usuário solicita verba
        ↓
Preenche dados básicos
        ↓
[Opcional] Vincula campanha/despesa como evidência
        ↓
[Opcional] Faz upload de documentos
        ↓
Salva solicitação em trade_budgets
        ↓
Salva documentos em trade_budget_documents (FK para budget_id)
        ↓
Financeiro vê solicitação com evidências
        ↓
Pode visualizar campanha/despesa vinculada
        ↓
Pode baixar/visualizar documentos anexados
```

---

## Modelo de Dados

**Tabela `trade_budget_documents` (já existe):**
- `budget_id` → FK para `trade_budgets`
- `file_name`, `file_path`, `file_url`, `file_type`, `file_size`
- `uploaded_by`, `created_at`

**Novas referências no campo `notes` de `trade_budgets`:**
As referências às campanhas/despesas vinculadas serão salvas como metadados no campo `notes`, usando um formato estruturado que pode ser parseado posteriormente:

```
[evidencia:campanha:uuid]
[evidencia:lancamento:uuid]
```

Alternativamente, podemos criar campos dedicados na tabela se necessário no futuro.

---

## Benefícios

1. **Rastreabilidade**: Financeiro sabe exatamente qual campanha/despesa motivou a solicitação
2. **Documentação**: Comprovantes anexados dão suporte objetivo à aprovação
3. **Auditoria**: Histórico completo de evidências para cada verba
4. **Reutilização**: Componente `BudgetEvidenceSection` pode ser usado em qualquer formulário

---

## Validações

- Campanhas: Exibir apenas as com status `approved`, `active`, ou `pending_approval`
- Lançamentos: Exibir apenas os últimos 50 lançamentos (para performance)
- Documentos: Validar tipo (PDF, imagem, Word) e tamanho (máx. 10MB)
- Máximo de 5 documentos por solicitação

---

## Resultado Esperado

1. Ao solicitar nova verba, usuário pode vincular campanha/despesa existente
2. Ao solicitar complemento, mesmas opções de evidência
3. Ao criar lançamento, pode vincular a uma campanha
4. Ao criar investimento, pode anexar comprovantes
5. Financeiro visualiza todas as evidências no momento da aprovação

