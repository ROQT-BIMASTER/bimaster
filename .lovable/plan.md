
# Plano: Obrigar Visualizacao e Assinatura de Anexos na Aprovacao

## Contexto

Na Central de Pagamentos, ao revisar solicitacoes de pagamento vindas de despesas de eventos, o financeiro precisa:
1. Visualizar todos os documentos anexados a despesa
2. Obrigatoriamente abrir cada arquivo para revisao
3. Confirmar/assinar que esta ciente do conteudo de cada documento
4. So entao poder aprovar ou rejeitar o pagamento

Atualmente, a tabela `financial_payment_queue` possui apenas uma coluna `attachment_url` (texto unico), enquanto as despesas de eventos (`corporate_event_expenses`) possuem uma coluna `attachments` (JSONB com array de arquivos).

---

## Arquitetura da Solucao

```text
+-------------------------------------------+
|       DIALOG DE REVISAO DE PAGAMENTO       |
+-------------------------------------------+
|                                           |
|  Dados do Fornecedor / Valor / Vencimento |
|                                           |
+-------------------------------------------+
|  DOCUMENTOS ANEXADOS (obrigatorio)        |
+-------------------------------------------+
|                                           |
|  +---------------------------------------+|
|  | Arquivo 1.pdf              [Abrir]    ||
|  | [ ] Li e estou ciente                 ||
|  +---------------------------------------+|
|                                           |
|  +---------------------------------------+|
|  | Nota_Fiscal.pdf            [Abrir]    ||
|  | [X] Li e estou ciente  (habilitado    ||
|  |     apos clicar em Abrir)             ||
|  +---------------------------------------+|
|                                           |
|  +---------------------------------------+|
|  | Boleto.pdf                 [Abrir]    ||
|  | [ ] Li e estou ciente (desabilitado)  ||
|  +---------------------------------------+|
|                                           |
+-------------------------------------------+
|                                           |
|  Aviso: Voce deve abrir e confirmar       |
|  ciencia de todos os 3 documentos         |
|  antes de aprovar.                        |
|                                           |
+-------------------------------------------+
|           [Rejeitar]  [Aceitar] (disabled)|
+-------------------------------------------+
```

---

## Modificacoes Necessarias

### 1. Banco de Dados

Adicionar coluna `attachments` (JSONB) na tabela `financial_payment_queue` para armazenar array de anexos.

```sql
ALTER TABLE financial_payment_queue 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
```

### 2. Hook `useFinancialPaymentQueue.ts`

Atualizar interface `PaymentQueueItem` para incluir `attachments`:

```typescript
interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

export interface PaymentQueueItem {
  // ... existing fields ...
  attachments: Attachment[];
}
```

### 3. Dialog `EnviarFinanceiroDialog.tsx`

Ao enviar despesa para fila de pagamentos, copiar os anexos da despesa:

```typescript
// Buscar anexos da despesa antes de criar item na fila
const { data: expense } = await supabase
  .from("corporate_event_expenses")
  .select("attachments")
  .eq("id", expenseId)
  .single();

// Passar anexos na criacao do item da fila
createPayment({
  // ... other fields ...
  attachments: expense?.attachments || [],
});
```

### 4. Novo Componente `AttachmentAcknowledgement.tsx`

Componente que:
- Lista todos os anexos
- Rastreia quais foram abertos
- Exibe checkbox "Li e estou ciente" para cada um
- Checkbox so habilita apos abrir o arquivo
- Retorna status de todos confirmados

```typescript
interface AttachmentAcknowledgementProps {
  attachments: Attachment[];
  onAllAcknowledged: (allConfirmed: boolean) => void;
}
```

Logica interna:

```typescript
const [openedFiles, setOpenedFiles] = useState<Set<string>>(new Set());
const [acknowledgedFiles, setAcknowledgedFiles] = useState<Set<string>>(new Set());

const handleOpenFile = (url: string) => {
  window.open(url, "_blank");
  setOpenedFiles(prev => new Set(prev).add(url));
};

const handleAcknowledge = (url: string, checked: boolean) => {
  if (!openedFiles.has(url)) return; // Nao pode confirmar sem abrir
  
  const updated = new Set(acknowledgedFiles);
  if (checked) {
    updated.add(url);
  } else {
    updated.delete(url);
  }
  setAcknowledgedFiles(updated);
  
  // Notificar se todos foram confirmados
  onAllAcknowledged(updated.size === attachments.length);
};
```

### 5. Dialog `PaymentReviewDialog.tsx`

Integrar componente de anexos e bloquear aprovacao:

```typescript
const [allAttachmentsAcknowledged, setAllAttachmentsAcknowledged] = useState(false);
const hasAttachments = item.attachments && item.attachments.length > 0;

// No JSX, adicionar secao de anexos
{hasAttachments && (
  <Card>
    <CardContent className="p-4">
      <Label className="text-muted-foreground text-xs mb-3 block">
        Documentos Anexados ({item.attachments.length})
      </Label>
      <AttachmentAcknowledgement
        attachments={item.attachments}
        onAllAcknowledged={setAllAttachmentsAcknowledged}
      />
      {!allAttachmentsAcknowledged && (
        <Alert variant="destructive" className="mt-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Voce deve abrir e confirmar ciencia de todos os 
            documentos antes de aprovar.
          </AlertDescription>
        </Alert>
      )}
    </CardContent>
  </Card>
)}

// Botao de aceitar desabilitado se houver anexos nao confirmados
<Button
  onClick={() => handleAction('accept')}
  disabled={isProcessing || (hasAttachments && !allAttachmentsAcknowledged)}
>
  Aceitar e Criar Conta
</Button>
```

---

## Fluxo de Usuario

1. Financeiro abre dialog de revisao de pagamento
2. Ve os dados do fornecedor, valor, vencimento
3. Ve lista de documentos anexados com botao "Abrir" em cada
4. Para cada documento:
   - Clica em "Abrir" (abre em nova aba)
   - Checkbox "Li e estou ciente" fica habilitado
   - Marca o checkbox
5. Apos confirmar todos os documentos:
   - Botao "Aceitar e Criar Conta" fica habilitado
6. Pode aprovar ou rejeitar

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Adicionar coluna `attachments` em `financial_payment_queue` |
| `src/hooks/useFinancialPaymentQueue.ts` | Adicionar `attachments` na interface |
| `src/hooks/useEventExpenses.ts` | Copiar anexos ao enviar para financeiro |
| `src/components/financeiro/payments/AttachmentAcknowledgement.tsx` | **NOVO** - Componente de visualizacao e confirmacao |
| `src/components/financeiro/payments/PaymentReviewDialog.tsx` | Integrar anexos e logica de bloqueio |

---

## Beneficios

1. **Compliance** - Garantia de que documentos foram revisados antes da aprovacao
2. **Rastreabilidade** - Confirmacao explicita de ciencia
3. **Seguranca** - Evita aprovacoes sem analise documental
4. **Auditoria** - Registro de que o aprovador visualizou os anexos

---

## Consideracoes

- Se nao houver anexos, o fluxo segue normal (sem bloqueio)
- O checkbox so pode ser marcado apos abrir o arquivo
- Todos os anexos devem ser confirmados para liberar aprovacao
- A rejeicao nao exige confirmacao dos anexos (pode rejeitar sem ver)
